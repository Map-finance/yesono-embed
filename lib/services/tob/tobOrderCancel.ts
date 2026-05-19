/**
 * §3 取消订单
 * docs/tob-controller-api.md
 *
 * 入参 betId 为幂等键（字符串，前端创建订单时生成的 uuid）。
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
