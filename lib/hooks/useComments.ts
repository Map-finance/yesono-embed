import { useCallback, useEffect, useRef, useState } from "react";
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

const toNumId = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

// 后端返回的 id/parentId/rootParentId 是字符串（"105"/"0"），replyCount 可能是 null；
// 而本地树操作全按 number 处理（=== 比较、findRootParent 里 `rootParentId || id` 兜底、
// 临时 id 为负数）。不归一会出问题：根楼 rootParentId="0" 是真值字符串，会让 findRootParent
// 取错根，导致回复插不进树（"回复不更新"）。统一在入口归一成 number。
const normalizeComment = (raw: any): Comment => ({
  ...raw,
  id: toNumId(raw.id),
  marketId: raw.marketId != null ? String(raw.marketId) : "",
  userId: raw.userId != null ? String(raw.userId) : "",
  rootParentId: raw.rootParentId == null ? 0 : toNumId(raw.rootParentId),
  parentId: raw.parentId == null ? null : toNumId(raw.parentId),
  replyToUserId: raw.replyToUserId == null ? null : String(raw.replyToUserId),
  likeCount: toNumId(raw.likeCount),
  replyCount: toNumId(raw.replyCount),
  isLiked: !!raw.isLiked,
  displayText: raw.displayText ?? raw.content,
  replies: Array.isArray(raw.replies) ? raw.replies.map(normalizeComment) : null,
});

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

const findCommentInTree = (
  comments: CommentWithChildren[],
  id: number
): CommentWithChildren | null => {
  for (const c of comments) {
    if (c.id === id) return c;
    const found = findCommentInTree(c.children, id);
    if (found) return found;
  }
  return null;
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
      ? {
          ...comment,
          children: [newComment, ...comment.children],
          open: true,
          // 乐观 +1，让"收起回复 (N)"计数即时更新
          replyCount: comment.replyCount + 1,
        }
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

// 提交失败：移除临时评论；若某楼直接子项里有这条临时回复，回滚乐观 +1 的 replyCount
const removeTempComment = (
  comments: CommentWithChildren[],
  tempId: number
): CommentWithChildren[] => {
  return comments
    .filter((c) => c.id !== tempId)
    .map((comment) => {
      const hadTemp = comment.children.some((c) => c.id === tempId);
      if (comment.children.length > 0) {
        return {
          ...comment,
          children: removeTempComment(comment.children, tempId),
          replyCount: hadTemp
            ? Math.max(0, comment.replyCount - 1)
            : comment.replyCount,
        };
      }
      return comment;
    });
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

  // 始终持有最新 comments 树，供 create 读取（避免 stale 闭包，且不必把 comments 设为 deps）
  const commentsRef = useRef<CommentWithChildren[]>([]);
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

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
        const rawComments: Comment[] = (response.data || []).map(normalizeComment);
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
        const subs: Comment[] = (response.data || []).map(normalizeComment).sort(
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
            // 非破坏式合并：保留本地新增、但服务器快照里还没有的项 —— 既包括 creating
            // 临时回复，也包括刚 POST 成功、服务器尚未返回的真实回复。原来只保留 creating，
            // 会与 POST 替换（replaceTempComment）竞态，把刚发出的回复覆盖丢失。
            const loadedIds = new Set(loadedChildren.map((c) => c.id));
            const localExtras = comment.children.filter(
              (child) => child.creating || !loadedIds.has(child.id)
            );
            const mergedChildren = [...localExtras, ...loadedChildren];
            return {
              ...comment,
              open: true,
              opening: false,
              children: mergedChildren,
              replyCount: Math.max(comment.replyCount, mergedChildren.length),
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

      // 1) 乐观插入临时回复：addCommentToList 会把根楼 open:true 并 replyCount+1
      setComments((prev) =>
        addCommentToList(prev, tempWithState, orderBy, parentId)
      );

      // 2) 回复场景：确保被回复楼"展开"（只开不关 —— 不再用会把已展开楼切换关闭的
      //    toggleSubComments，那是"回复后收回"的根因）。历史子评论尚未加载时拉一次
      //    （loadSubComments 已改为非破坏式合并，不会覆盖刚插入的回复）。
      if (parentId && parentId !== 0) {
        const target = findCommentInTree(commentsRef.current, parentId);
        const hasLoadedChildren =
          target?.children.some((c) => !c.creating) ?? false;
        if (target && target.replyCount > 0 && !hasLoadedChildren) {
          loadSubComments(parentId);
        } else {
          setComments((prev) =>
            updateCommentInTree(prev, parentId, (c) => ({ ...c, open: true }))
          );
        }
      }

      const submit = async () => {
        try {
          const response = await createComment({
            marketId,
            content,
            parentId: parentId || 0,
            replyToUserId: replyToUserId || null,
          });
          if (response.code === 200 && response.data) {
            const realComment: Comment = normalizeComment(response.data);
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
      loadSubComments,
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
              createCommentWithState(normalizeComment(item))
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
