/**
 * yesono-embed stub：不做链上余额检查 / 跨链补足
 *
 * 原 h2-market 实现会读 UmaCtfAdapter reward + proposalBond + platformFee，
 * 并在 BAC 侧 USDT 不足时自动从 dYdX 跨链补足。yesono-embed 不触发任何合约，
 * 创建成本由新版 To-B 后端统一扣费。这里保留函数形状，永远返回成功。
 */

"use client";

import { useCallback } from "react";

export interface EnsureMarketCreationBalanceResult {
  success: boolean;
  requiredAmount: bigint;
  bridged: boolean;
  error?: string;
  bridgeTxHash?: string;
}

export function useMarketCreationCost() {
  const ensureMarketCreationBalance = useCallback(
    async (): Promise<EnsureMarketCreationBalanceResult> => {
      return { success: true, requiredAmount: 0n, bridged: false };
    },
    []
  );

  return { ensureMarketCreationBalance };
}
