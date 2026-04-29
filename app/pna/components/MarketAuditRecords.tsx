"use client";

/**
 * MarketAuditRecords - 市场创建审核记录
 * 展示用户提交的审核记录列表，数据来自 /v1/event/review_record/list
 * approved → 「创建」按钮继续创建流程
 * rejected → 「修改」按钮回填数据进入编辑
 * pending  → 仅展示等待状态
 */

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, Pencil, Plus } from "lucide-react";
import useGetReviewRecords from "../hooks/useGetReviewRecords";
import PnaEmptyState from "./PnaEmptyState";

const PAGE_SIZE = 20;

/** 状态 → 显示颜色 */
function getStatusStyle(status: string) {
  switch (status) {
    case "approved":
      return "bg-green-500/10 text-green-600 border-green-500/30";
    case "rejected":
      return "bg-red-500/10 text-red-500 border-red-500/30";
    case "pending":
    default:
      return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  }
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return <CheckCircle size={14} className="text-green-600" />;
    case "rejected":
      return <XCircle size={14} className="text-red-500" />;
    default:
      return <Clock size={14} className="text-amber-600" />;
  }
}

function formatTime(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    console.warn('[MarketAuditRecords] Failed to format timestamp', e);
    return iso;
  }
}

interface MarketAuditRecordsProps {
  isActive?: boolean;
}

export default function MarketAuditRecords({ isActive = true }: MarketAuditRecordsProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { records, total, isLoading, refresh } = useGetReviewRecords({
    page,
    pageSize: PAGE_SIZE,
    enabled: isActive,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  if (isLoading && records.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-center py-20">
          <span className="text-[var(--text-secondary)]">
            {t.pna.loading || "Loading..."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 表头 */}
      <div className="grid grid-cols-12 py-3 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider max-md:hidden">
        <div className="col-span-5">{(t.pna as any).auditRecords?.event || "Event / Markets"}</div>
        <div className="col-span-2">{(t.pna as any).auditRecords?.status || "Status"}</div>
        <div className="col-span-3">{(t.pna as any).auditRecords?.createdAt || "Created"}</div>
        <div className="col-span-2 text-right">{(t.pna as any).auditRecords?.action || "Action"}</div>
      </div>

      {/* 列表 */}
      <div className="divide-y divide-[var(--border)]">
        {records.length === 0 ? (
          <PnaEmptyState
            message={t.pna.orders?.noOrders || "No open orders"}
          />
        ) : (
          records.map((item, index) => {
            const eventTitle =
              item.input?.event_title || item.input?.event_id || "—";
            const marketCount = item.input?.markets?.length || 0;
            const firstMarketTitle = item.input?.markets?.[0]?.title || "";

            return (
              <div
                key={item.id ?? index}
                className="grid grid-cols-12 py-4 items-center gap-4 max-md:grid-cols-1 max-md:gap-2"
              >
                {/* Event / Markets */}
                <div className="col-span-5 min-w-0 max-md:col-span-1">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {eventTitle}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">
                      {marketCount > 0
                        ? `${marketCount} ${marketCount === 1 ? "market" : "markets"}`
                        : ""}
                      {firstMarketTitle ? ` · ${firstMarketTitle}` : ""}
                    </p>
                  </div>
                </div>

                {/* Status */}
                <div className="col-span-2 min-w-0 max-md:col-span-1">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getStatusStyle(
                      item.status
                    )}`}
                  >
                    <StatusIcon status={item.status} />
                    {item.status}
                  </span>
                </div>

                {/* Created */}
                <div className="col-span-3 text-sm text-[var(--text-secondary)] max-md:col-span-1">
                  {formatTime(item.created_time)}
                </div>
                <div></div>
              </div>
            );
          })
        )}
      </div>

      {/* 分页 */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border)]">
          <span className="text-sm text-[var(--text-secondary)]">
            {(t.pna as any).auditRecords?.total || "Total"}: {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!hasPrev || isLoading}
              className="p-2 rounded-md border border-[var(--border)] hover:bg-[var(--bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-medium text-[var(--text-primary)] min-w-[80px] text-center">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={!hasNext || isLoading}
              className="p-2 rounded-md border border-[var(--border)] hover:bg-[var(--bg-secondary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
