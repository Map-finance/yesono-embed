"use client";

/**
 * P0 骨架：CTF 拆 / 合 / 赎 hook + 状态轮询 hook。
 * 业务接入由 P3 落地。
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useTobMutation } from "./useTobMutation";
import {
  splitTobOrder,
  mergeTobOrder,
  redeemTobOrder,
  queryTobOrderActionStatus,
} from "@/lib/services/tob/tobOrderActions";
import type {
  TobOrderActionResp,
  TobOrderActionStatusResp,
  TobOrderMergeReq,
  TobOrderRedeemReq,
  TobOrderSplitReq,
} from "@/lib/services/tob/types";

export function useTobOrderSplit() {
  return useTobMutation<TobOrderSplitReq, TobOrderActionResp>(splitTobOrder);
}

export function useTobOrderMerge() {
  return useTobMutation<TobOrderMergeReq, TobOrderActionResp>(mergeTobOrder);
}

export function useTobOrderRedeem() {
  return useTobMutation<TobOrderRedeemReq, TobOrderActionResp>(redeemTobOrder);
}

/**
 * 轮询 GET /api/tob/order/{betId}/action/status，直到 status 进入终态或达到次数上限。
 *
 * @param betId 当前 action 关联的 betId（null 时不轮询）
 * @param intervalMs 轮询间隔，默认 4000
 * @param maxAttempts 最多轮询次数，默认 60（≈ 4 分钟）
 */
export function useTobActionStatusPolling(
  betId: string | null,
  intervalMs = 4000,
  maxAttempts = 60
) {
  const [data, setData] = useState<TobOrderActionStatusResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const attemptRef = useRef(0);

  const isTerminal = useCallback(
    (status: string) =>
      ["COMPLETED", "FAILED", "CANCELED", "NOT_FOUND"].includes(
        (status || "").toUpperCase()
      ),
    []
  );

  useEffect(() => {
    if (!betId) {
      setData(null);
      setError(null);
      setDone(false);
      attemptRef.current = 0;
      return;
    }
    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      if (cancelled) return;
      attemptRef.current += 1;
      try {
        const r = await queryTobOrderActionStatus(betId);
        if (cancelled) return;
        setData(r);
        setError(null);
        if (isTerminal(r.status)) {
          setDone(true);
          return;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(msg);
      }
      if (attemptRef.current >= maxAttempts) {
        setDone(true);
        return;
      }
      timer = window.setTimeout(tick, intervalMs) as unknown as number;
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [betId, intervalMs, maxAttempts, isTerminal]);

  return { data, error, done };
}
