"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface LoadMoreButtonProps {
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  /** 当前列表条数:为 0 时不渲染(交给空状态) */
  itemCount: number;
}

/**
 * 统一的「加载更多」按钮。
 *  - hasMore:显示「加载更多」按钮(加载中转圈 + 禁用)
 *  - !hasMore:显示「没有更多」收尾
 *  - itemCount === 0:不渲染
 */
export default function LoadMoreButton({
  hasMore,
  isLoadingMore,
  onLoadMore,
  itemCount,
}: LoadMoreButtonProps) {
  const { t } = useTranslation();
  if (itemCount <= 0) return null;

  return (
    <div className="flex justify-center py-6">
      {hasMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={isLoadingMore}
          className="flex items-center gap-2 px-6 py-2 text-sm font-medium border border-(--border) rounded-md text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-secondary) transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoadingMore && <Loader2 size={14} className="animate-spin" />}
          <span>
            {isLoadingMore
              ? (t.pna as any)?.loading || (t.common as any)?.loading || "Loading..."
              : (t.pna as any)?.loadMore || "Load More"}
          </span>
        </button>
      ) : (
        <span className="text-xs text-(--text-tertiary)">
          {(t.pna as any)?.noMore || "No more"}
        </span>
      )}
    </div>
  );
}
