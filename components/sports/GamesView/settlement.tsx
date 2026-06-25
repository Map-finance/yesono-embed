/**
 * 体育市场结算（已 RESOLVED）相关的共享 helper + 徽章组件。
 *
 * 之前 SportsEventCard / MarketSection / GamesView/index 三处各自重复实现，
 * 提取到此处统一维护。
 */

import type { SportsMarketItem } from "@/types/sports";

export type SettlementLabels = {
  resolved: string;
  win: string;
  lose: string;
  halfWin: string;
  halfLose: string;
  push: string;
  draw: string;
  over: string;
  under: string;
};

/** 判断 market 是否已结算 */
export function isMarketResolved(item?: SportsMarketItem | null): boolean {
  return item?.status === "RESOLVED";
}

/** result 数值 → 通用文案（输 / 赢 / 输一半 / 赢一半 / 平）*/
export function resultToText(result: number, s: SettlementLabels): string {
  if (result === 0) return s.lose;
  if (result === 0.25) return s.halfLose;
  if (result === 0.5) return s.push;
  if (result === 0.75) return s.halfWin;
  if (result === 1) return s.win;
  return s.resolved;
}

/** Moneyline 结算文案：有 Draw 检测 Draw；否则取赢家 marketTitle */
export function getMoneylineSettlementLabel(
  markets: SportsMarketItem[],
  s: SettlementLabels,
): string {
  if (!markets.length) return s.resolved;
  const drawMarket = markets.find((m) =>
    m.marketTitle.toLowerCase().startsWith("draw"),
  );
  if (drawMarket?.result === 1) return `${s.resolved}: ${s.draw}`;
  const winner = markets.find((m) => m.result === 1 && m !== drawMarket);
  if (winner) return `${s.resolved}: ${winner.marketTitle} ${s.win}`;
  const first = markets.find((m) => m.result != null);
  if (first) {
    return `${s.resolved}: ${first.marketTitle} ${resultToText(first.result!, s)}`;
  }
  return s.resolved;
}

/** Spreads 结算文案：主队 outcome + 带符号 lineValue + 结果 */
export function getSpreadSettlementLabel(
  market: SportsMarketItem,
  s: SettlementLabels,
): string {
  const result = market.result;
  if (result == null) return s.resolved;
  if (result === 0.5) return `${s.resolved}: ${s.push}`;
  const homeOutcome = market.outcomes?.find((o) => o.originalIndex === 0);
  const homeName = homeOutcome?.outcome || market.marketTitle;
  const lv = market.lineValue ?? 0;
  const lvStr = lv > 0 ? `+${lv}` : String(lv);
  return `${s.resolved}: ${homeName} ${lvStr} ${resultToText(result, s)}`;
}

/** Totals 结算文案：大 / 小 + |lineValue| + 可选 half qualifier */
export function getTotalSettlementLabel(
  market: SportsMarketItem,
  s: SettlementLabels,
): string {
  const result = market.result;
  if (result == null) return s.resolved;
  if (result === 0.5) return `${s.resolved}: ${s.push}`;
  const isOver = result >= 0.75;
  const direction = isOver ? s.over : s.under;
  const absLine = market.lineValue != null ? ` ${Math.abs(market.lineValue)}` : "";
  const qualifier =
    result === 0.25 || result === 0.75
      ? ` ${result >= 0.75 ? s.halfWin : s.halfLose}`
      : "";
  return `${s.resolved}: ${direction}${absLine}${qualifier}`;
}

/** 蓝色「已结算」徽章；用于替代交易按钮 */
export function ResolvedBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`px-2 py-1.5 rounded-lg bg-[rgba(59,130,246,0.15)] text-[#3b82f6] border border-[rgba(59,130,246,0.3)] font-medium text-[11px] leading-tight text-center whitespace-normal break-words flex items-center justify-center ${className || ""}`}
      title={label}
    >
      {label}
    </div>
  );
}
