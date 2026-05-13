/**
 * §5 UMA 聚合市场（common / sports / crypto 三合一）
 * docs/tob-controller-api.md
 *
 * 注意替换关系（详见 diff §1.8）：
 *   现有 createMarketV2 → tobUmaCreate({ type: 'common', ... })
 *   现有 createCryptoMarket → tobUmaCreate({ type: 'crypto', ... })
 *   现有 reviewSportsMarket + createMarketV2 两步 → tobUmaCreate({ type: 'sports', gameId, markets })
 */

import { USE_MOCK, post } from "./client";
import { mockUmaCreate } from "./mock";
import type {
  TobUmaMarketCreateReq,
  TobUmaMarketCreateResp,
} from "./types";

/** 5.1 POST /api/tob/market/uma/create */
export async function createTobUmaMarket(
  req: TobUmaMarketCreateReq
): Promise<TobUmaMarketCreateResp> {
  if (USE_MOCK) return mockUmaCreate(req);
  return post<TobUmaMarketCreateResp>("/api/tob/market/uma/create", req);
}
