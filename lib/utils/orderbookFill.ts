/**
 * orderbookFill - 订单簿成交估算工具(市价单用)
 *
 * 统一两处面板(桌面 TradingPanel / 移动 MobileTradingPanel)重复的「走盘口」逻辑:
 * - usdForShares: 给定份额 → 估算成交成本/到手(无滑点,按各档真实价累加)
 * - sharesForUsd: 给定 USD → 估算可成交份额(无滑点)
 *
 * 约定(与 ProcessedOrderBook 一致):
 * - asks 存储为「高→低」,买入时需 .slice().reverse() 得「低→高」最优先成交;
 * - bids 存储为「高→低」,卖出时按原序「高→低」最优先成交。
 * 滑点不参与 size/成本估算,仅在下单时对「保护价(orderPrice)」生效(见 applyMarketSlippage)。
 * 估算成本/份额时可传入护栏价 limitPrice(由 marketProtectionPrice 算出),只统计市价 IOC 实际能成交的档。
 */

import { applyMarketSlippage } from "./outcomePricing";

export interface OrderbookLevel {
  price: number;
  size: number;
}

export interface OrderbookLike {
  asks?: OrderbookLevel[];
  bids?: OrderbookLevel[];
  bestAsk?: number;
  bestBid?: number;
}

/**
 * 市价单 IOC 的成交价护栏:买 = bestAsk 上浮滑点;卖 = bestBid 下浮滑点。
 * 估算成本/份额时用它封顶,只算护栏内实际能成交的档(与链上 IOC 一致)。无盘口返回 undefined(不封顶)。
 */
export function marketProtectionPrice(
  ob: OrderbookLike | null | undefined,
  side: "buy" | "sell"
): number | undefined {
  if (!ob) return undefined;
  if (side === "buy") {
    const asks = ob.asks || [];
    const best = ob.bestAsk && ob.bestAsk > 0 ? ob.bestAsk : asks.length ? Math.min(...asks.map((a) => a.price)) : 0;
    return best > 0 ? applyMarketSlippage(best, "BUY") : undefined;
  }
  const bids = ob.bids || [];
  const best = ob.bestBid && ob.bestBid > 0 ? ob.bestBid : bids.length ? Math.max(...bids.map((b) => b.price)) : 0;
  return best > 0 ? applyMarketSlippage(best, "SELL") : undefined;
}

/** 取「最优先成交」侧的档位序列:买=asks 低→高;卖=bids 高→低 */
function fillLevels(ob: OrderbookLike | null | undefined, side: "buy" | "sell"): OrderbookLevel[] {
  if (!ob) return [];
  return side === "buy" ? (ob.asks || []).slice().reverse() : ob.bids || [];
}

/** 校验档位:price/size 必须为正有限数 */
function isValidLevel(lvl: OrderbookLevel): boolean {
  return (
    Number.isFinite(lvl.price) && lvl.price > 0 && Number.isFinite(lvl.size) && lvl.size > 0
  );
}

export interface UsdForSharesResult {
  /** 估算总成本(买)/总到手(卖),USD */
  cost: number;
  /** 已成交均价(cost / filledShares),无成交为 0 */
  avgPrice: number;
  /** 实际可成交份额(盘口深度不足时 < 输入份额) */
  filledShares: number;
  /** 盘口深度不足以吃满输入份额 */
  depthExceeded: boolean;
  /** 逐档累加的 taker 手续费(传入 feeRate 时);未传为 0 */
  fee: number;
}

/**
 * 给定份额,走盘口估算成本/到手(无滑点)。
 * limitPrice:护栏价 —— 买入只吃 price ≤ limitPrice 的卖档,卖出只吃 price ≥ limitPrice 的买档,
 * 超出即停(档位已排序)。传入后估算与市价 IOC 实际成交一致(份额超护栏深度时只算可成交部分)。
 * feeRate:传入则逐档累加 taker 手续费 fee = Σ take×feeRate×p×(1-p)(p clamp 到 [0,1])。
 */
export function usdForShares(
  ob: OrderbookLike | null | undefined,
  side: "buy" | "sell",
  shares: number,
  limitPrice?: number,
  feeRate?: number
): UsdForSharesResult {
  let remaining = Number.isFinite(shares) && shares > 0 ? shares : 0;
  let cost = 0;
  let filled = 0;
  let fee = 0;
  const hasLimit = limitPrice != null && Number.isFinite(limitPrice);
  const hasFee = feeRate != null && feeRate > 0;
  for (const lvl of fillLevels(ob, side)) {
    if (remaining <= 0) break;
    if (!isValidLevel(lvl)) continue;
    if (hasLimit) {
      if (side === "buy" && lvl.price > (limitPrice as number) + 1e-9) break;
      if (side === "sell" && lvl.price < (limitPrice as number) - 1e-9) break;
    }
    const take = Math.min(remaining, lvl.size);
    cost += take * lvl.price;
    if (hasFee) {
      const p = Math.min(1, Math.max(0, lvl.price));
      fee += take * (feeRate as number) * p * (1 - p);
    }
    filled += take;
    remaining -= take;
  }
  return {
    cost,
    avgPrice: filled > 0 ? cost / filled : 0,
    filledShares: filled,
    depthExceeded: remaining > 1e-9,
    fee,
  };
}

export interface SharesForUsdResult {
  /** 该 USD 可成交份额 */
  shares: number;
  /** 实际花费(成交额,不含手续费) */
  cost: number;
  /** 累加的 taker 手续费(传入 feeRate 时);未传为 0 */
  fee: number;
  /** 盘口深度不足以花完输入 USD */
  depthExceeded: boolean;
}

/**
 * 给定 USD 预算,走盘口估算可成交份额。
 * limitPrice:护栏价——买入只吃 price ≤ limitPrice 的卖档,卖出只吃 price ≥ limitPrice;超出即停。
 * feeRate:传入则预算按「成交额 + 手续费」逐档扣(每份占用 = 价 + 价×feeRate×p×(1-p)),
 *   使算出的份额满足 cost+fee ≤ usd —— 供「现金 → 最多可买份额」精确顶满,不漏算手续费。
 */
export function sharesForUsd(
  ob: OrderbookLike | null | undefined,
  side: "buy" | "sell",
  usd: number,
  limitPrice?: number,
  feeRate?: number
): SharesForUsdResult {
  let remaining = Number.isFinite(usd) && usd > 0 ? usd : 0;
  let shares = 0;
  let cost = 0;
  let fee = 0;
  const hasLimit = limitPrice != null && Number.isFinite(limitPrice);
  const hasFee = feeRate != null && feeRate > 0;
  for (const lvl of fillLevels(ob, side)) {
    if (remaining <= 0) break;
    if (!isValidLevel(lvl)) continue;
    // 保护价封顶:买档升序→超过即停;卖档降序→低于即停。
    if (hasLimit) {
      if (side === "buy" && lvl.price > (limitPrice as number) + 1e-9) break;
      if (side === "sell" && lvl.price < (limitPrice as number) - 1e-9) break;
    }
    const p = Math.min(1, Math.max(0, lvl.price));
    const feePerShare = hasFee ? (feeRate as number) * p * (1 - p) : 0;
    const perShare = lvl.price + feePerShare; // 每份占用 = 成交价 + 每份手续费
    const lvlTotal = perShare * lvl.size;
    if (remaining >= lvlTotal) {
      shares += lvl.size;
      cost += lvl.price * lvl.size;
      fee += feePerShare * lvl.size;
      remaining -= lvlTotal;
    } else {
      const take = remaining / perShare;
      shares += take;
      cost += lvl.price * take;
      fee += feePerShare * take;
      remaining = 0;
    }
  }
  return { shares, cost, fee, depthExceeded: remaining > 1e-9 };
}

/** 向下取整到 2 位小数(份额/USD 展示精度,避免临界超支) */
export function floorTo2(x: number): number {
  return Math.floor(x * 100) / 100;
}
