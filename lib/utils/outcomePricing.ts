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

/** 单侧实时盘口报价(ratio 0-1);无盘口时各字段为 0 */
export interface SideQuote {
  bestAsk: number;
  bestBid: number;
  mid: number;
}
export const EMPTY_SIDE_QUOTE: SideQuote = { bestAsk: 0, bestBid: 0, mid: 0 };

/**
 * 单侧可成交展示价(ratio),四级回退:
 *  ① 该侧有实时价(BUY→bestAsk、SELL→bestBid)→ 用它;
 *  ② 该侧无实时价,但对侧有互补价 → 用互补价推导。
 *     二元市场两个 outcome 是同一个簿的两面("买 Up @98" ≡ "卖 Down @2",98+2=100),
 *     故 本侧 ask = 1 − 对侧 bid;本侧 bid = 1 − 对侧 ask。这是真实可成交价,
 *     避免单边盘口时把该侧买价显示成 0(→ clamp 成误导性的 0.1¢)。
 *  ③ 互补也推不出,但该侧盘口有中点(mid,与概率同口径)→ 用 mid。
 *     单边盘口(只有该侧 bid、无 ask)时:mid = bid,与概率一致;比直接跳静态更贴近真实。
 *     避免后端静态为 0 被调用方均分成 50/50 时,把订单簿真实信号(如 10¢)盖成误导性的 50¢。
 *  ④ 盘口完全无价 → 静态价(整组全 0 时由调用方做 50/50 均分,新市场默认)。
 */
export function resolveSidePrice(
  direction: "BUY" | "SELL",
  quote: SideQuote | undefined,
  otherQuote: SideQuote | undefined,
  staticPrice: number,
): number {
  const live = direction === "SELL" ? quote?.bestBid : quote?.bestAsk;
  if (live && live > 0) return live;
  // ② 互补推导:买入要本侧 ask = 1 − 对侧 bid;卖出要本侧 bid = 1 − 对侧 ask
  const otherComplement = direction === "SELL" ? otherQuote?.bestAsk : otherQuote?.bestBid;
  if (otherComplement && otherComplement > 0 && otherComplement < 1) {
    return 1 - otherComplement;
  }
  // ③ 该侧盘口中点:单边盘口下保留订单簿信号,优先于(可能被均分的)静态价
  const mid = quote?.mid;
  if (mid && mid > 0 && mid < 1) {
    return mid;
  }
  return staticPrice; // ④ 盘口完全无价 → 静态(调用方传入的可能是 50/50 均分值)
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
    yes: resolveSidePrice(args.direction, args.yesQuote, args.noQuote, fy ?? args.yesStatic),
    no: resolveSidePrice(args.direction, args.noQuote, args.yesQuote, fn ?? args.noStatic),
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
