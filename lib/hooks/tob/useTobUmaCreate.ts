"use client";

/**
 * P0 骨架：UMA 三合一市场创建 hook。业务接入由 P5 落地。
 */

import { useTobMutation } from "./useTobMutation";
import { createTobUmaMarket } from "@/lib/services/tob/tobUmaMarket";
import type {
  TobUmaMarketCreateReq,
  TobUmaMarketCreateResp,
} from "@/lib/services/tob/types";

export function useTobUmaCreate() {
  return useTobMutation<TobUmaMarketCreateReq, TobUmaMarketCreateResp>(
    createTobUmaMarket
  );
}
