/**
 * §3 取消订单
 * docs/tob-controller-api.md
 *
 * 注意：替换 lib/api.ts 中老的 `cancelOrderApi(orderId)`。
 * 入参从 `orderId`（数字）改为 `betId`（幂等键，字符串）。详见 diff Q1。
 */

import { USE_MOCK, post } from "./client";
import { mockCancelOrder } from "./mock";
import type { TobOrderCancelResp } from "./types";

/** 3.1 POST /api/tob/order/{betId}/cancel */
export async function cancelTobOrder(
  betId: string
): Promise<TobOrderCancelResp> {
  if (USE_MOCK) return mockCancelOrder(betId);
  return post<TobOrderCancelResp>(
    `/api/tob/order/${encodeURIComponent(betId)}/cancel`
  );
}
