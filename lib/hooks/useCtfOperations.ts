/**
 * yesono-embed：CTF Split/Merge/Redeem 走 To-B 控制器
 *
 * 原 h2-market 实现：
 *   - useDydx + smartAccount 授权 CTF 合约
 *   - 本地构造 CTF.splitPosition / mergePositions / redeemPositions calldata
 *   - 通过智能账户 UserOp 上链
 *
 * yesono-embed（iframe / 渠道方）：
 *   - 不直连合约，统一走 `tobApi.split / merge / redeem`
 *   - 状态文案和返回结构保持和原 hook 一致，让 MergeShares / SplitShares
 *     两个 Dialog 无需修改即可复用
 */

"use client";

import { useCallback, useState } from "react";
import { tobApi } from "@/lib/services/tob";

export interface SplitParams {
  amount: string;
  conditionId: string;
  marketId?: string;
}

export interface MergeParams {
  amount: string;
  conditionId: string;
  marketId?: string;
}

export interface RedeemParams {
  conditionId: string;
  marketId?: string;
}

export interface CtfOperationResult {
  success: boolean;
  error?: string;
  txHash?: string;
  betId?: string;
}

function newBetId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return (crypto as any).randomUUID();
    }
  } catch {}
  return `bet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useCtfOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  const split = useCallback(
    async (params: SplitParams): Promise<CtfOperationResult> => {
      setIsLoading(true);
      setStatus("Submitting split…");
      try {
        if (!params.marketId) {
          throw new Error("marketId required for tob split");
        }
        const betId = newBetId();
        const resp = await tobApi.split({
          betId,
          marketId: String(params.marketId),
          amount: String(params.amount),
        });
        setStatus("Split accepted");
        return { success: true, betId: resp.betId };
      } catch (e: any) {
        setStatus("");
        return { success: false, error: e?.message || "Split failed" };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const merge = useCallback(
    async (params: MergeParams): Promise<CtfOperationResult> => {
      setIsLoading(true);
      setStatus("Submitting merge…");
      try {
        if (!params.marketId) {
          throw new Error("marketId required for tob merge");
        }
        const betId = newBetId();
        const resp = await tobApi.merge({
          betId,
          marketId: String(params.marketId),
          amount: String(params.amount),
        });
        setStatus("Merge accepted");
        return { success: true, betId: resp.betId };
      } catch (e: any) {
        setStatus("");
        return { success: false, error: e?.message || "Merge failed" };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const redeem = useCallback(
    async (params: RedeemParams): Promise<CtfOperationResult> => {
      setIsLoading(true);
      setStatus("Submitting redeem…");
      try {
        if (!params.marketId) {
          throw new Error("marketId required for tob redeem");
        }
        const betId = newBetId();
        const resp = await tobApi.redeem({
          betId,
          marketId: String(params.marketId),
        });
        setStatus("Redeem accepted");
        return { success: true, betId: resp.betId };
      } catch (e: any) {
        setStatus("");
        return { success: false, error: e?.message || "Redeem failed" };
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { split, merge, redeem, isLoading, status };
}
