/**
 * §2 拆单 / 合并 / 赎回 / 动作状态
 * docs/tob-controller-api.md
 */

import { USE_MOCK, get, post } from "./client";
import { mockOrderAction, mockOrderActionStatus } from "./mock";
import type {
  TobOrderActionResp,
  TobOrderActionStatusResp,
  TobOrderMergeReq,
  TobOrderRedeemReq,
  TobOrderSplitReq,
} from "./types";

/** 2.1 POST /api/tob/order/split */
export async function splitTobOrder(
  req: TobOrderSplitReq
): Promise<TobOrderActionResp> {
  if (USE_MOCK) return mockOrderAction("SPLIT", req.betId);
  return post<TobOrderActionResp>("/api/tob/order/split", req);
}

/** 2.2 POST /api/tob/order/merge */
export async function mergeTobOrder(
  req: TobOrderMergeReq
): Promise<TobOrderActionResp> {
  if (USE_MOCK) return mockOrderAction("MERGE", req.betId);
  return post<TobOrderActionResp>("/api/tob/order/merge", req);
}

/** 2.3 POST /api/tob/order/redeem */
export async function redeemTobOrder(
  req: TobOrderRedeemReq
): Promise<TobOrderActionResp> {
  if (USE_MOCK) return mockOrderAction("REDEEM", req.betId);
  return post<TobOrderActionResp>("/api/tob/order/redeem", req);
}

/** 2.4 GET /api/tob/order/{betId}/action/status */
export async function queryTobOrderActionStatus(
  betId: string
): Promise<TobOrderActionStatusResp> {
  if (USE_MOCK) return mockOrderActionStatus(betId);
  return get<TobOrderActionStatusResp>(
    `/api/tob/order/${encodeURIComponent(betId)}/action/status`
  );
}
