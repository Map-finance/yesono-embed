"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from '@/lib/i18n';
import Avatar from "./Avatar";
import { Popover } from "@/components/ui/Popover";
import { Flag, Heart, MoreHorizontal, Share } from "lucide-react";
import { UserProfile } from "./UserProfile";

type CommentType = {
  id: number;
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
  userId?: string;
  createdAt: string;
  content: string;
  // 翻译后的展示文本（可选，优先显示）
  displayText?: string;
  likeCount: number;
  isLiked: boolean;
  replyCount: number;
  open: boolean;
  children: CommentType[];
};

interface Props {
  comment: CommentType;
  depth?: number;
  replyingTo: number | null;
  replyText: string;
  setReplyingTo: (id: number | null) => void;
  setReplyText: (value: string) => void;
  handleReplySubmit: (parentId: number, replyToUserId: string) => void;
  toggleLike: (id: number) => void;
  toggleSubComments: (id: number) => void;
  deleteComment: (id: number) => void;
  currentUserId?: string | null;
}

export default function CommentItem({
  comment,
  depth = 0,
  replyingTo,
  replyText,
  setReplyingTo,
  setReplyText,
  handleReplySubmit,
  toggleLike,
  toggleSubComments,
  deleteComment,
  currentUserId,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const isOwner = currentUserId && comment.userId === currentUserId;
  const commentName = comment.username || comment.displayName || "";
  const targetUserId = String(comment.userId || comment.username || "");
  const toUserPna = () => {
    if (!targetUserId) return;
    router.push(`/pna?userId=${encodeURIComponent(targetUserId)}`);
  };

  return (
    <div className="flex gap-3">
      <UserProfile
        userId={String(comment.userId || comment.username)}
        displayName={commentName}
        avatar={comment.avatarUrl || undefined}
      >
        <button type="button" onClick={toUserPna} className="cursor-pointer">
          <Avatar
            src={comment.avatarUrl}
            name={commentName}
            id={String(comment.userId || comment.username || "")}
            size="sm"
          />
        </button>
      </UserProfile>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <UserProfile
            userId={String(comment.userId || comment.username)}
            displayName={commentName}
            avatar={comment.avatarUrl || undefined}
          >
            <span
              className="font-medium text-sm text-[var(--text-primary)] truncate hover:underline cursor-pointer"
              onClick={toUserPna}
            >
              {commentName}
            </span>
          </UserProfile>

          <span className="text-xs text-[var(--text-tertiary)]">
            {new Date(Number(comment.createdAt)).toLocaleString()}
          </span>

          <Popover className="ml-auto" placement="bottom-right" offset={-1} content={({ close }) => (
            <ul className="p-1 text-sm">
              {/* <li className="flex gap-2 items-center py-1.5 rounded-sm transition-all pl-[10px] pr-10 cursor-pointer hover:bg-[var(--bg-hover)]">
                <Share className="w-[15px] text-gray-500" />
                <span>{t.common.share}</span>
              </li> */}
              <li className="flex gap-2 items-center py-1.5 rounded-sm transition-all pl-[10px] pr-10 cursor-pointer hover:bg-[var(--bg-hover)]" onClick={() => {
                close();
                setReplyingTo(comment.id);
              }}>
                <Flag className="w-[15px] text-gray-500" />
                <span>{t.common.reply}</span>
              </li>
            </ul>
          )}>
            <button className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
              <MoreHorizontal size={16} />
            </button>
          </Popover>
        </div>

        <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
          {comment.displayText || comment.content}
        </p>

        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={() => toggleLike(comment.id)}
            className={`flex items-center gap-1 text-sm transition-colors ${
              comment.isLiked
                ? "text-[var(--red)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Heart size={14} fill={comment.isLiked ? "currentColor" : "none"} />
            <span>{comment.likeCount}</span>
          </button>

          <button
            onClick={() => setReplyingTo(comment.id)}
            className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            {t.common.reply}
          </button> 

          {comment.replyCount > 0 && (
            <button
              onClick={() => toggleSubComments(comment.id)}
              className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              {comment.open
                ? t.common.hideReplies
                : t.common.showReplies(comment.replyCount)}
            </button>
          )} 

          {isOwner && (
            <Popover
              trigger="click"
              content={({ close }) => (
                <div className="p-4 max-w-xs">
                  <p className="text-sm mb-3">
                    {t.common.confirmDeleteComment}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        deleteComment(comment.id);
                        close();
                      }}
                      className="px-3 py-1 bg-[var(--red)] text-white text-sm rounded hover:bg-[var(--red)]"
                    >
                      {t.common.confirm}
                    </button>
                    <button
                      onClick={close}
                      className="px-3 py-1 border border-[var(--border)] text-sm rounded hover:bg-[var(--bg-hover)]"
                    >
                      {t.common.cancel}
                    </button>
                  </div> 
                </div>
              )}
            >
              <button className="text-sm text-[var(--red)] hover:text-[var(--red)]">
                {t.common.delete}
              </button>
            </Popover>
          )}
        </div>

        {replyingTo === comment.id && (
          <div className="mt-3 flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={t.common.replyTo(commentName)}
              className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none text-sm"
            />
            <button
              onClick={() =>
                handleReplySubmit(
                  comment.id,
                  String(comment.userId || comment.username),
                )
              }
              disabled={!replyText.trim()}
              className={`text-sm font-medium transition-colors ${
                replyText.trim()
                  ? "text-[var(--accent)] hover:underline"
                  : "text-[var(--text-tertiary)]"
              }`}
            >
              {t.common.reply}
            </button>
            <button
              onClick={() => setReplyingTo(null)}
              className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              {t.common.cancel}
            </button>
          </div>
        )}

        {/* Children */}
        {comment.open && comment.children.length > 0 && (
          <div className="ml-8 mt-4 space-y-4">
            {comment.children.map((child) => (
              <CommentItem
                key={child.id}
                comment={child}
                depth={(depth || 0) + 1}
                replyingTo={replyingTo}
                replyText={replyText}
                setReplyingTo={setReplyingTo}
                setReplyText={setReplyText}
                handleReplySubmit={handleReplySubmit}
                toggleLike={toggleLike}
                toggleSubComments={toggleSubComments}
                deleteComment={deleteComment}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
