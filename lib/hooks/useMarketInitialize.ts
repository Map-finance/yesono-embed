/**
 * yesono-embed stub：不执行任何链上初始化
 *
 * 原 h2-market 实现走 UmaCtfAdapter.initialize / batchInitialize 合约调用，
 * yesono-embed 仅走新的 To-B HTTP 接口（/api/tob/market/uma/create），合约创建
 * 由后端服务代办。这里保留函数形状供 CreateMarketNew 编译通过，并把"初始化成功"
 * 直接返回，避免原先 UI 等待链上 txHash 的循环卡死。
 */

"use client";

import { useCallback, useState } from "react";

export const ENABLE_BATCH_INITIALIZE_CUSTOM = false;

export interface MarketInitializeParams {
  ancillaryData: string;
  chainId?: number;
  requiredAllowance?: bigint;
}

export interface MarketInitializeResult {
  success: boolean;
  questionID?: string;
  txHash?: string;
  error?: string;
  needsApproval?: boolean;
}

export interface BatchMarketInitializeParams {
  ancillaryDatas: string[];
  chainId?: number;
  requiredAllowance?: bigint;
  isSports?: boolean;
}

export interface BatchMarketInitializeResult {
  success: boolean;
  questionIDs?: string[];
  txHash?: string;
  error?: string;
  needsApproval?: boolean;
}

export function useMarketInitialize() {
  const [isLoading] = useState(false);
  const [status] = useState<string>("");
  const [error] = useState<string | null>(null);

  const initializeMarket = useCallback(
    async (_params: MarketInitializeParams): Promise<MarketInitializeResult> => {
      // no-op：yesono-embed 不直接上链
      return { success: true };
    },
    []
  );

  const batchInitializeMarkets = useCallback(
    async (
      params: BatchMarketInitializeParams
    ): Promise<BatchMarketInitializeResult> => {
      return {
        success: true,
        questionIDs: params.ancillaryDatas.map(() => "0x"),
      };
    },
    []
  );

  return {
    initializeMarket,
    batchInitializeMarkets,
    isLoading,
    status,
    error,
  };
}
