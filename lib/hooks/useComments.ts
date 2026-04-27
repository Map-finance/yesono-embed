import { useCallback, useEffect, useState } from "react";
import { getComments, getSubComments } from "../api";
import { translateTexts } from "@/utils/translate";
import { useLocale } from "@/lib/i18n";

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

function useComments(marketId: string) {
  const { locale } = useLocale();
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
  }, [marketId, orderBy, locale]);

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
          updateCommentInTree(prev, commentId, (comment) => ({
            ...comment,
            open: true,
            opening: false,
            children: translatedSubs.map((item) => createCommentWithState(item)),
          }))
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

  const noop = useCallback(() => {}, []);

  return {
    comments,
    loading,
    create: noop as (
      content: string,
      parentId?: number,
      replyToUserId?: string,
      replyToUsername?: string,
      replyToDisplayName?: string
    ) => void,
    toggleSubComments,
    toggleLike: noop as (commentId: number) => void,
    deleteComment: noop as (commentId: number) => void,
    setOrderBy,
  };
}

export default useComments;
