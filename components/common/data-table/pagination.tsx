"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import { Button } from "@/components/ui/shadcn/button";
import { cn } from "@/lib/utils";
import type { PagePagination } from "./types";

/**
 * DataTable 底部分页控件。
 *
 * 提供两套形态：
 * - total 已知（推荐）：显示 "共 N 条" 计数 + 页码按钮组（带省略号）+ 首/末跳转 + 可选页面大小切换
 * - total 未知：仅按"当前页数据 < pageSize"推断 hasNext，退化成 prev/next
 *
 * 视觉与 antd Table（原 h2-market 用 antd）类似但用 shadcn Button + tailwind。
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
  onPageSizeChange,
  pageSizeOptions,
  currentRowCount,
}: DataTablePaginationProps) {
  // 兜底：后端有时返回 total 为字符串（"28"）；做一次防御式解析。
  const coerced =
    typeof total === "number"
      ? total
      : typeof total === "string" && total !== ""
        ? Number(total)
        : null;
  const hasTotal = coerced !== null && Number.isFinite(coerced);

  // —— total 真正未知：退化成简单 prev/next（page-size 也无意义）
  if (!hasTotal) {
    const canPrev = page > 1;
    const canNext = currentRowCount === pageSize;
    return (
      <Footer>
        <span className="tabular-nums">Page {page}</span>
        <div className="flex items-center gap-1">
          <NavBtn onClick={() => onPageChange(page - 1)} disabled={!canPrev} label="Previous">
            <ChevronLeft className="size-4" />
          </NavBtn>
          <NavBtn onClick={() => onPageChange(page + 1)} disabled={!canNext} label="Next">
            <ChevronRight className="size-4" />
          </NavBtn>
        </div>
      </Footer>
    );
  }

  const totalNum = coerced!;
  const totalPages = Math.max(1, Math.ceil(totalNum / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const rangeStart = totalNum === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd =
    totalNum === 0 ? 0 : Math.min(safePage * pageSize, totalNum);

  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  // 页码列表（带省略号）：[1, '...', 4, 5, 6, '...', 12]
  const pages = buildPageList(safePage, totalPages);

  return (
    <Footer>
      <span className="tabular-nums">
        {rangeStart}-{rangeEnd} / {totalNum}
      </span>

      <div className="flex items-center gap-1.5 flex-wrap justify-end">
        {pageSizeOptions && onPageSizeChange ? (
          <PageSizeSelect
            value={pageSize}
            options={pageSizeOptions}
            onChange={(s) => {
              onPageSizeChange(s);
              // 切大小后要保证当前 page 仍合法
              const next = Math.min(safePage, Math.max(1, Math.ceil(totalNum / s)));
              onPageChange(next);
            }}
          />
        ) : null}

        <div className="flex items-center gap-1">
          <NavBtn onClick={() => onPageChange(1)} disabled={!canPrev} label="First">
            <ChevronsLeft className="size-4" />
          </NavBtn>
          <NavBtn onClick={() => onPageChange(safePage - 1)} disabled={!canPrev} label="Previous">
            <ChevronLeft className="size-4" />
          </NavBtn>

          {pages.map((p, i) =>
            p === "…" ? (
              <span
                key={`gap-${i}`}
                className="px-1.5 text-(--text-secondary) select-none"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === safePage ? "page" : undefined}
                className={cn(
                  "min-w-7 h-7 px-2 rounded-md text-xs font-medium tabular-nums transition-colors border",
                  p === safePage
                    ? "bg-(--accent) text-black border-(--accent)"
                    : "border-(--border) text-(--text-primary) hover:bg-(--bg-secondary)"
                )}
              >
                {p}
              </button>
            )
          )}

          <NavBtn onClick={() => onPageChange(safePage + 1)} disabled={!canNext} label="Next">
            <ChevronRight className="size-4" />
          </NavBtn>
          <NavBtn onClick={() => onPageChange(totalPages)} disabled={!canNext} label="Last">
            <ChevronsRight className="size-4" />
          </NavBtn>
        </div>
      </div>
    </Footer>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-(--border) text-xs text-(--text-secondary)">
      {children}
    </div>
  );
}

function NavBtn({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="size-7"
    >
      {children}
    </Button>
  );
}

function PageSizeSelect({
  value,
  options,
  onChange,
}: {
  value: number;
  options: number[];
  onChange: (n: number) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-7 rounded-md border border-(--border) bg-(--bg-card) px-2 text-xs text-(--text-primary) outline-none cursor-pointer hover:bg-(--bg-secondary)"
    >
      {options.map((n) => (
        <option key={n} value={n}>
          {n} / page
        </option>
      ))}
    </select>
  );
}

/**
 * 生成页码列表，最多 7 个槽位：
 *   [1, ..., curr-1, curr, curr+1, ..., total]
 * 总页数 ≤ 7 时全部展开。
 */
function buildPageList(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const set = new Set<number>([1, total, current, current - 1, current + 1]);
  // 头尾各多一个相邻页，让 1,2 / total-1,total 不会孤立
  if (current <= 4) [2, 3, 4, 5].forEach((p) => set.add(p));
  if (current >= total - 3)
    [total - 1, total - 2, total - 3, total - 4].forEach((p) => set.add(p));
  const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    out.push(sorted[i]);
    const next = sorted[i + 1];
    if (next != null && next - sorted[i] > 1) out.push("…");
  }
  return out;
}
