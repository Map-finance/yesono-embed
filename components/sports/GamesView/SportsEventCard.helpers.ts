/**
 * SportsEventCard 内部用到的纯工具函数（无 React 依赖，从 SportsEventCard.tsx 搬出）。
 */

import type { SportsMarketItem, SportsMarketOutcome } from "@/types/sports";

/** 从 marketTitle 提取缩写 (前3-4个字母) */
export function getAbbr(title: string): string {
  const clean = title.replace(/\s*\(.*\)/, "").trim();
  const words = clean.split(/\s+/);
  const word = words.find((w) => w.length > 2) || words[0] || "";
  return word.slice(0, 4).toUpperCase();
}

/** 格式化价格为 cents（精确到 1 位小数，与交易面板一致） */
export function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (isNaN(num)) return "—";
  return `${(num * 100).toFixed(1)}¢`;
}

/** 获取 Yes outcome */
export function getYesOutcome(
  item: SportsMarketItem
): SportsMarketOutcome | undefined {
  return item.outcomes?.find((o) => o.outcome === "Yes") || item.outcomes?.[0];
}

/** 获取 Yes 价格 */
export function getYesPrice(item?: SportsMarketItem): string {
  if (!item) return "—";
  const yes = getYesOutcome(item);
  return yes ? formatPrice(yes.price) : "—";
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
