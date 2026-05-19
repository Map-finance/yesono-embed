"use client";

import { useTobMutation } from "./useTobMutation";
import { cancelTobOrder } from "@/lib/services/tob/tobOrderCancel";
import type { TobOrderCancelResp } from "@/lib/services/tob/types";

/**
 * 取消订单 hook。直接调 TOB `POST /api/tob/order/{betId}/cancel`。
 * 传 betId（幂等键，字符串）。
 */
export function useTobOrderCancel() {
  return useTobMutation<string, TobOrderCancelResp>((betId) =>
    cancelTobOrder(betId)
  );
}
