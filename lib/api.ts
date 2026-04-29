import { Response } from "@/types/resoonse";
import { http, ApiResponse } from "./request";
import { HoldRankGroup } from "@/types/types";
import { getEmbedToken } from "@/lib/embed/EmbedContext";
import { getAuthApiHost } from "@/lib/config/authApiUrl";

const BASE_URL = process.env.NEXT_PUBLIC_C2C_API_BASE_URL!;
const ROUTER_BASE_URL = process.env.NEXT_PUBLIC_ROUTER_BASE_URL!;
const API_HOST = getAuthApiHost();
const AUTH_BASE_URL = `${API_HOST}/api`;

export const getLanguageHeaders = () => {
  let lang = "en";
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("locale");
      if (stored) lang = stored;
    } catch (e) {
      console.warn("[API] Failed to read locale from localStorage", e);
    }
  }
  return { "Accept-Language": lang };
};

export async function getValidAccessToken(): Promise<string | null> {
  return getEmbedToken();
}

export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<globalThis.Response> {
  const accessToken = getEmbedToken();
  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, {
    ...options,
    headers,
  });
}

async function request(
  url: string,
  options: RequestInit = {},
  headers: Record<string, string> = {}
) {
  const method = (options.method || "GET").toUpperCase();
  const config: any = { headers: { ...(headers || {}) } };
  const data =
    (options as any).body !== undefined ? (options as any).body : undefined;

  let resp: any;
  if (method === "GET") {
    resp = await http.get(url, config);
  } else if (method === "POST") {
    resp = await http.post(url, data, config);
  } else if (method === "PUT") {
    resp = await http.put(url, data, config);
  } else if (method === "DELETE") {
    resp = await http.delete(url, config);
  } else {
    resp = await http.post(url, data, config);
  }

  return resp && resp.data ? resp.data : resp;
}

export async function favoriteEvent(params: {
  isFavorite: boolean;
  slug: string;
}) {
  return request(
    `${API_HOST}/favorite/event`,
    {
      method: "POST",
      body: JSON.stringify(params),
    },
    getLanguageHeaders()
  );
}

export async function getHoldRank(query: {
  marketId: string | number;
  limit: number;
}): Promise<Response<HoldRankGroup[]>> {
  return request(
    `${AUTH_BASE_URL}/holdings-rank?marketId=${query.marketId}&limit=${query.limit}`,
    {},
    {}
  );
}

export async function getHoldRankPnl(query: {
  marketId: string | number;
}): Promise<Response<HoldRankGroup[]>> {
  return request(
    `${AUTH_BASE_URL}/holdings-rank/pnl?marketId=${query.marketId}`,
    {},
    {}
  );
}

export async function getComments({
  marketId,
  orderBy = "time",
}: {
  marketId: string;
  orderBy: "time" | "like";
}) {
  return request(
    `${AUTH_BASE_URL}/comments?marketId=${marketId}&orderBy=${orderBy}`,
    {},
    {}
  );
}

export async function getSubComments(commentId: number) {
  return request(`${AUTH_BASE_URL}/comments/${commentId}/replies`, {}, {});
}


// ─── Unfinished Aggregated Orders ────────────────────────────────────────────

export interface UnfinishedAggregatedOrder {
  orderId: number;
  userId: string;
  tokenId: string;
  side: 'BUY' | 'SELL';
  orderType: string;
  orderPrice: number;
  filledSize: number;
  status: 'CREATED' | 'WAITING_DEPOSIT' | 'PARTIALLY_DEPOSITED' | 'EXECUTING';
  estimatedGasFee: number;
  actualGasFee: number;
  placedAmount: number;
  placedSize: number;
  avgFillPrice: number;
  tradingFee: number;
  outComeUnionKey: string;
  expiresAt: number | null;
  executedAt: number | null;
  completedAt: number | null;
  eventId: string;
}

export async function getUnfinishedOrders(userId?: string): Promise<{
  code: number;
  message: string;
  data: UnfinishedAggregatedOrder[];
}> {
  const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
  const response = await request(`${AUTH_BASE_URL}/orders/unfinished${query}`, {
    method: "GET",
  },
    getLanguageHeaders(),
    // true // 需要 token 鉴权
  );
  return response;
}


/**
 * 获取用户持仓数据（新接口）
 * @param params - 查询参数
 * @returns 用户持仓数据列表
 */
export async function getPositions(params: {
  limit?: number;
  offset?: number;
  userId: string;
}) {
  const queryParams = new URLSearchParams({
    limit: (params.limit || 25).toString(),
    offset: (params.offset || 0).toString(),
    userId: params.userId,
  });

  return request(
    `${AUTH_BASE_URL}/positions/new?${queryParams}`,
    { method: "GET" },
    getLanguageHeaders(),
    // true
  );
}


/**
 * 获取已结束持仓数据（新接口）
 * @param params - 查询参数
 * @returns 已结束持仓数据列表
 */
export async function getClosedPositions(params: {
  limit?: number;
  offset?: number;
  userId: string;
}) {
  const queryParams = new URLSearchParams({
    limit: (params.limit || 25).toString(),
    offset: (params.offset || 0).toString(),
    userId: params.userId,
  });

  return request(
    `${AUTH_BASE_URL}/positions/closed-new?${queryParams}`,
    { method: "GET" },
    getLanguageHeaders(),
    // true
  );
}


// ─── Order Cancel API ────────────────────────────────────────────────────────

export interface OrderCancelResponse {
  code: number;
  message: string;
  data: boolean;
}

/**
 * 调用 /api/order/cancel 接口，通知后端取消指定订单
 *
 * @param orderId  订单 ID（字符串，如 "1234567890123"）
 */
export async function cancelOrderApi(params: {
  orderId: string;
}): Promise<OrderCancelResponse> {
  console.log("📤 API: 取消订单...", params);

  const response = await request(
    `${ROUTER_BASE_URL}/order/cancel`,
    {
      method: "POST",
      body: JSON.stringify(params),
    },
    getLanguageHeaders(),
    // true // 需要 token 鉴权
  );

  return response;
}


/**
 * 获取市场创建记录
 * GET /api/events/user?limit=20&offset=0
 * 后端用的是 limit/offset 风格分页（不是 page/size），这里入参兼容 page/size，
 * 内部换算成 offset = (page-1) * size。
 */
export async function getMarketCreatedRecords(params: {
  page?: number;
  size?: number;
}) {
  const page = params.page ?? 1;
  const size = params.size ?? 20;
  const offset = Math.max(0, (page - 1) * size);
  const queryParams = new URLSearchParams({
    limit: size.toString(),
    offset: offset.toString(),
  });

  return request(
    `${AUTH_BASE_URL}/events/user?${queryParams}`,
    { method: "GET" },
    getLanguageHeaders(),
    // true
  );
}


/**
 * 获取用户活动记录
 * @param params - 查询参数
 * @returns 用户活动记录列表
 */
export async function getActivityList(params: {
  limit?: number;
  offset?: number;
  userId: string;
}) {
  const queryParams = new URLSearchParams({
    limit: (params.limit || 25).toString(),
    offset: (params.offset || 0).toString(),
    userId: params.userId,
  });

  return request(
    `${AUTH_BASE_URL}/activity?${queryParams}`,
    { method: "GET" },
    getLanguageHeaders(),
    // true
  );
}


/**
 * 分页查询用户的链上交易记录
 * @param params - 查询参数
 * @returns 链上交易记录列表
 */
export async function getChainTransactions(params: {
  limit?: number;
  offset?: number;
  userId?: string;
}) {
  const queryParams = new URLSearchParams();
  if (params.limit) queryParams.append("limit", params.limit.toString());
  if (params.offset) queryParams.append("offset", params.offset.toString());
  if (params.userId) queryParams.append("userId", params.userId);

  return request(
    `${AUTH_BASE_URL}/activity/chain-transactions?${queryParams}`,
    { method: "GET" },
    getLanguageHeaders(),
    // true
  );
}


// 获取用户交易记录
export async function getUserTransactions(page: number, size: number) {
  const response = await request(
    `${BASE_URL}/transaction/user?page=${page}&size=${size}`,
    {
      method: "GET",
    },
    getLanguageHeaders(),
    // true
  ); // 添加语言头和认证

  // 处理返回结果
  if (response.success) {
    console.log("✅ 用户交易记录获取成功");
  }

  return response;
}

/**
 * 亚盘订单簿后端返回结构（与 h2-market 保持一致；详见 types/pna.ts）。
 * 注意：旧版本这里曾是扁平的 transaction 字段（id/marketId/amount/...），
 * 实际 `/user/order` 返回的是嵌套的 ApiOrderBookRecord（含 options + orderDetails）。
 */
export type { ApiOrderBookRecord as UserOrder } from "@/types/pna";
import type { ApiOrderBookRecord } from "@/types/pna";

export interface ApiUserOrdersResponse {
    records: ApiOrderBookRecord[];
    total: number;
    page: number;
    size: number;
}


// 获取用户订单簿
export async function getUserOrders(
  page: number,
  size: number
): Promise<ApiResponse<ApiUserOrdersResponse>> {
  console.log("📤 API: 获取用户订单簿...", { page, size });
  const response = await request(
    `${BASE_URL}/user/order?page=${page}&size=${size}`,
    {
      method: "GET",
    },
    getLanguageHeaders(),
    // true
  ); // 添加语言头和认证

  // 处理返回结果
  if (response.success) {
    console.log("✅ 用户订单簿获取成功");
  }

  return response;
}

// 获取待领取订单列表（marketId + itemId）
export async function getClaimingOrders(): Promise<ApiResponse<{
  totalAmount: string;
  totalCount: number;
  records: Array<{ marketId: string; itemId: string }>;
}>> {
  const response = await request(
    `${BASE_URL}/user/order/claiming`,
    { method: "GET" },
    getLanguageHeaders(),
    // true
  );
  return response;
}


// 获取用户开盘记录
export async function getUserMarketRecords(
  page: number,
  size: number,
  catalog: string = "football"
) {
  console.log("📤 API: 获取用户开盘记录...", { page, size, catalog });

  const response = await request(
    `${BASE_URL}/market/user/record/${catalog}?page=${page}&size=${size}`,
    {
      method: "GET",
    },
    getLanguageHeaders(),
    // true
  ); // 添加语言头和认证

  // 处理返回结果
  if (response.success) {
    console.log("✅ 用户开盘记录获取成功");
  }

  return response;
}

export interface UserInfo {
    userId: string;
    username: string;
    displayName: string;
    email: string | null;
    avatarUrl: string | null;
    avatarGradient: string;
    bio: string | null;
    smartAccountAddress: string;
    walletAddress: string;
    joinedDate: string;
    profileViews: number;
}

/**
 * 根据 userId 获取用户资料（他人主页）
 * GET /api/user/profile/user-info?userId=xxx
 */
export async function getUserProfileUserInfo(userId: string): Promise<ApiResponse<UserInfo>> {
  const queryParams = new URLSearchParams({
    userId,
  });

  return request(
    `${AUTH_BASE_URL}/user/profile/user-info?${queryParams}`,
    { method: "GET" },
    getLanguageHeaders(),
    // true
  );
}

export interface UserOrderSummaryData {
  marketCounts: string;
  marketValues: string;
}

/**
 * 获取用户亚盘订单汇总
 * - 不传 userId: 查询当前用户
 * - 传 userId: 查询指定用户
 * - 走 c2c 域名
 */
export async function getUserOrderSummary(
  userId?: string
): Promise<ApiResponse<UserOrderSummaryData>> {
  const query = userId
    ? `?userId=${encodeURIComponent(userId)}`
    : "";
  return request(
    `${BASE_URL}/user/order/summary${query}`,
    { method: "GET" },
    getLanguageHeaders(),
    // true
  );
}


export type Fidelity =
  | "1MIN"
  | "5MINS"
  | "15MINS"
  | "30MINS"
  | "1HOUR"
  | "4HOURS"
  | "1DAY";

export interface PricePoint {
  t: number;
  p: number;
}

export interface OrderBookEntry {
  price: string;
  size: string;
}

export interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

export interface PriceHistoryData {
  history: PricePoint[];
  orderbook: OrderBookData | null;
  havePoly: boolean;
  polyMarketId: string | null;
  polyAssetId: string | null;
}

export interface PriceHistoryResponse {
  code: number;
  message: string;
  data: PriceHistoryData;
}

export async function getPriceHistory(
  market: string,
  startTs: number,
  fidelity: Fidelity
): Promise<PriceHistoryResponse> {
  return request(
    `${AUTH_BASE_URL}/price-history?startTs=${startTs}&market=${market}&fidelity=${fidelity}`,
    {},
    {}
  );
}

export type { ApiResponse };
