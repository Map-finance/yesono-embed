/**
 * §1 创建订单
 * docs/tob-controller-api.md
 *
 * v1.1 后端答复：查询类（§4.3-4.5）接口不接入，沿用旧 lib/api.ts。
 */

import { USE_MOCK, post } from "./client";
import { mockCreateOrder } from "./mock";
import type { TobOrderCreateReq, TobOrderCreateResp } from "./types";

/** 1.1 POST /api/orders/tob/order/create */
export async function createTobOrder(
  req: TobOrderCreateReq
): Promise<TobOrderCreateResp> {
  if (USE_MOCK) return mockCreateOrder(req);
  return post<TobOrderCreateResp>("/api/orders/tob/order/create", req);
}
