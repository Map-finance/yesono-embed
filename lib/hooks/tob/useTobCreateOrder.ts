"use client";

/**
 * P0 骨架：下单 hook。业务接入由 P4 落地。
 * 调用方传 TobOrderCreateReq；幂等键 clientId 由调用方生成（建议 uuid）。
 */

import { useTobMutation } from "./useTobMutation";
import { createTobOrder } from "@/lib/services/tob/tobOrders";
import type {
  TobOrderCreateReq,
  TobOrderCreateResp,
} from "@/lib/services/tob/types";

export function useTobCreateOrder() {
  return useTobMutation<TobOrderCreateReq, TobOrderCreateResp>(createTobOrder);
}
