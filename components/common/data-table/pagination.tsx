"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/shadcn/button";
import type { PagePagination } from "./types";

/**
 * DataTable 底部分页控件。
 * - total 已知：显示 "X-Y of Z" 并按 totalPages 控制 next
 * - total 未知：仅按"当前页数据 < pageSize"推断是否还有下一页（onHasMore）
 */
interface DataTablePaginationProps extends PagePagination {
  /** 当前页实际拿到的数据条数（用于推断 hasMore，total 未知时必传） */
  currentRowCount: number;
}

export function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  currentRowCount,
}: DataTablePaginationProps) {
  const hasTotal = typeof total === "number";
  const totalPages = hasTotal ? Math.max(1, Math.ceil(total / pageSize)) : null;

  // 是否有下一页：有 total 看 page < totalPages；没 total 看本页数据是否满
  const canNext = hasTotal
    ? page < (totalPages ?? 1)
    : currentRowCount === pageSize;
  const canPrev = page > 1;

  // 显示文字：有 total 显示 "1-25 of 312"，无 total 显示 "Page 1"
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = (page - 1) * pageSize + currentRowCount;
  const label = hasTotal
    ? `${rangeStart}-${rangeEnd} of ${total}`
    : `Page ${page}`;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-(--border) text-xs text-(--text-secondary)">
      <span className="tabular-nums">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(page - 1)}
          disabled={!canPrev}
          aria-label="Previous page"
          className="size-7"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => onPageChange(page + 1)}
          disabled={!canNext}
          aria-label="Next page"
          className="size-7"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
