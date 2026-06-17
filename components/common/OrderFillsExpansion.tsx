"use client";

/**
 * OrderFillsExpansion - 订单展开行内显示成交明细
 *
 * 由订单表(MyOrdersTable / DydxOrdersTable)在点击行展开时挂载。
 * 自带 lazy fetch + 缓存,挂载时即拉 /fills?orderId=xxx。
 */

import React from "react";
import { Loader2 } from "lucide-react";
import { useOrderFills } from "@/lib/hooks/useOrderFills";
import { useTranslation } from "@/lib/i18n";

interface OrderFillsExpansionProps {
  orderId: string | number;
  /** 整行 expanded 控制由父组件管,这里恒 enabled(挂载即拉) */
}

interface FillsI18n {
  noFillsYet?: string;
  priceHeader?: string;
  sizeHeader?: string;
  totalHeader?: string;
  feeHeader?: string;
  liquidityHeader?: string;
  timeHeader?: string;
  liquidityTooltip?: string;
  takerTooltip?: string;
  makerTooltip?: string;
  secondsAgo?: (n: number) => string;
  minutesAgo?: (n: number) => string;
  hoursAgo?: (n: number) => string;
  daysAgo?: (n: number) => string;
}

const toNum = (v: any): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmtCents = (price: number): string =>
  `${(price * 100).toFixed(0)}¢`;

const fmtUsd = (v: number): string => `$${v.toFixed(2)}`;

const fmtTime = (ms: number, f: FillsI18n): string => {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) {
    const s = Math.floor(diff / 1000);
    return f.secondsAgo ? f.secondsAgo(s) : `${s}s ago`;
  }
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000);
    return f.minutesAgo ? f.minutesAgo(m) : `${m}m ago`;
  }
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000);
    return f.hoursAgo ? f.hoursAgo(h) : `${h}h ago`;
  }
  if (diff < 30 * 86_400_000) {
    const d = Math.floor(diff / 86_400_000);
    return f.daysAgo ? f.daysAgo(d) : `${d}d ago`;
  }
  return new Date(ms).toLocaleDateString();
};

const OrderFillsExpansion: React.FC<OrderFillsExpansionProps> = ({ orderId }) => {
  const { t } = useTranslation();
  const { fills, isLoading, error } = useOrderFills(orderId, { enabled: true });
  const f: FillsI18n = (t.market as any).fills ?? {};

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3 text-[var(--text-tertiary)] text-xs">
        <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
        <span>{t.common?.loading || "Loading..."}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-2 text-xs text-[var(--red)]">
        {error}
      </div>
    );
  }

  if (!fills || fills.length === 0) {
    return (
      <div className="px-4 py-2 text-xs text-[var(--text-tertiary)]">
        {f.noFillsYet || "No fills yet"}
      </div>
    );
  }

  return (
    // 顶部加一条 border 跟订单卡片区分(明确 expansion 是订单的子级)
    // 注意:border-[var(--border)]/30 这种"CSS 变量 + 透明度"在 Tailwind 下无效(变量是 hex,不是 RGB 通道),
    // 改用项目已有的 --border-dark(暗色主题下 = #1a1a1a,几乎贴背景 → 行间细线;--border = #2a2a2a → 区域分隔)
    <div className="px-3 py-2 bg-[var(--bg-secondary)]/40 border-t border-[var(--border)]">
      {/* ============ 桌面端:完整表格 ============ */}
      {/* PC 端字号 13px / 行高 py-2.5;分割线用 border-b 每行各自描边,避免 divide-y 在容器交界处缺线 */}
      <table className="hidden sm:table w-full text-[13px] tabular-nums border-collapse">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-[var(--text-tertiary)] border-b border-[var(--border)]">
            <th className="text-left py-2 px-3 w-8 font-normal">#</th>
            <th className="text-right py-2 px-3 font-normal">{f.priceHeader || "Price"}</th>
            <th className="text-right py-2 px-3 font-normal">{f.sizeHeader || "Size"}</th>
            <th className="text-right py-2 px-3 font-normal">{f.totalHeader || "Total"}</th>
            <th className="text-right py-2 px-3 font-normal">{f.feeHeader || "Fee"}</th>
            <th
              className="text-center py-2 px-3 w-16 cursor-help font-normal"
              title={f.liquidityTooltip || "Liquidity: T = Taker / M = Maker"}
            >
              {f.liquidityHeader || "Liq."}
            </th>
            <th className="text-right py-2 px-3 font-normal">{f.timeHeader || "Time"}</th>
          </tr>
        </thead>
        <tbody>
          {fills.map((fill, idx) => {
            const price = toNum(fill.price);
            const size = toNum(fill.size);
            const amount = toNum(fill.amount) || price * size;
            const fee = toNum(fill.fee);
            const ts = toNum(fill.timestamp);
            const isTaker = String(fill.liquidity).toUpperCase() === "TAKER";
            const isLast = idx === fills.length - 1;
            return (
              <tr
                key={fill.tradeId || `${orderId}-${idx}`}
                className={isLast ? "" : "border-b border-[var(--border-dark)]"}
              >
                <td className="py-2.5 px-3 text-[var(--text-tertiary)]">
                  {idx + 1}
                </td>
                <td className="py-2.5 px-3 text-right text-[var(--text-primary)]">
                  {fmtCents(price)}
                </td>
                <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                  {size.toFixed(2).replace(/\.?0+$/, "")}
                </td>
                <td className="py-2.5 px-3 text-right text-[var(--text-primary)] font-semibold">
                  {fmtUsd(amount)}
                </td>
                <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                  {fmtUsd(fee)}
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span
                    title={isTaker ? (f.takerTooltip || "Taker") : (f.makerTooltip || "Maker")}
                    className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded cursor-help ${
                      isTaker
                        ? "bg-[rgba(239,68,68,0.12)] text-[var(--red)]"
                        : "bg-[rgba(34,197,94,0.12)] text-[var(--green)]"
                    }`}
                  >
                    {isTaker ? "T" : "M"}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right text-[var(--text-secondary)] whitespace-nowrap">
                  {fmtTime(ts, f)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ============ 移动端:卡片堆叠 ============ */}
      <div className="sm:hidden divide-y divide-[var(--border-dark)]">
        {fills.map((fill, idx) => {
          const price = toNum(fill.price);
          const size = toNum(fill.size);
          const amount = toNum(fill.amount) || price * size;
          const fee = toNum(fill.fee);
          const ts = toNum(fill.timestamp);
          const isTaker = String(fill.liquidity).toUpperCase() === "TAKER";
          return (
            <div
              key={fill.tradeId || `${orderId}-${idx}`}
              className="py-1.5 flex flex-col gap-0.5 text-[11px] tabular-nums"
            >
              {/* 主行:序号 + 价×量=金额 + Liq chip */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[var(--text-tertiary)] shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="text-[var(--text-primary)] font-semibold">
                    {fmtCents(price)}
                  </span>
                  <span className="text-[var(--text-tertiary)]">×</span>
                  <span className="text-[var(--text-secondary)]">
                    {size.toFixed(2).replace(/\.?0+$/, "")}
                  </span>
                  <span className="text-[var(--text-tertiary)]">=</span>
                  <span className="text-[var(--text-primary)] font-bold">
                    {fmtUsd(amount)}
                  </span>
                </div>
                <span
                  title={isTaker ? (f.takerTooltip || "Taker") : (f.makerTooltip || "Maker")}
                  className={`shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                    isTaker
                      ? "bg-[rgba(239,68,68,0.12)] text-[var(--red)]"
                      : "bg-[rgba(34,197,94,0.12)] text-[var(--green)]"
                  }`}
                >
                  {isTaker ? "T" : "M"}
                </span>
              </div>
              {/* 副行:时间 · 手续费 */}
              <div className="text-[var(--text-tertiary)] text-[10px] ml-5">
                {fmtTime(ts, f)}
                <span className="mx-1">·</span>
                {f.feeHeader || "Fee"} {fmtUsd(fee)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrderFillsExpansion;
