/**
 * yesono-embed stub：embed 不做链上 dYdX / BAC 交易
 *
 * 原 h2-market 的 useCtfTrading 包含：
 *   - buy / sell：通过 @dydxprotocol/v4-client-js 发链上订单
 *   - bridgeUsdt：BAC ↔ dYdX USDT 跨链
 *   - waitForBalance：链上余额轮询
 *   - getDydxUsdtBalance / ensureDydxInitialized：dYdX 子账户初始化
 *
 * embed 场景全部替换为 "单发 tobApi.createOrder / tobApi.split..."，
 * 这里保留接口形状让 TradingPanel 编译通过，但实际调用路径在 index.tsx
 * 的 handleTradingClick 里被改写为直接调 tobApi。
 */

"use client";

import { useState, useCallback } from "react";

export type TradeSide = "BUY" | "SELL";
export type TokenType = "YES" | "NO";

export interface DydxContext {
  /** embed 不用；保留字段兼容旧签名 */
  subaccountId?: string;
  dydxAddress?: string;
}

export interface BuyParams {
  market: string | number;
  marketId: string;
  tokenType: TokenType;
  tokenId: string;
  amount: string;
  estimatedTotalPrice?: string;
  price?: string;
  type: "LIMIT" | "MARKET";
  questionID: string;
  duration?: number;
  clientId: number;
  cashBalance?: number;
  dydxContext?: DydxContext;
}

export interface SellParams {
  market: string | number;
  marketId: string;
  tokenType: TokenType;
  tokenId: string;
  amount: string;
  price?: string;
  type: "LIMIT" | "MARKET";
  questionID: string;
  duration?: number;
  clientId: number;
  dydxContext?: DydxContext;
}

export interface TradeResult {
  success: boolean;
  error?: string;
  txHash?: string;
}

export function useCtfTrading() {
  const [isTrading, setIsTrading] = useState(false);

  const noop = useCallback(async (): Promise<TradeResult> => {
    // embed 下不经过此 hook 成交（被 index.tsx 改写为 tobApi.createOrder）
    return { success: true };
  }, []);

  const bridgeUsdt = useCallback(
    async (_target: string, _quantums: bigint, _chainId: number): Promise<{ success: boolean; txHash?: string }> => {
      return { success: true };
    },
    []
  );

  const waitForBalance = useCallback(
    async (_target: string, _min: bigint, _chainId: number): Promise<boolean> => true,
    []
  );

  const getDydxUsdtBalance = useCallback(async (): Promise<bigint> => 0n, []);

  const ensureDydxInitialized = useCallback(async (): Promise<DydxContext> => {
    return { subaccountId: "0", dydxAddress: "" };
  }, []);

  return {
    buy: (_p: BuyParams) => noop(),
    sell: (_p: SellParams) => noop(),
    isTrading,
    setIsTrading,
    bridgeUsdt,
    waitForBalance,
    getDydxUsdtBalance,
    ensureDydxInitialized,
  };
}
