/**
 * SportsEventCard 内部用到的纯工具函数（无 React 依赖，从 SportsEventCard.tsx 搬出）。
 */

import type { SportsMarketItem, SportsMarketOutcome } from "@/types/sports";
import { fillEvenSplitWhenAllZero, formatOutcomeProbabilityCents } from "@/utils/format";
import { sortOutcomesByOriginalIndex } from "@/lib/utils/outcomes";

/** 球队/盘口名缩写 —— 统一用共享口径(CJK→3 字,拉丁→前 4 字母大写)。 */
export { getTeamAbbr as getAbbr } from "@/lib/utils/teamAbbr";

/** 格式化价格为 cents（与交易面板一致；clamp 见 utils/format.ts） */
export function formatPrice(price: string): string {
  return formatOutcomeProbabilityCents(parseFloat(price));
}

/** 获取 Yes outcome */
export function getYesOutcome(
  item: SportsMarketItem
): SportsMarketOutcome | undefined {
  return item.outcomes?.find((o) => o.outcome === "Yes") || item.outcomes?.[0];
}

/** 获取 Yes 价格（组内全 0/无流动性 → 50/50 平分，而非 0.1¢；保留 1–99¢ clamp） */
export function getYesPrice(item?: SportsMarketItem): string {
  if (!item) return "—";
  const sorted = sortOutcomesByOriginalIndex(item.outcomes || []);
  if (sorted.length === 0) return "—";
  // YES outcome 在该 market 内 sorted index = 0；组内全 0 时平分各 50%
  const filled = fillEvenSplitWhenAllZero(sorted.map((o) => o.price));
  return formatOutcomeProbabilityCents(filled[0]);
}

/**
 * 获取带符号的 lineValue
 * 忽略接口返回的正负，只取绝对值
 * originalIndex=0 → 负号, originalIndex=1 → 正号
 */
export function getSignedLine(item: SportsMarketItem): string {
  const lv = item.lineValue;
  if (lv === null || lv === undefined) return "";
  const absLv = Math.abs(lv);
  const yes = getYesOutcome(item);
  if (!yes) return String(absLv);
  return yes.originalIndex === 0 ? `-${absLv}` : `+${absLv}`;
}

/** 按 lineValue 绝对值分组 markets，返回 [absLineValue, items[]] 有序数组 */
export function groupByLineValue(
  markets: SportsMarketItem[]
): [number, SportsMarketItem[]][] {
  const map = new Map<number, SportsMarketItem[]>();
  markets.forEach((m) => {
    const lv = Math.abs(m.lineValue ?? 0);
    if (!map.has(lv)) map.set(lv, []);
    map.get(lv)!.push(m);
  });
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}
