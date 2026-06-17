"use client";

/**
 * MyOrdersTable - 当前市场我的未完成订单(Polymarket Open Orders 风格)
 *
 * 列:SIDE / OUTCOME / PRICE / FILLED / TOTAL / EXPIRATION / × Cancel
 * 表头右侧:Cancel All
 *
 * 注:实际 Cancel 逻辑(后端 + 链上)在 Step 1.3 通过 onCancel/onCancelAll props 注入;
 * 本组件不直接调 API,方便复用到 pna 等其他页面。
 */

import React, { useCallback, useMemo, useState } from "react";
import { X, Loader2, ChevronRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { PolymarketMarketResp } from "@/types/home";
import type { UnfinishedAggregatedOrder } from "@/lib/api";
import {
  getOutcomeLabel,
  normalizeBinaryOutcomeLabel,
  sortOutcomesByOriginalIndex,
} from "@/lib/utils/outcomes";
import OrderFillsExpansion from "@/components/common/OrderFillsExpansion";
import LoadMoreButton from "@/components/common/LoadMoreButton";

// 「全部取消」开关:后端暂无批量取消接口(现为循环单笔撤),先隐藏入口。
// 接口就绪后改回 true 即恢复(其余接线、handleCancelAll、useCancelOrder 均保留)。
const SHOW_CANCEL_ALL = false;

export interface MyOrdersTableProps {
  orders: UnfinishedAggregatedOrder[];
  market: PolymarketMarketResp | null;
  /** 取消单笔(Step 1.3 注入)— 不传时按钮置灰 */
  onCancel?: (orderId: string) => Promise<void>;
  /** 全部取消(Step 1.3 注入)— 不传时按钮置灰 */
  onCancelAll?: () => Promise<void>;
  /** 标题文案;不传时用默认 "Open Orders"(当前委托) */
  title?: string;
  // ─── 无限滚动(可选):三个 props 都传时,表底渲染 sentinel + IntersectionObserver ───
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

/** 大数缩写,避免极端值撑破列;< 1e4 走常规千分位 */
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

function compactUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e6) return `$${compactNum(Math.abs(n))}`;
  return `$${Math.abs(n).toFixed(2)}`;
}

function formatExpiry(expiresAt: number | null | undefined): string {
  if (!expiresAt) return "Until cancelled";
  const diffMs = expiresAt - Date.now();
  if (diffMs <= 0) return "Expired";
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffSec < 60) return `in ${diffSec}s`;
  if (diffMin < 60) return `in ${diffMin}m`;
  if (diffHour < 24) return `in ${diffHour}h`;
  return `in ${diffDay}d`;
}

/** 相对时间(用于已结束订单的"已成交 · X min ago") */
function formatRelative(ts: number | null | undefined): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 0) return "";
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (sec < 60) return `${sec}s ago`;
  if (min < 60) return `${min} min ago`;
  if (hour < 24) return `${hour}h ago`;
  return `${day}d ago`;
}

/** 取正毫秒时间戳;0 / "0" / 空 / 非正数一律视为「无」。
 *  后端用 "0" 当"未设置"哨兵,?? 抓不住(字符串 "0" 非 nullish、数字 0 也非 nullish),
 *  故这里显式归一,供 completedAt → updatedAt 兜底用。 */
function toPositiveTs(v: number | string | null | undefined): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 已结束的 status:不再显示倒计时,显示状态 + 完成时间 */
const ENDED_STATUSES = new Set([
  "COMPLETED", "FILLED", "PARTIALLY_FILLED",
  "PARTIALLY_CANCELED", "PARTIALLY_CANCELLED", // 部分成交后撤单(终态)
  "CANCELED", "CANCELLED", "EXPIRED", "FAILED",
]);

const MyOrdersTable: React.FC<MyOrdersTableProps> = ({
  orders,
  market,
  onCancel,
  onCancelAll,
  title,
  hasMore,
  isLoadingMore,
  onLoadMore,
}) => {
  const { t } = useTranslation();
  // 翻页:用「加载更多」按钮(此表常被嵌进内层 overflow 滚动容器,视口 root 的
  // IntersectionObserver 在嵌套滚动里不触发,故不用滚动加载,改为显式按钮点一下拉下一页)
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancellingAll, setCancellingAll] = useState(false);
  // 点击行 ▶ 时展开成交明细;同时只展开一条(再点同一行收起,点别行切换)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const toggleExpand = useCallback((orderId: string) => {
    setExpandedOrderId((prev) => (prev === orderId ? null : orderId));
  }, []);

  // 从 market.clobTokenIds 解出 yes/no tokenId 用于判断订单方向
  const [yesTokenId, noTokenId] = useMemo<[string | null, string | null]>(() => {
    if (!market?.clobTokenIds) return [null, null];
    try {
      const ids = JSON.parse(market.clobTokenIds);
      if (Array.isArray(ids) && ids.length >= 2) return [String(ids[0]), String(ids[1])];
    } catch {
      /* noop */
    }
    return [null, null];
  }, [market?.clobTokenIds]);

  // 真实档位名(Up/Down / Team A/B / Yes/No)
  const [yesLabel, noLabel] = useMemo<[string, string]>(() => {
    const outcomes = sortOutcomesByOriginalIndex(
      (market as any)?.marketOutcomes ?? []
    );
    if (outcomes.length < 2) return [t.common.yes, t.common.no];
    const dict = {
      yes: t.common.yes as string,
      no: t.common.no as string,
      up: t.common.up as string,
      down: t.common.down as string,
    };
    return [
      normalizeBinaryOutcomeLabel(
        getOutcomeLabel(outcomes[0]),
        t.common.yes as string,
        dict
      ),
      normalizeBinaryOutcomeLabel(
        getOutcomeLabel(outcomes[1]),
        t.common.no as string,
        dict
      ),
    ];
  }, [market, t.common.yes, t.common.no, t.common.up, t.common.down]);

  const outcomeForOrder = useCallback(
    (tokenId: string): { label: string; color: "green" | "red" } => {
      if (yesTokenId && String(tokenId) === yesTokenId)
        return { label: yesLabel, color: "green" };
      if (noTokenId && String(tokenId) === noTokenId)
        return { label: noLabel, color: "red" };
      return { label: tokenId.slice(0, 6), color: "green" };
    },
    [yesTokenId, noTokenId, yesLabel, noLabel]
  );

  const handleCancel = useCallback(
    async (orderId: string) => {
      if (!onCancel) return;
      setCancellingId(orderId);
      try {
        await onCancel(orderId);
      } finally {
        setCancellingId(null);
      }
    },
    [onCancel]
  );

  const handleCancelAll = useCallback(async () => {
    if (!onCancelAll) return;
    setCancellingAll(true);
    try {
      await onCancelAll();
    } finally {
      setCancellingAll(false);
    }
  }, [onCancelAll]);

  if (orders.length === 0) return null;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-card)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {title || (t.market as any).openOrders || 'Open Orders'}
          </span>
        </div>
        {/* Cancel All:暂时隐藏 —— 后端尚无真正的「批量取消」接口(当前是循环单笔撤,
            会刷屏 toast / 多次刷新)。接口就绪后把 SHOW_CANCEL_ALL 改回 true 即可恢复。
            只在 onCancelAll 注入时(当前委托)显示;历史委托不显示。 */}
        {SHOW_CANCEL_ALL && onCancelAll && (
          <button
            onClick={handleCancelAll}
            disabled={cancellingAll}
            className="text-xs font-medium text-[var(--red)] hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {cancellingAll && <Loader2 size={11} className="animate-spin" />}
            {((t.market as any).cancelAll || 'Cancel All').toUpperCase()}
          </button>
        )}
      </div>

      {/* 表头(仅桌面端,可点击排序);详情列 60px 留给"详情"按钮;
          cancel 列只在 onCancel 注入时存在 */}
      <div
        className={`hidden sm:grid gap-4 px-4 py-2 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] border-b border-[var(--border)] ${
          onCancel
            ? "grid-cols-[repeat(7,minmax(0,1fr))_72px_28px]"
            : "grid-cols-[repeat(7,minmax(0,1fr))_72px]"
        }`}
      >
        <span className="uppercase">{(t.market as any).orderCols?.side || "Side"}</span>
        <span className="uppercase">{(t.market as any).orderCols?.outcome || "Outcome"}</span>
        <span className="text-right uppercase">{(t.market as any).orderCols?.price || "Price"}</span>
        <span className="text-right uppercase">{(t.market as any).orderCols?.filled || "Filled"}</span>
        <span className="text-right uppercase">{(t.market as any).orderCols?.total || "Total"}</span>
        <span className="text-right uppercase">{(t.market as any).orderCols?.fee || "Fee"}</span>
        <span className="uppercase">{(t.market as any).orderCols?.expiration || "Status / Expiry"}</span>
        {/* 详情列表头占位 */}
        <span />
        {onCancel && <span />}
      </div>

      {/* 行 */}
      <div className="divide-y divide-[var(--border)]">
        {orders.map((order) => {
          const outcome = outcomeForOrder(order.tokenId);
          const sideColor =
            order.side === "BUY" ? "text-[var(--green)]" : "text-[var(--red)]";
          const sideText = order.side === "BUY" ? "Buy" : "Sell";
          // 终态(历史委托)才改用成交字段;当前委托(pending)一律用下单价 / 下单总额,不受影响。
          const isEndedOrder = ENDED_STATUSES.has(String(order.status || "").toUpperCase());
          // 价格:历史委托有成交 → 成交均价 avgFillPrice;未成交(已取消)回退下单价。当前委托 → orderPrice。
          const price =
            isEndedOrder && order.avgFillPrice > 0
              ? order.avgFillPrice
              : order.orderPrice;
          const priceCents = `${(price * 100).toFixed(0)}¢`;
          const filled = `${compactNum(order.filledSize)}/${compactNum(order.placedSize)}`;
          // 金额:历史委托 → 实际成交额 filledAmount;当前委托 → 下单总额(份额 × 下单价)
          const total = compactUsd(
            isEndedOrder ? (order.filledAmount ?? 0) : order.placedSize * price
          );
          // 手续费:订单累计交易手续费(USDT)。未成交单通常为 0。
          const feeUsd = compactUsd(order.tradingFee ?? 0);
          // EXPIRATION 列:活跃订单倒计时,已结束订单显示 "已成交 · X min ago" 等
          const expiration = (() => {
            const upper = String(order.status || "").toUpperCase();
            const ordersT = (t as any).pna?.orders;
            if (ENDED_STATUSES.has(upper)) {
              const statusLabel =
                upper === "CANCELED" || upper === "CANCELLED"
                  ? (ordersT?.canceled ?? "Canceled")
                  : upper === "EXPIRED"
                    ? (ordersT?.expired ?? "Expired")
                    : upper === "PARTIALLY_CANCELED" || upper === "PARTIALLY_CANCELLED"
                      ? (ordersT?.partiallyCanceled ?? "部分撤单")
                      : upper === "PARTIALLY_FILLED"
                        ? (ordersT?.partiallyFilled ?? "部分成交")
                        : (ordersT?.filled ?? "Filled");
              // 成交单用 completedAt;取消单 completedAt 为 0/空 → 用 updatedAt(取消时刻)兜底。
              const rel = formatRelative(
                toPositiveTs(order.completedAt) ?? toPositiveTs(order.updatedAt)
              );
              return rel ? `${statusLabel} · ${rel}` : statusLabel;
            }
            return formatExpiry(order.expiresAt);
          })();
          const sideChipColor =
            outcome.color === "green"
              ? "bg-[rgba(34,197,94,0.15)] text-[var(--green)]"
              : "bg-[rgba(239,68,68,0.15)] text-[var(--red)]";
          const isCancellingThis = cancellingId === order.orderId;

          // 只在 onCancel 注入时(当前委托)渲染 × 按钮;历史委托不渲染
          const cancelBtn = onCancel ? (
            <button
              onClick={() => handleCancel(order.orderId)}
              disabled={isCancellingThis}
              className="text-[var(--text-tertiary)] hover:text-[var(--red)] disabled:opacity-40 disabled:cursor-not-allowed p-1 rounded flex items-center justify-center"
              aria-label="Cancel order"
              title="Cancel order"
            >
              {isCancellingThis ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <X size={14} />
              )}
            </button>
          ) : null;

          const isExpanded = expandedOrderId === order.orderId;
          // 4 个 status 语义:
          //   pending(EXECUTING)         委托中 — 无成交,不显
          //   filled(COMPLETED)          已成交 — ✅
          //   partially_filled           部分成交 — ✅
          //   canceled(CANCELED)         已取消 — 无成交,不显
          // 后端返大写,前端用 uppercase 比对
          const hasFills = ["COMPLETED", "FILLED", "PARTIALLY_FILLED", "PARTIALLY_CANCELED", "PARTIALLY_CANCELLED"].includes(
            String(order.status).toUpperCase()
          );

          return (
            <div key={order.orderId}>
              {/* ============ 桌面端:Grid 表格;只有有成交的订单才能点行展开 ============ */}
              <div
                className={`hidden sm:grid gap-4 px-4 py-2.5 items-center text-sm transition-colors ${
                  hasFills ? "cursor-pointer hover:bg-[var(--bg-hover)]" : ""
                } ${
                  isExpanded ? "bg-[var(--bg-hover)]" : ""
                } ${
                  onCancel
                    ? "grid-cols-[repeat(7,minmax(0,1fr))_72px_28px]"
                    : "grid-cols-[repeat(7,minmax(0,1fr))_72px]"
                }`}
                onClick={hasFills ? () => toggleExpand(order.orderId) : undefined}
              >
                <span className={`font-semibold ${sideColor}`}>{sideText}</span>
                <span
                  className={`text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded inline-block w-fit ${sideChipColor}`}
                >
                  {outcome.label}
                </span>
                <span className="text-right tabular-nums text-[var(--text-primary)]">
                  {priceCents}
                </span>
                <span className="text-right tabular-nums text-[var(--text-secondary)]">
                  {filled}
                </span>
                <span className="text-right tabular-nums text-[var(--text-primary)]">
                  {total}
                </span>
                <span className="text-right tabular-nums text-[var(--text-secondary)]">
                  {feeUsd}
                </span>
                <span className="text-[var(--text-secondary)] truncate">
                  {expiration}
                </span>
                {/* 详情按钮:只在 filledSize > 0 时显示(无成交无明细) */}
                {hasFills ? (
                  <div className="flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(order.orderId);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-[var(--accent)] border border-[var(--accent)]/30 rounded-md hover:bg-[var(--accent)]/10 transition-colors whitespace-nowrap"
                    >
                      <span>{(t.market as any).details || "Details"}</span>
                      <ChevronRight
                        size={11}
                        className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      />
                    </button>
                  </div>
                ) : (
                  <span />
                )}
                {/* cancel 按钮:阻止冒泡,不触发展开 */}
                {onCancel && (
                  <span onClick={(e) => e.stopPropagation()}>{cancelBtn}</span>
                )}
              </div>

              {/* ============ 移动端:两行布局;只有有成交才能点整块 toggle ============ */}
              <div
                className={`sm:hidden px-4 py-2.5 flex flex-col gap-1.5 text-sm ${
                  hasFills ? "cursor-pointer hover:bg-[var(--bg-hover)]" : ""
                } ${
                  isExpanded ? "bg-[var(--bg-hover)]" : ""
                }`}
                onClick={hasFills ? () => toggleExpand(order.orderId) : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`font-semibold ${sideColor}`}>{sideText}</span>
                    <span
                      className={`text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded ${sideChipColor}`}
                    >
                      {outcome.label}
                    </span>
                    <span className="tabular-nums text-[var(--text-primary)]">
                      {priceCents}
                    </span>
                  </div>
                  {onCancel && (
                    <span onClick={(e) => e.stopPropagation()}>{cancelBtn}</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>
                    Filled <span className="tabular-nums">{filled}</span> ·{" "}
                    <span className="tabular-nums text-[var(--text-primary)]">
                      {total}
                    </span>{" "}
                    · {(t.market as any).orderCols?.fee || "Fee"}{" "}
                    <span className="tabular-nums">{feeUsd}</span>
                  </span>
                  <span className="tabular-nums">{expiration}</span>
                </div>
                {/* 移动端详情按钮:只在有成交时显示 */}
                {hasFills && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(order.orderId);
                    }}
                    className="flex items-center justify-center gap-1 mt-1 py-1 text-xs font-medium text-[var(--accent)] hover:opacity-80 border-t border-[var(--border)]/40"
                  >
                    {(t.market as any).details || "Details"}
                    <ChevronRight
                      size={11}
                      className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    />
                  </button>
                )}
              </div>

              {/* ============ 展开行:成交明细 ============ */}
              {isExpanded && (
                <OrderFillsExpansion orderId={order.orderId} />
              )}
            </div>
          );
        })}
      </div>
      {/* 加载更多 —— 父组件传 onLoadMore 才启用,统一组件 */}
      {onLoadMore && (
        <LoadMoreButton
          hasMore={!!hasMore}
          isLoadingMore={!!isLoadingMore}
          onLoadMore={onLoadMore}
          itemCount={orders.length}
        />
      )}
    </div>
  );
};

export default React.memo(MyOrdersTable);
