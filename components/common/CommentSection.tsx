'use client';

/**
 * CommentSection - 通用评论区组件
 * 可在市场详情页、体育页面等多处复用
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import useComments from '@/lib/hooks/useComments';
import { Popover } from '@/components/ui/Popover';
import CommentItem from '@/components/common/CommentItem';
import { useTranslation } from '@/lib/i18n';

export interface Comment {
  id: number;
  username: string;
  displayName: string;
  avatar: string;
  timestamp: string;
  content: string;
  likes: number;
  isLiked: boolean;
  replyCount: number;
  open: boolean;
  children: Comment[];
}



export interface CommentSectionProps {
  /** 唯一标识符，用于区分不同的评论区 */
  entityId: string;
  /** 评论创建成功后的回调 */
  onCommentCreated?: () => void;
}

const CommentSection: React.FC<CommentSectionProps> = ({
  entityId,
  onCommentCreated,
}) => {
  const { comments, loading, create, toggleLike, deleteComment, setOrderBy, toggleSubComments } = useComments(entityId);
  const [sortBy, setSortBy] = useState<'time' | 'like'>('time');
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const { t } = useTranslation();

  const handleLike = (commentId: number) => {
    toggleLike(commentId);
  };

  const handleCommentSubmit = () => {
    if (commentText.trim()) {
      create(commentText);
      setCommentText('');
      onCommentCreated?.();
    }
  };

  const findComment = (comments: any[], id: number): any => {
    for (const comment of comments) {
      if (comment.id === id) return comment;
      const found = findComment(comment.children || [], id);
      if (found) return found;
    }
    return null;
  };

  const handleReplySubmit = (parentId: number, replyToUserId: string) => {
    if (replyText.trim()) {
      const replyToComment = findComment(comments, replyingTo!);
      const replyToUsername = replyToComment?.username;
      const replyToDisplayName =
        replyToComment?.username || replyToComment?.displayName;
      create(replyText, parentId, replyToUserId, replyToUsername, replyToDisplayName);
      setReplyText('');
      setReplyingTo(null);
    }
  };

  // Avatar rendering moved to `Avatar` component (use `name`/`id` as seed)


  // 计算相对时间
  const toRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="mt-6">
      {/* 评论输入框 */}
      <div className="flex items-center gap-3 mb-4 p-4 rounded-xl border border-(--border) bg-(--bg-card)">
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder={t.common.addComment}
          className="flex-1 bg-transparent text-(--text-primary) placeholder-(--text-tertiary) outline-hidden text-sm"
        />
        <button
          onClick={handleCommentSubmit}
          disabled={!commentText.trim()}
          className={`text-sm font-medium transition-colors ${
            commentText.trim()
              ? 'text-(--accent) hover:underline'
              : 'text-(--text-tertiary)'
          }`}
        >
          {t.common.post}
        </button>
      </div>

      {/* 过滤器 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <Popover
            placement="bottom-left"
            content={({ close }) => (
              <div className="text-sm w-[110px]">
                <button
                  onClick={() => {
                    setSortBy('time');
                    setOrderBy('time');
                    close();
                  }}
                  className={`w-full text-left p-2 rounded-sm transition-(--transition-fast) text-(--text-primary) bg-transparent hover:bg-(--bg-hover)`}
                >
                  { t.common.newest }
                </button>
                <button
                  onClick={() => {
                    setSortBy('like');
                    setOrderBy('like');
                    close();
                  }}
                  className={`w-full text-left p-2 rounded-sm transition-(--transition-fast) text-(--text-primary) bg-transparent hover:bg-(--bg-hover)`}
                >
                  { t.common.mostLiked }
                </button>
              </div>
            )}
          >
            <button className="px-3 py-1.5 cursor-pointer flex items-center gap-1 bg-(--bg-secondary) rounded-full text-sm text-(--text-secondary) hover:text-(--text-primary)">
              {sortBy === 'time' ? t.common.newest : t.common.mostLiked}
              <ChevronDown size={16} />
            </button>
          </Popover>
        </div>
        <button className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-(--bg-secondary) rounded-full text-sm text-(--text-secondary) hover:text-(--text-primary)">
          ⚠️ {t.common.bewareExternalLinks}
        </button>
      </div>

      {/* 评论列表 */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-(--text-secondary)">{t.common.loading}</div>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replyingTo={replyingTo}
              replyText={replyText}
              setReplyingTo={setReplyingTo}
              setReplyText={setReplyText}
              handleReplySubmit={handleReplySubmit}
              toggleLike={handleLike}
              deleteComment={deleteComment}
              toggleSubComments={toggleSubComments}
              currentUserId={undefined}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default CommentSection;
