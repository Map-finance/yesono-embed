import { useCallback, useEffect, useState } from "react";
import {
  createComment,
  deleteComment as deleteCommentApi,
  getComments,
  getSubComments,
  toggleLikeComment,
} from "../api";
import { translateTexts } from "@/utils/translate";
import { useLocale } from "@/lib/i18n";
import { useEmbed } from "@/lib/embed/EmbedContext";

export interface Comment {
  id: number;
  marketId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  content: string;
  displayText: string;
  rootParentId: number;
  parentId: number | null;
  replyToUserId: string | null;
  replyToUsername: string | null;
  replyToDisplayName: string | null;
  likeCount: number;
  isLiked: boolean;
  replyCount: number;
  replies: Comment[] | null;
  createdAt: string;
}

export type CommentWithState = Comment & {
  open: boolean;
  opening: boolean;
  creating: boolean;
};

export type CommentWithChildren = CommentWithState & {
  children: CommentWithChildren[];
};

// 临时评论用负 id（与后端正 id 不冲突），提交成功后替换成真实评论
const generateTempId = () => -Date.now();

interface CurrentUser {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

const createTempComment = (
  content: string,
  marketId: string,
  user: CurrentUser,
  parentId?: number,
  replyToUserId?: string,
  replyToUsername?: string,
  replyToDisplayName?: string
): Comment => ({
  id: generateTempId(),
  marketId,
  userId: user.userId,
  username: user.username,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl || "",
  content,
  displayText: content,
  rootParentId: parentId || 0,
  parentId: parentId || null,
  replyToUserId: replyToUserId || null,
  replyToUsername: replyToUsername || null,
  replyToDisplayName: replyToDisplayName || null,
  likeCount: 0,
  isLiked: false,
  replyCount: 0,
  replies: null,
  createdAt: Date.now().toString(),
});

const createCommentWithState = (
  comment: Comment,
  creating = false
): CommentWithChildren => ({
  ...comment,
  open: false,
  opening: false,
  creating,
  children: [],
});

const updateCommentInTree = (
  comments: CommentWithChildren[],
  commentId: number,
  updater: (comment: CommentWithChildren) => CommentWithChildren
): CommentWithChildren[] => {
  return comments.map((comment) => {
    if (comment.id === commentId) return updater(comment);
    if (comment.children.length > 0) {
      return {
        ...comment,
        children: updateCommentInTree(comment.children, commentId, updater),
      };
    }
    return comment;
  });
};

// 把新评论插入列表：顶层按排序插入；回复挂到根父节点的 children
const addCommentToList = (
  comments: CommentWithChildren[],
  newComment: CommentWithChildren,
  orderBy: "time" | "like",
  parentId?: number
): CommentWithChildren[] => {
  if (!parentId || parentId === 0) {
    return orderBy === "time"
      ? [newComment, ...comments]
      : [...comments, newComment];
  }
  const findRootParent = (
    comms: CommentWithChildren[],
    pid: number
  ): number => {
    for (const c of comms) {
      if (c.id === pid) return c.rootParentId || c.id;
      const root = findRootParent(c.children, pid);
      if (root) return root;
    }
    return 0;
  };
  const rootId = findRootParent(comments, parentId);
  return comments.map((comment) =>
    comment.id === rootId
      ? { ...comment, children: [newComment, ...comment.children], open: true }
      : comment
  );
};

// 提交成功：把临时评论替换成后端返回的真实评论
const replaceTempComment = (
  comments: CommentWithChildren[],
  tempId: number,
  realComment: Comment
): CommentWithChildren[] => {
  return comments.map((comment) => {
    if (comment.id === tempId) return createCommentWithState(realComment, false);
    if (comment.children.length > 0) {
      return {
        ...comment,
        children: replaceTempComment(comment.children, tempId, realComment),
      };
    }
    return comment;
  });
};

// 提交失败：移除临时评论
const removeTempComment = (
  comments: CommentWithChildren[],
  tempId: number
): CommentWithChildren[] => {
  return comments
    .filter((c) => c.id !== tempId)
    .map((comment) =>
      comment.children.length > 0
        ? { ...comment, children: removeTempComment(comment.children, tempId) }
        : comment
    );
};

const removeCommentFromTree = (
  comments: CommentWithChildren[],
  commentId: number
): CommentWithChildren[] => {
  return comments
    .filter((comment) => comment.id !== commentId)
    .map((comment) => ({
      ...comment,
      children: removeCommentFromTree(comment.children, commentId),
    }));
};

function useComments(marketId: string) {
  const { locale } = useLocale();
  // embed 鉴权：status==="authed" 即已登录；当前用户信息来自 verify 回填的 profile
  const { status, user: embedUser, requestAuthRefresh } = useEmbed();
  const isAuthenticated = status === "authed";
  const currentUser: CurrentUser = {
    userId: embedUser?.profile?.userId || "",
    username: embedUser?.profile?.username || "",
    displayName:
      embedUser?.profile?.displayName || embedUser?.profile?.username || "",
    avatarUrl: embedUser?.profile?.avatarUrl || "",
  };
  const currentUserId = currentUser.userId || null;

  const [comments, setComments] = useState<CommentWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderBy, setOrderBy] = useState<"time" | "like">("time");

  useEffect(() => {
    const flattenComments = (comms: Comment[]): Comment[] => {
      const res: Comment[] = [];
      const dfs = (c: Comment) => {
        res.push(c);
        if (c.replies && c.replies.length) c.replies.forEach(dfs);
      };
      comms.forEach(dfs);
      return res;
    };

    const applyTranslatedToTree = (
      comms: Comment[],
      map: Map<number, string>
    ): Comment[] => {
      return comms.map((c) => ({
        ...c,
        displayText: map.get(c.id) || c.content,
        replies:
          c.replies && c.replies.length
            ? applyTranslatedToTree(c.replies, map)
            : c.replies,
      }));
    };

    const fetchComments = async () => {
      setLoading(true);
      try {
        const response = await getComments({ marketId, orderBy });
        const rawComments: Comment[] = response.data || [];
        let translatedTree: Comment[];
        try {
          const flat = flattenComments(rawComments);
          const texts = flat.map((c) => c.content);
          const translatedTexts = texts.length
            ? await translateTexts(texts, { target: locale })
            : [];
          const translationMap = new Map<number, string>();
          for (let i = 0; i < flat.length; i++) {
            translationMap.set(flat[i].id, translatedTexts[i]);
          }
          translatedTree = applyTranslatedToTree(rawComments, translationMap);
        } catch (translateErr) {
          console.warn("Failed to translate comments", translateErr);
          translatedTree = rawComments.map((c) => ({
            ...c,
            displayText: c.content,
          }));
        }
        setComments(translatedTree.map((item) => createCommentWithState(item)));
      } catch (err) {
        console.error("Failed to fetch comments:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
  }, [marketId, orderBy, locale, isAuthenticated]);

  const loadSubComments = useCallback(
    async (commentId: number) => {
      setComments((prev) =>
        updateCommentInTree(prev, commentId, (comment) => ({
          ...comment,
          opening: true,
        }))
      );
      try {
        const response = await getSubComments(commentId);
        const subs: Comment[] = (response.data || []).sort(
          (a: Comment, b: Comment) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        let translatedSubs: Comment[];
        try {
          const texts = subs.map((s: any) => s.content);
          const translated = texts.length
            ? await translateTexts(texts, { target: locale })
            : [];
          translatedSubs = subs.map((item, i) => ({
            ...item,
            displayText: translated[i] || item.content,
          }));
        } catch {
          translatedSubs = subs.map((item) => ({
            ...item,
            displayText: item.content,
          }));
        }

        setComments((prev) =>
          updateCommentInTree(prev, commentId, (comment) => {
            const loadedChildren = translatedSubs.map((item) =>
              createCommentWithState(item)
            );
            // 保留正在提交中的临时回复，避免被刷掉
            const creatingChildren = comment.children.filter(
              (child) => child.creating
            );
            return {
              ...comment,
              open: true,
              opening: false,
              children: [...creatingChildren, ...loadedChildren],
            };
          })
        );
      } catch (error) {
        setComments((prev) =>
          updateCommentInTree(prev, commentId, (comment) => ({
            ...comment,
            opening: false,
          }))
        );
        console.error("Failed to load sub-comments:", error);
      }
    },
    [locale]
  );

  const toggleSubComments = useCallback(
    (commentId: number) => {
      setComments((prev) =>
        updateCommentInTree(prev, commentId, (comment) => {
          if (comment.open) return { ...comment, open: false };
          if (comment.children.length > 0) return { ...comment, open: true };
          loadSubComments(commentId);
          return comment;
        })
      );
    },
    [loadSubComments]
  );

  const create = useCallback(
    (
      content: string,
      parentId?: number,
      replyToUserId?: string,
      replyToUsername?: string,
      replyToDisplayName?: string
    ) => {
      // embed 在 iframe 内无法自己弹登录：通知父页拉起登录
      if (!isAuthenticated) {
        requestAuthRefresh("missing");
        return;
      }

      // 乐观插入临时评论
      const tempComment = createTempComment(
        content,
        marketId,
        currentUser,
        parentId,
        replyToUserId,
        replyToUsername,
        replyToDisplayName
      );
      const tempWithState = createCommentWithState(tempComment, true);

      if (parentId && parentId !== 0) {
        toggleSubComments(parentId);
      }
      setComments((prev) =>
        addCommentToList(prev, tempWithState, orderBy, parentId)
      );

      const submit = async () => {
        try {
          const response = await createComment({
            marketId,
            content,
            parentId: parentId || 0,
            replyToUserId: replyToUserId || null,
          });
          if (response.code === 200 && response.data) {
            const realComment: Comment = response.data;
            try {
              const [translated] = await translateTexts([realComment.content], {
                target: locale,
              });
              realComment.displayText = translated || realComment.content;
            } catch {
              realComment.displayText = realComment.content;
            }
            setComments((prev) =>
              replaceTempComment(prev, tempComment.id, realComment)
            );
          } else {
            console.error("Failed to create comment:", response);
            setComments((prev) => removeTempComment(prev, tempComment.id));
          }
        } catch (error) {
          console.error("Failed to create comment:", error);
          setComments((prev) => removeTempComment(prev, tempComment.id));
        }
      };
      submit();
    },
    [
      marketId,
      orderBy,
      locale,
      isAuthenticated,
      requestAuthRefresh,
      toggleSubComments,
      // currentUser 由 profile 推导，登录态变化时引用会变，这里依赖 isAuthenticated 即可
       
      currentUser.userId,
    ]
  );

  const toggleLike = useCallback(
    async (commentId: number) => {
      if (!isAuthenticated) {
        requestAuthRefresh("missing");
        return;
      }
      // 乐观切换
      const flip = (comment: CommentWithChildren) => ({
        ...comment,
        isLiked: !comment.isLiked,
        likeCount: comment.isLiked
          ? comment.likeCount - 1
          : comment.likeCount + 1,
      });
      setComments((prev) => updateCommentInTree(prev, commentId, flip));
      try {
        await toggleLikeComment(commentId);
      } catch (error) {
        // 失败回滚
        setComments((prev) => updateCommentInTree(prev, commentId, flip));
        console.error("Failed to toggle like:", error);
      }
    },
    [isAuthenticated, requestAuthRefresh]
  );

  const deleteCommentOptimistically = useCallback(
    async (commentId: number) => {
      if (!isAuthenticated) {
        requestAuthRefresh("missing");
        return;
      }
      const findComment = (
        comms: CommentWithChildren[],
        id: number
      ): CommentWithChildren | null => {
        for (const comment of comms) {
          if (comment.id === id) return comment;
          const found = findComment(comment.children, id);
          if (found) return found;
        }
        return null;
      };
      const target = findComment(comments, commentId);
      if (!target || (currentUserId && target.userId !== currentUserId)) {
        console.error("Cannot delete: not your comment");
        return;
      }

      // 乐观移除
      setComments((prev) => removeCommentFromTree(prev, commentId));
      try {
        await deleteCommentApi(commentId);
      } catch (error) {
        console.error("Failed to delete comment:", error);
        // 失败：重新拉取兜底
        try {
          const response = await getComments({ marketId, orderBy });
          setComments(
            (response.data || []).map((item: Comment) =>
              createCommentWithState(item)
            )
          );
        } catch (err) {
          console.error("Failed to refetch comments:", err);
        }
      }
    },
    [isAuthenticated, requestAuthRefresh, comments, currentUserId, marketId, orderBy]
  );

  return {
    comments,
    loading,
    currentUserId,
    create,
    toggleSubComments,
    toggleLike,
    deleteComment: deleteCommentOptimistically,
    setOrderBy,
  };
}

export default useComments;
