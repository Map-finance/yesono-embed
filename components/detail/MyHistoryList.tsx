"use client";

/**
 * MyHistoryList - 当前市场我的成交历史(Polymarket History 风格)
 *
 * 每行一句话格式:
 *   Bought 5.00 Down at 5¢ ($0.25)              5s ago
 *   Sold   3.00 Up   at 12¢ ($0.36)             2 min ago
 *
 * 与 ActivityFeed(全市场公共活动流)区分:
 *  - ActivityFeed:全员成交 + 实时 WS
 *  - 本组件:仅自己 + 仅本市场 + 30s 轮询
 */

import React, { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import type { Activity } from "@/app/pna/hooks/use-get-activity";

export interface MyHistoryListProps {
  activities: Activity[];
  /** 默认 10 条;超出折叠 */
  initialCount?: number;
}

/** 大数缩写,避免极端 shares / amount 撑破行 */
function compactNum(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const fmt = (v: number, suffix: string) =>
    `${sign}${v.toFixed(digits).replace(/\.?0+$/, "")}${suffix}`;
  if (abs >= 1e15) return fmt(abs / 1e15, "Q");
  if (abs >= 1e12) return fmt(abs / 1e12, "T");
  if (abs >= 1e9) return fmt(abs / 1e9, "B");
  if (abs >= 1e6) return fmt(abs / 1e6, "M");
  if (abs >= 1e4) return fmt(abs / 1e3, "K");
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** 相对时间:5s ago / 2 min ago / 1h ago / 3d ago */
function formatRelative(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return "just now";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

const MyHistoryList: React.FC<MyHistoryListProps> = ({
  activities,
  initialCount = 10,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);

  const visible = useMemo(
    () => (expanded ? activities : activities.slice(0, initialCount)),
    [activities, expanded, initialCount]
  );

  if (activities.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-card)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
        <span className="text-sm font-semibold text-[var(--text-primary)]">
          {(t.market as any).history || "History"}
        </span>
      </div>

      {/* List */}
      <div className="divide-y divide-[var(--border)]">
        {visible.map((a, idx) => {
          const action = a.type === "Buy" ? "Bought" : "Sold";
          const actionColor =
            a.type === "Buy" ? "text-[var(--green)]" : "text-[var(--red)]";
          const outcomeColor = a.type === "Buy" ? "text-[var(--green)]" : "text-[var(--red)]";
          const shares = (a.shares || 0).toLocaleString(undefined, {
            maximumFractionDigits: 2,
          });
          const priceCents = `${((a.price || 0) * 100).toFixed(0)}¢`;
          const amount = `$${(a.amount || 0).toFixed(2)}`;
          // 把后端原文 "up" / "down" / "yes" / "no" 映射到本地化文案;其他(队名等)保留原文
          const outcomeRaw = (a.outcomeName || "").toLowerCase();
          const outcomeLabel =
            outcomeRaw === "up" ? (t.common as any).up :
            outcomeRaw === "down" ? (t.common as any).down :
            outcomeRaw === "yes" ? (t.common as any).yes :
            outcomeRaw === "no" ? (t.common as any).no :
            a.outcomeName || "";

          return (
            <div
              key={`${a.txHash}-${idx}`}
              className="flex items-center justify-between px-4 py-2.5 text-sm"
            >
              <span className="text-[var(--text-primary)] truncate">
                <span className={`font-semibold ${actionColor}`}>{action}</span>
                <span className="mx-1 tabular-nums">{shares}</span>
                <span className={`font-semibold ${outcomeColor}`}>
                  {outcomeLabel}
                </span>
                <span className="mx-1 text-[var(--text-secondary)]">at</span>
                <span className="tabular-nums">{priceCents}</span>
                <span className="ml-1 text-[var(--text-secondary)] text-xs">
                  ({amount})
                </span>
              </span>
              <span className="text-xs text-[var(--text-tertiary)] flex-shrink-0 ml-3">
                {formatRelative(a.timestamp)}
              </span>
            </div>
          );
        })}
      </div>

      {/* 折叠 / 展开 */}
      {activities.length > initialCount && (
        <button
          onClick={() => setExpanded((s) => !s)}
          className="w-full px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors border-t border-[var(--border)]"
        >
          {expanded
            ? "Show less"
            : `Show all (${activities.length})`}
        </button>
      )}
    </div>
  );
};

export default React.memo(MyHistoryList);
