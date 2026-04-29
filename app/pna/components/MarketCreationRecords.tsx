"use client";

/**
 * MarketCreationRecords - 市场创建记录
 * 展示用户创建的市场列表，数据来自 /api/market/created-record
 * 仅对当前用户自己展示，支持分页
 * DRAFT / DEPLOYING / DEPLOY_FAILED 状态显示「重新创建」按钮
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProxyImage from "@/components/common/ProxyImage";
import { getMarketNavigationUrl } from "@/lib/utils/sportsNav";
import useGetOracleResultEvents, { MarketCreatedRecord } from "../hooks/useGetOracleResultEvents";
import PnaEmptyState from "./PnaEmptyState";

const PAGE_SIZE = 20;

/** 需要显示「重新创建」按钮的状态 */
const RECREATABLE_STATUSES = ["DRAFT", "DEPLOYING", "DEPLOY_FAILED"];

/** 状态 → 显示颜色 */
function getStatusStyle(status: string) {
  const s = status.toUpperCase();
  if (["ACTIVE"].includes(s))
    return "bg-green-500/10 text-green-600 border-green-500/30";
  if (["DEPLOYED", "PROPOSED"].includes(s))
    return "bg-blue-500/10 text-blue-600 border-blue-500/30";
  if (RECREATABLE_STATUSES.includes(s))
    return "bg-amber-500/10 text-amber-600 border-amber-500/30";
  if (["SETTLED", "RESOLVED"].includes(s))
    return "bg-gray-500/10 text-gray-500 border-gray-500/30";
  if (["VOIDED", "CANCELLED"].includes(s))
    return "bg-red-500/10 text-red-500 border-red-500/30";
  return "border-[var(--border)] text-[var(--text-secondary)]";
}

/** 格式化创建时间戳 */
function formatCreatedAt(ts?: number | string): string {
  if (!ts) return "—";
  const timestamp = typeof ts === "string" ? parseInt(ts, 10) : ts;
  if (isNaN(timestamp)) return "—";
  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** 判断记录下 markets 中是否有需要重新部署的市场，返回需要部署的状态 */
function getRecreatableStatus(item: MarketCreatedRecord): string | null {
  const markets = item.markets || [];
  if (markets.length === 0) return null;
  for (const status of RECREATABLE_STATUSES) {
    if (markets.some((m) => (m.status || "").toUpperCase() === status)) {
      return status;
    }
  }
  return null;
}

interface MarketCreationRecordsProps {
  isActive: boolean;
}

export default function MarketCreationRecords({ isActive }: MarketCreationRecordsProps) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [recreatingRecordId, setRecreatingRecordId] = useState<string | null>(null);

  const { list, total, isLoading, error, refresh } = useGetOracleResultEvents({
    page,
    size: PAGE_SIZE,
    enabled: isActive,
  });

  /** 将时间戳（毫秒 or 字符串）转为 YYYY-MM-DD */
  const toDateString = (ts?: string | null): string => {
    if (!ts) return "";
    const n = parseInt(ts, 10);
    if (!isNaN(n) && n > 1000000000) return new Date(n).toISOString().split("T")[0];
    return ts.split("T")[0] || "";
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const getMarketHref = (item: MarketCreatedRecord) =>
    getMarketNavigationUrl(item.slug || "", item.tags?.map(t => ({ slug: t.slug || "" })), item.category);

  if (isLoading && list.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-center py-20">
          <span className="text-(--text-secondary)">
            {t.pna.loading || "Loading..."}
          </span>
        </div>
      </div>
    );
  }

  if (error && list.length === 0) {
    return (
      <div>
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <span className="text-[var(--text-secondary)]">{error}</span>
          <button
            onClick={refresh}
            className="px-4 py-2 text-sm font-medium border border-[var(--border)] rounded-md hover:bg-[var(--bg-secondary)] transition-colors"
          >
            {(t.pna as any).marketCreation?.retry || "Retry"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 表头 */}
      <div className="grid grid-cols-12 py-3 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider max-md:hidden">
        <div className="col-span-6">{(t.pna as any).marketCreation?.market || "Market"}</div>
        <div className="col-span-2">{(t.pna as any).marketCreation?.status || "Status"}</div>
        <div className="col-span-2">{(t.pna as any).marketCreation?.createdAt || "Created"}</div>
        <div className="col-span-2 text-right">{(t.pna as any).marketCreation?.action || "Action"}</div>
      </div>

      {/* 列表 */}
      <div className="divide-y divide-[var(--border)]">
        {list.length === 0 ? (
          <PnaEmptyState
            message={t.pna.orders?.noOrders || "No open orders"}
          />
        ) : (
          list.map((item: MarketCreatedRecord, index) => {
            const question = (item.title || "—") as string;
            const recreatableStatus = getRecreatableStatus(item);
            const status = recreatableStatus || (item.status || "—") as string;
            const statusUpper = status.toUpperCase();
            const marketHref = getMarketHref(item);
            const canRecreate = !!recreatableStatus;
            const isRecreating = recreatingRecordId === String(item.id ?? "");

            return (
              <div
                key={String(item.id ?? index)}
                className="grid grid-cols-12 py-4 items-center gap-4 max-md:grid-cols-1 max-md:gap-2"
              >
                {/* Market */}
                <div className="col-span-6 min-w-0 max-md:col-span-1">
                  {canRecreate ? (
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded overflow-hidden border border-[var(--border)] shrink-0 bg-[var(--bg-secondary)]">
                        {(item.icon || item.image) ? (
                          <ProxyImage
                            src={(item.icon || item.image) as string}
                            alt={question}
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-[var(--text-primary)] truncate block">
                          {question}
                        </span>
                        <div className="flex items-center gap-2">
                          {item.category && (
                            <span className="text-xs text-[var(--text-tertiary)]">
                              {item.category}
                            </span>
                          )}
                          {item.markets && item.markets.length > 0 && (
                            <span className="text-xs text-[var(--text-tertiary)]">
                              · {item.markets.length} {(t.pna as any).marketCreation?.markets || "markets"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Link href={marketHref} className="group flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded overflow-hidden border border-[var(--border)] shrink-0 bg-[var(--bg-secondary)]">
                        {(item.icon || item.image) ? (
                          <ProxyImage
                            src={(item.icon || item.image) as string}
                            alt={question}
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] truncate block">
                          {question}
                        </span>
                        <div className="flex items-center gap-2">
                          {item.category && (
                            <span className="text-xs text-[var(--text-tertiary)]">
                              {item.category}
                            </span>
                          )}
                          {item.markets && item.markets.length > 0 && (
                            <span className="text-xs text-[var(--text-tertiary)]">
                              · {item.markets.length} {(t.pna as any).marketCreation?.markets || "markets"}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  )}
                </div>
                {/* Status */}
                <div className="col-span-2 min-w-0 max-md:col-span-1">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getStatusStyle(status)}`}>
                    {status}
                  </span>
                </div>
                {/* Created */}
                <div className="col-span-2 text-sm text-[var(--text-secondary)] max-md:col-span-1">
                  {formatCreatedAt(item.createdAt)}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 分页 */}
      {total > 0 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--border)]">
          <span className="text-sm text-[var(--text-secondary)]">
            {(t.pna as any).marketCreation?.total || "Total"}: {total}
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

