import {
  clampOutcomeProbabilityPercent,
  fillEvenSplitWhenAllZero,
} from "@/utils/format";

/**
 * 市价单滑点(基点;500 = 5%)。**单一来源**:保护价、资金预留等全部从这里派生,
 * 改一处即全同步,避免漏改导致"预留与保护价不一致"。
 * 可由 env NEXT_PUBLIC_MARKET_SLIPPAGE_BPS 覆盖(构建期注入);非法值回落 500。
 */
function readMarketSlippageBps(): number {
  const raw = Number(process.env.NEXT_PUBLIC_MARKET_SLIPPAGE_BPS);
  // 合理区间 (0, 5000]:>50% 视为误配,回落默认
  if (Number.isFinite(raw) && raw > 0 && raw <= 5000) return Math.round(raw);
  return 500; // 默认 5%
}
export const MARKET_SLIPPAGE_BPS = readMarketSlippageBps();

/**
 * 资金预留 / Max-buy 金额折算用的乘数 = 1 + 滑点。与保护价同源(派生自 BPS),
 * 不要再在别处硬编码 1.10/1.05。例:5% → 1.05。
 */
export const MARKET_SLIPPAGE_DIVISOR = 1 + MARKET_SLIPPAGE_BPS / 10000;

/**
 * 给市价单的可成交价加滑点:BUY 上浮(愿意多付)、SELL 下浮(愿意少收),
 * 给市价单留出吃多档 / 容忍盘口移动的空间。
 * 并 clamp 到 (0,1) 概率区间,避免算出 >100¢ / ≤0 的非法价(被后端拒单)。
 * @param price 盘口可成交价(ratio 0-1,BUY=bestAsk / SELL=bestBid)
 */
export function applyMarketSlippage(
  price: number,
  side: "BUY" | "SELL",
  bps: number = MARKET_SLIPPAGE_BPS,
): number {
  if (!Number.isFinite(price) || price <= 0) return price;
  const r = bps / 10000;
  const slipped = side === "BUY" ? price * (1 + r) : price * (1 - r);
  const clamped = Math.min(0.999, Math.max(0.001, slipped));
  // 四舍五入到 6 位小数,消除浮点噪声(如 0.51 × 1.05 = 0.5355000000000001 → 0.5355)
  return Math.round(clamped * 1e6) / 1e6;
}

export interface SideQuote {
  bestAsk: number;
  bestBid: number;
  mid: number;
}
export const EMPTY_SIDE_QUOTE: SideQuote = { bestAsk: 0, bestBid: 0, mid: 0 };

export function resolveSidePrice(
  direction: "BUY" | "SELL",
  quote: SideQuote | undefined,
  staticPrice: number,
): number {
  const live = direction === "SELL" ? quote?.bestBid : quote?.bestAsk;
  return live && live > 0 ? live : staticPrice;
}

export function resolveButtonPrices(args: {
  direction: "BUY" | "SELL";
  yesQuote?: SideQuote;
  noQuote?: SideQuote;
  yesStatic: number;
  noStatic: number;
}): { yes: number; no: number } {
  const [fy, fn] = fillEvenSplitWhenAllZero([args.yesStatic, args.noStatic]);
  return {
    yes: resolveSidePrice(args.direction, args.yesQuote, fy ?? args.yesStatic),
    no: resolveSidePrice(args.direction, args.noQuote, fn ?? args.noStatic),
  };
}

export function resolveYesPercent(
  yesQuote: SideQuote | undefined,
  staticPercentFallback: number,
): number {
  if (yesQuote && yesQuote.mid > 0) {
    return clampOutcomeProbabilityPercent(yesQuote.mid);
  }
  return staticPercentFallback;
}
