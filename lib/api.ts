import { Response } from "@/types/resoonse";
import { http, ApiResponse } from "./request";
import { HoldRankGroup } from "@/types/types";
import { getEmbedToken } from "@/lib/embed/EmbedContext";
import { embedFetch } from "@/lib/embed/embedFetch";
import { getAuthApiHost } from "@/lib/config/authApiUrl";

const BASE_URL = process.env.NEXT_PUBLIC_C2C_API_BASE_URL!;
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
  // 用「当前」token 构建鉴权头；401 重放时 embedFetch 会再调一次重建，拿新 token
  const buildHeaders = (): Headers => {
    const accessToken = getEmbedToken();
    const headers = new Headers(options.headers || {});
    if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    return headers;
  };
  return embedFetch(url, {
    ...options,
    headers: buildHeaders(),
    rebuildHeaders: buildHeaders,
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

/** 单个市场持仓排行榜(按持仓金额/balance);入参与响应同 getHoldRank */
export async function getHoldRankBalance(query: {
  marketId: string | number;
  limit: number;
}): Promise<Response<HoldRankGroup[]>> {
  return request(
    `${AUTH_BASE_URL}/holdings-rank/balance?marketId=${query.marketId}&limit=${query.limit}`,
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

// ─── Event Volume API ────────────────────────────────────────────────────────

export interface EventVolumeMarket {
  marketId: string;
  volume: number;
  volume24hr: number;
}

export interface EventVolumeData {
  eventId: string;
  volume: number;
  volume24hr: number;
  markets: EventVolumeMarket[];
}

/**
 * 根据 eventId 查询事件总交易量(含 24h 增量)及各市场分解
 * 后端:GET /api/events/{eventId}/volume
 * 响应:{ code, success, msg, data: { eventId, volume, volume24hr, markets:[{marketId,volume,volume24hr}] } }
 */
export async function getEventVolume(
  eventId: string | number
): Promise<Response<EventVolumeData>> {
  return request(`${AUTH_BASE_URL}/events/${eventId}/volume`, {}, {});
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

interface CreateCommentParams {
  marketId: string;
  parentId?: number;
  replyToUserId?: string | null;
  content?: string;
}

/** 创建评论 / 回复 */
export async function createComment(params: CreateCommentParams) {
  return request(
    `${AUTH_BASE_URL}/comments`,
    {
      method: "POST",
      body: JSON.stringify(params),
    },
    getLanguageHeaders()
  );
}

/** 点赞 / 取消点赞评论 */
export async function toggleLikeComment(commentId: number) {
  return request(
    `${AUTH_BASE_URL}/comments/${commentId}/like`,
    { method: "POST" },
    getLanguageHeaders()
  );
}

/** 删除评论 */
export async function deleteComment(commentId: number) {
  return request(
    `${AUTH_BASE_URL}/comments/${commentId}`,
    { method: "DELETE" },
    getLanguageHeaders()
  );
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

/**
 * 取消订单。直接走 TOB `POST /api/tob/order/{betId}/cancel`。
 *
 * 后端返回的 status 已知：
 *   canceled / refund_pending / refund_completed → 取消请求被接受
 *   failed / error / rejected → 明确失败
 * HTTP 非 2xx 会被 axios 抛出；到达这里说明请求被接受，只把明确失败状态视为失败。
 */
export async function cancelOrder(betId: string): Promise<{
  ok: boolean;
  status?: string;
  raw: unknown;
}> {
  const { cancelTobOrder } = await import("@/lib/services/tob/tobOrderCancel");
  const r = await cancelTobOrder(betId);
  const status = (r?.status || "").toLowerCase();
  const isFailure =
    status === "failed" || status === "error" || status === "rejected";
  return {
    ok: !!r && !isFailure,
    status: r?.status,
    raw: r,
  };
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

/**
 * 事件结算价（开盘价 / 收盘价）。
 * - 未开盘：openPrice、closePrice 均为 null
 * - 进行中：openPrice 有值，closePrice 为 null（结算后才会有）
 * - 已收盘：两者均有值
 * 用于金融 / 加密货币市场详情页展示"Price to beat"（开盘价）与"Final price"（收盘价）。
 */
export interface EventSettlementPrices {
  eventId: string;
  openPrice: number | null;
  closePrice: number | null;
}

export interface EventSettlementPricesResponse {
  code: number;
  success: boolean;
  data: EventSettlementPrices | null;
  msg: string;
}

export async function getEventSettlementPrices(
  eventId: string | number
): Promise<EventSettlementPricesResponse> {
  return request(
    `${AUTH_BASE_URL}/events/${eventId}/settlement-prices`,
    {},
    getLanguageHeaders()
  );
}

/**
 * 已结算事件的资产价格序列（结算时间窗内），用于结束后价格折线图（LivePriceChart）的
 * "冻结图"：刷新页面也能精确展示该市场时间段的价格走势，而非 WS 的近端滚动数据。
 * timestamp 为 epoch（后端为 ms），value 为资产价格。
 */
export interface MarketClosePricePoint {
  timestamp: number;
  value: number;
}

/** 后端实际返回：data 是对象，价格序列在 data.prices（不是 data 本身） */
export interface MarketClosePriceData {
  eventId: string;
  closeTime: string;
  fromTime: string;
  symbol: string;
  priceType: string;
  prices: MarketClosePricePoint[];
}

export interface MarketClosePriceResponse {
  code: number;
  success: boolean;
  data: MarketClosePriceData | null;
  msg: string;
}

export async function getMarketClosePrice(
  eventId: string | number
): Promise<MarketClosePriceResponse> {
  return request(
    `${AUTH_BASE_URL}/market/close-price?eventId=${eventId}`,
    {},
    getLanguageHeaders()
  );
}

/**
 * 单个 market 的结算结果（YES 侧赔付比例）。
 * data 取值含义：
 * - 1.00 → YES 完胜（NO 完败）
 * - 0.75 → YES 赢一半
 * - 0.50 → 打平 / 退款（push）
 * - 0.25 → YES 输一半
 * - 0.00 → YES 完败（NO 完胜）
 * - null → 尚未结算 / 无结果
 * 用于市场详情页结算面板与 outcome 行徽标，展示精确的五态结算结果。
 */
export interface MarketSettlementResultResponse {
  code: number;
  success: boolean;
  data: number | null;
  msg: string;
}

export async function getMarketSettlementResult(
  marketId: string | number
): Promise<MarketSettlementResultResponse> {
  return request(
    `${AUTH_BASE_URL}/markets/${marketId}/settlement-result`,
    {},
    getLanguageHeaders()
  );
}

export type { ApiResponse };

/* ============================================================ */
/* CTF 余额 / Order Create 类型（端口自 h2-market lib/api.ts）   */
/* yesono-embed 不直接调 createOrderNew，但 TradingPanel 端口   */
/* 过程中仍引用相关类型（CreateOrderTx / CreateOrderToken）。   */
/* getUserCtfBalance 是旧后端接口，按用户要求沿用。             */
/* ============================================================ */

export type UserCtfBalance = string | number;

export async function getUserCtfBalance(
  unionKey: string
): Promise<ApiResponse<UserCtfBalance>> {
  return request(
    `${AUTH_BASE_URL}/user/ctf-balance?unionKey=${encodeURIComponent(unionKey)}`,
    { method: "GET" },
    getLanguageHeaders()
  );
}

export interface CreateOrderTx {
  orderId: string;
  chainId: string;
  chainName: string;
  txType: "Bridge" | "Trade";
  tradingAccount: string;
  amount: number;
  size: number;
  estimatedGasFee: number;
  bridgeAmount: number;
}

export interface CreateOrderToken {
  originalIndex: 0 | 1;
  tokenId: string | null;
  tradingPair: string | null;
  clobPairId: string | null;
  atomicResolution: number | null;
  quantumConversionExponent: number | null;
  stepBaseQuantums: string | null;
  subticksPerTick: string | null;
}

export interface CreateOrderData {
  orderId: string;
  expiresAt: number;
  txs: CreateOrderTx[];
  tokens: CreateOrderToken[];
  totalGasFee: number;
}

export interface CreateOrderResponse {
  code: number;
  message: string;
  data: CreateOrderData;
}

export interface CreateOrderParams {
  eventId: string;
  tokenId: string;
  side: "BUY" | "SELL";
  amount: number;
  size: number;
  orderType: "MARKET" | "LIMIT";
  orderPrice?: number;
  expiryTime?: string;
  subaccountId?: string;
  clientId?: string;
  orderFlags?: number;
  clobPairId?: string;
}

/**
 * yesono-embed 不直接调用此接口；保留签名是为了让 TradingPanel 端口代码能编译，
 * 调用方已被改写为 `tobApi.createOrder(...)`。如果被意外调用会抛错以便尽早发现。
 */
export async function createOrderNew(
  _params: CreateOrderParams
): Promise<CreateOrderResponse> {
  throw new Error(
    "[yesono-embed] createOrderNew should not be called; use tobApi.createOrder instead"
  );
}

/* ============================================================ */
/* CreateMarket flow (端口自 h2-market lib/api.ts)               */
/* ============================================================ */

export interface MarketGameOutcomeRequest {
  marketType: string;
  outcomes: string[];
}

export interface MarketNewGameReq {
  gameId: number;
  markets: MarketGameOutcomeRequest[];
}

export interface MarketOutcomeSimpleResp {
  id: number;
  name: string;
  outcomeKey: string;
  originalIndex: number;
}

export interface MarketBatchItemResp {
  marketId: number;
  eventId: number;
  type: string;
  option: string;
  line: number | null;
  question: string;
  outcomes: MarketOutcomeSimpleResp[];
}

export interface CandidateMarketItemResp {
  marketId: number;
  type: "MONEYLINE" | "TOTAL" | "SPREADS" | "BINARY" | string;
  option: string;
  question: string;
  line: number | null;
  status: string;
  outcomes: MarketOutcomeSimpleResp[];
}

export interface CandidateMarketsResp {
  eventId: number | null;
  eventSlug: string | null;
  eventTitle: string | null;
  markets: CandidateMarketItemResp[];
}

export interface MarketBatchFailedItemResp {
  option: string;
  type: string;
  line: number | null;
  reason: string;
}

export interface MarketBatchCreateResp {
  eventId: number;
  slug: string;
  title: string;
  markets: MarketBatchItemResp[];
  failed?: MarketBatchFailedItemResp[];
}

async function authJson<T>(
  url: string,
  init: RequestInit = {}
): Promise<{ code: number; success: boolean; msg: string; data: T }> {
  const resp = await authFetch(url, init);
  return (await resp.json()) as {
    code: number;
    success: boolean;
    msg: string;
    data: T;
  };
}

export async function createSportsMarkets(req: MarketNewGameReq) {
  return authJson<MarketBatchCreateResp>(`${AUTH_BASE_URL}/market/sports`, {
    method: "POST",
    body: JSON.stringify(req),
    headers: getLanguageHeaders(),
  });
}

export async function getGameplayOracle(category: string, gameplay: string) {
  return authJson<string>(
    `${AUTH_BASE_URL}/market/category/${encodeURIComponent(
      category
    )}/gameplay/${encodeURIComponent(gameplay)}/oracle`,
    { method: "GET", headers: getLanguageHeaders() }
  );
}

export async function getCandidateCreatedMarkets(candidateId: number | string) {
  return authJson<CandidateMarketsResp>(
    `${AUTH_BASE_URL}/market/candidate/${candidateId}/markets`,
    { method: "GET", headers: getLanguageHeaders() }
  );
}

export interface UploadResponse {
  id: string;
  key: string;
  contentType: string;
  url: string;
  etag: string;
  size: string;
  provider: string;
}

export async function uploadFile(file: File) {
  const accessToken = await getValidAccessToken();
  const formData = new FormData();
  formData.append("file", file);
  const resp = await fetch(`${API_HOST}/upload`, {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    body: formData,
  });
  return (await resp.json()) as {
    code: number;
    success: boolean;
    msg: string;
    data: UploadResponse;
  };
}

export interface ImageReviewData {
  status: boolean;
  error_message: string;
}

export async function reviewMarketImage(imageUrl: string) {
  const reviewHost =
    process.env.NEXT_PUBLIC_REVIEW_API_HOST || "https://review.yesono.trade";
  const token = await getValidAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["tk"] = token;
  const resp = await fetch(`${reviewHost}/review_api/review/v1/market/image/`, {
    method: "POST",
    headers,
    body: JSON.stringify({ image_url: imageUrl }),
  });
  return (await resp.json()) as {
    code: number;
    message: string;
    data: ImageReviewData;
  };
}
