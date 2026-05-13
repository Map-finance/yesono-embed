"use client";

import { useTobMutation } from "./useTobMutation";
import { cancelTobOrder } from "@/lib/services/tob/tobOrderCancel";
import type { TobOrderCancelResp } from "@/lib/services/tob/types";

/**
 * P0 骨架：取消订单 hook。
 * 切换由 feature flag NEXT_PUBLIC_TOB_USE_NEW_CANCEL 控制（P1.1 实施）。
 *
 * 注意：传 betId（不是旧 orderId），见 diff Q1。
 */
export function useTobOrderCancel() {
  return useTobMutation<string, TobOrderCancelResp>((betId) =>
    cancelTobOrder(betId)
  );
}
