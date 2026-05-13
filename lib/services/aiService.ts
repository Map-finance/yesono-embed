/**
 * AI Service - AI市场优化和审核服务
 * 基于 docs/API_AI.md 接口文档
 */

import { getValidAccessToken, getLanguageHeaders } from '../api';
import { getAuthApiUrl } from '@/lib/config/authApiUrl';

const REVIEW_API_HOST = process.env.NEXT_PUBLIC_REVIEW_API_HOST || 'https://review.yesono.trade';
// Base URL for review/AI APIs (host + /review_api prefix)
const AI_API_BASE = `${REVIEW_API_HOST}/review_api`;
const AUTH_API_BASE = getAuthApiUrl('/api');

/** 获取 AI 接口请求头，包含 tk 鉴权 token */
async function getAIHeaders(): Promise<Record<string, string>> {
  const token = await getValidAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['tk'] = token;
  return headers;
}

/**
 * 从 JWT token 的 payload（base64）中解析 walletAddress
 * JWT 结构: header.payload.signature，payload 为 base64url 编码的 JSON
 * payload 示例: {"id":2,"type":"access","payload":"{\"walletAddress\":\"0x...\",\"smartAccountAddress\":\"0x...\"}", ...}
 */
export function getWalletAddressFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    // base64url → base64 → JSON
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const decoded = typeof atob !== 'undefined'
      ? atob(padded)
      : Buffer.from(padded, 'base64').toString('utf8');
    const payload = JSON.parse(decoded);
    // payload.payload 是内嵌的 JSON 字符串
    if (payload.payload) {
      const inner = typeof payload.payload === 'string'
        ? JSON.parse(payload.payload)
        : payload.payload;
      if (inner.walletAddress) return inner.walletAddress as string;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 获取钱包地址：优先从 authStore.user.walletAddress 取，其次从 token 解析
 */
export async function getWalletAddress(): Promise<string | null> {
  try {
    const { useAuthStore } = await import('../stores/authStore');
    const user = useAuthStore.getState().user;
    if (user?.walletAddress) return user.walletAddress;
    // fallback: 从 token 解析
    const token = await getValidAccessToken();
    if (token) return getWalletAddressFromToken(token);
    return null;
  } catch {
    return null;
  }
}

// ============== 类型定义 ==============

/** AI优化请求 */
export interface AISupplementRequest {
  market_title: string;
}

/** AI优化响应 */
export interface AISupplementResponse {
  code: number;
  message: string;
  error_dlt: string;
  data: {
    success: boolean;
    error: string;
    raw_market_title: string;
    market_title: string;
    market_desc: string;
    resolution_time: number; // Unix timestamp
  };
}

/** AI审核请求 */
export interface AIReviewRequest {
  market_title: string;
  market_desc: string;
  resolution_time: number; // Unix timestamp
}

/** AI审核响应中的市场结果数据 */
export interface AIMarketResultData {
  market_title: string;
  market_desc: string;
  subject: string;
  action: string;
  condition_operator: string;
  condition_value: number;
  condition_unit: string;
  resolution_time: string;
}

/** AI审核响应中的审核结果 */
export interface AIReviewResult {
  id: number;
  type: string;
  market_title: string;
  market_desc: string;
  unique_key: string;
  subject: string;
  action: string;
  resolution_time: string;
  match_id: string;
  market_value: string;
  market_sub_type: string;
  status: 'approved' | 'rejected' | 'pending';
  used_time: string | null;
  created_time: string;
  updated_time: string;
}

/** AI审核响应 */
export interface AIReviewResponse {
  code: number;
  message: string;
  error_dlt: string;
  data: {
    status: 'success' | 'failed';
    error_message: string;
    ai_score_result: {
      score: number;
    };
    market_result: {
      success: boolean;
      error: string;
      data: AIMarketResultData;
    };
    review_result: AIReviewResult;
  };
}

/** 市场标签 */
export interface MarketTag {
  name: string;
  slug: string;
}

/** 市场选项 */
export interface MarketOutcomeReq {
  name: string;
}

/** 创建通用市场请求 - 基于 API_CUSTOM.md */
export interface CreateGeneralMarketRequest {
  event: string;           // 事件标题 (required)
  question: string;        // 市场问题 (required)
  eventId?: number;        // 事件id (optional)
  description?: string;    // 描述 (optional)
  period?: string;         // period (optional)
  tags: MarketTag[];       // 标签列表 (required)
  marketType: 'BINARY';    // 市场类型 (required)
  subType?: string;        // 市场子类型 (optional)
  marketValue?: number;    // 盘口数值 (optional)
  submittedBy: string;     // 创建者地址 (required)
  outcomes?: MarketOutcomeReq[]; // 选项列表 (required)
  image?: string;          // 市场图片URL (optional)
}

/** 市场选项响应 */
export interface MarketOutcomeResp {
  id: number;
  marketId: number;
  name: string;
  outcomeKey: string;
  price: string;
  tokenId: string;
  originalIndex: number;
}

/** 创建通用市场响应 - 基于 API_CUSTOM.md */
export interface CreateGeneralMarketResponse {
  code: number;
  success: boolean;
  data: {
    marketId: number;
    eventId: number;
    eventSlug: string;
    outcomes: MarketOutcomeResp[];
    description: string;
    question: string;
    questionSlug: string;
    resData: {
      p1: string;
      p2: string;
      p3: string;
    };
  };
  msg: string;
}

// ============== API 函数 ==============

/**
 * AI自动补全市场标题和描述
 * POST /review/v1/market/crypto/general/supplement
 */
export async function aiSupplementMarket(
  request: AISupplementRequest
): Promise<AISupplementResponse['data']> {
  const response = await fetch(`${AI_API_BASE}/review/v1/market/crypto/general/supplement`, {
    method: 'POST',
    headers: await getAIHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`AI supplement failed: ${response.status}`);
  }

  const result: AISupplementResponse = await response.json();
  
  if (result.code !== 2000) {
    throw new Error(result.message || result.error_dlt || 'AI supplement failed');
  }

  if (!result.data.success) {
    throw new Error(result.data.error || 'AI supplement failed');
  }

  return result.data;
}

/**
 * AI市场审核
 * POST /review/v1/market/crypto/general
 */
export async function aiReviewMarket(
  request: AIReviewRequest
): Promise<AIReviewResponse['data']> {
  const response = await fetch(`${AI_API_BASE}/review/v1/market/crypto/general`, {
    method: 'POST',
    headers: await getAIHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`AI review failed: ${response.status}`);
  }

  const result: AIReviewResponse = await response.json();
  
  if (result.code !== 2000) {
    throw new Error(result.message || result.error_dlt || 'AI review failed');
  }

  if (result.data.status !== 'success') {
    throw new Error(result.data.error_message || 'AI review failed');
  }

  return result.data;
}

/**
 * 创建通用市场
 * POST /api/market/create
 * 基于 API_CUSTOM.md
 */
export async function createGeneralMarket(
  request: CreateGeneralMarketRequest
): Promise<CreateGeneralMarketResponse> {
  const response = await fetch(`${AUTH_API_BASE}/market/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Create general market failed: ${response.status}`);
  }

  const result: CreateGeneralMarketResponse = await response.json();
  
  if (!result.success) {
    throw new Error(result.msg || 'Create general market failed');
  }

  return result;
}

// ============== 事件补充/审核 API ==============

/** 事件补充请求 */
export interface EventSupplementRequest {
  event_title: string;
}

/** 事件补充响应 */
export interface EventSupplementResponse {
  success: boolean;
  error: string;
  raw_event_title: string;
  event_title: string;
  event_desc: string;
  resolution_time: number; // Unix timestamp
}

/** 事件市场补充请求中的市场项 */
export interface MarketSupplementItem {
  id: number;
  keyword: string;
}

/** 事件市场补充请求 */
export interface EventMarketSupplementRequest {
  event_title: string;
  event_desc: string;
  resolution_time: string; // ISO 8601
  markets: MarketSupplementItem[];
}

/** 事件市场补充响应中的市场项 */
export interface MarketSupplementResultItem {
  id: number;
  keyword: string;
  title: string;
  desc: string;
}

/** 事件市场补充响应 */
export interface EventMarketSupplementResponse {
  success: boolean;
  error: string;
  markets: MarketSupplementResultItem[];
}

/** 事件审核请求中的市场项 */
export interface EventReviewMarketItem {
  id: number;
  keyword: string;
  title: string;
  desc: string;
}

/** 事件审核请求 */
export interface EventReviewRequest {
  event_id?: number;
  event_title?: string;
  event_desc?: string;
  resolution_time?: string; // ISO 8601
  markets: EventReviewMarketItem[];
}

/** 事件审核响应 - 事件结果 */
export interface EventReviewEventResult {
  success: boolean;
  event_title: string;
  event_desc: string;
  event_error: string;
  repeat_event_id: number | null;
}

/** 事件审核响应 - 市场结果项 */
export interface EventReviewMarketResultItem {
  id: number;
  title: string;
  desc: string;
  market_error: string;
  repeat_id: number | null;
}

/** 事件审核响应 - 市场结果 */
export interface EventReviewMarketResult {
  markets: EventReviewMarketResultItem[];
}

/** 事件审核响应 */
export interface EventReviewResponse {
  event_result: EventReviewEventResult;
  market_result: EventReviewMarketResult;
}

/** Tag 响应 */
export interface TagItem {
  id: string;
  label: string;
  slug: string;
}

/** 创建通用市场 V2 请求 (PUT /api/market) */
export interface CreateMarketV2Request {
  eventId?: number;
  eventTitle?: string;
  tags?: string[];
  marketType: string;
  slug?: string;
  commonResolutionDate: number; // 毫秒戳
  image?: string;
  description?: string;
  submittedBy: string;
  outcomes: {
    name: string;       // keyword
    question: string;   // title
    slug?: string;
    image?: string;
    description?: string; // desc
  }[];
}

/** 创建通用市场 V2 响应 */
export interface CreateMarketV2Response {
  code: number;
  success: boolean;
  data: {
    eventId: number;
    slug: string;
    title: string;
    markets: {
      marketId: number;
      eventId: number;
      type: string;
      option: string;
      line: number;
      question: string;
      outcomes: {
        id: number;
        name: string;
        outcomeKey: string;
        originalIndex: number;
      }[];
    }[];
  };
  msg: string;
}

/**
 * 事件补充描述
 * POST /v1/event/supplement
 */
export async function eventSupplement(
  request: EventSupplementRequest
): Promise<EventSupplementResponse> {
  const response = await fetch(`${AI_API_BASE}/review/v1/event/supplement`, {
    method: 'POST',
    headers: await getAIHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Event supplement failed: ${response.status}`);
  }

  const result = await response.json();
  // 接口可能有 code/data 包装，也可能直接返回
  const data = result.data || result;
  if (!data.success) {
    throw new Error(data.error || 'Event supplement failed');
  }
  return data;
}

/**
 * 事件市场标题描述补充
 * POST /v1/event/market/supplement
 */
export async function eventMarketSupplement(
  request: EventMarketSupplementRequest
): Promise<EventMarketSupplementResponse> {
  const response = await fetch(`${AI_API_BASE}/review/v1/event/market/supplement`, {
    method: 'POST',
    headers: await getAIHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Event market supplement failed: ${response.status}`);
  }

  const result = await response.json();
  const data = result.data || result;
  if (data.success === false) {
    throw new Error(data.error || 'Event market supplement failed');
  }
  return data;
}

/**
 * 审核事件和市场
 * POST /v1/event/
 */
export async function eventReview(
  request: EventReviewRequest
): Promise<EventReviewResponse> {
  const response = await fetch(`${AI_API_BASE}/review/v1/event/`, {
    method: 'POST',
    headers: await getAIHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Event review failed: ${response.status}`);
  }

  const result = await response.json();
  const data = result.data || result;
  return data as EventReviewResponse;
}

/**
 * 查询 Tags
 * GET /api/market/tags
 */
export async function getMarketTags(label?: string): Promise<TagItem[]> {
  const params = new URLSearchParams();
  if (label) params.append('label', label);
  const url = `${AUTH_API_BASE}/market/tags${params.toString() ? `?${params.toString()}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Get market tags failed: ${response.status}`);
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.msg || 'Get market tags failed');
  }
  return result.data || [];
}

/**
 * 创建通用市场 V2
 * PUT /api/market
 */
export async function createGeneralMarketV2(
  request: CreateMarketV2Request
): Promise<CreateMarketV2Response> {
  const token = await getValidAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${AUTH_API_BASE}/market/common`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Create market V2 failed: ${response.status}`);
  }

  const result: CreateMarketV2Response = await response.json();
  if (!result.success) {
    throw new Error(result.msg || 'Create market V2 failed');
  }
  return result;
}

// ============== 审核记录 API ==============

/** 创建审核记录请求 */
export interface CreateReviewRecordRequest {
  wallet: string;
  metadata?: Record<string, any>;
  input: EventReviewRequest;
}

/** 创建审核记录响应 */
export interface CreateReviewRecordResponse {
  id: number;
}

/** 审核记录列表请求 */
export interface ReviewRecordListRequest {
  wallet: string;
  status?: 'pending' | 'approved' | 'rejected';
  page?: number;
  page_size?: number;
  order?: string;
}

/** 审核记录项 */
export interface ReviewRecordItem {
  id: number;
  wallet: string;
  metadata: Record<string, any>;
  input: EventReviewRequest;
  result: EventReviewResponse | Record<string, never>;
  status: 'pending' | 'approved' | 'rejected';
  created_time: string;
  updated_time: string;
}

/** 审核记录列表响应 */
export interface ReviewRecordListResponse {
  data: ReviewRecordItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * 创建审核记录
 * POST /review/v1/event/review_record/create
 * wallet 字段使用真实钱包地址（walletAddress），而非智能合约地址（smartAccountAddress）
 */
export async function createReviewRecord(
  request: CreateReviewRecordRequest
): Promise<CreateReviewRecordResponse> {
  // 确保使用 walletAddress 而非 smartAccountAddress
  const walletAddress = await getWalletAddress();
  const body = { ...request, wallet: walletAddress || request.wallet };
  const response = await fetch(`${AI_API_BASE}/review/v1/event/review_record/create`, {
    method: 'POST',
    headers: await getAIHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Create review record failed: ${response.status}`);
  }

  const result = await response.json();
  if (result.code !== 2000) {
    throw new Error(result.message || 'Create review record failed');
  }
  return result.data;
}

/** 更新审核记录请求 */
export interface UpdateReviewRecordRequest {
  id: number;
  metadata?: Record<string, any>;
  input?: any;
}

/**
 * 更新审核记录
 * POST /review/v1/event/review_record/update
 */
export async function updateReviewRecord(
  request: UpdateReviewRecordRequest
): Promise<void> {
  const response = await fetch(`${AI_API_BASE}/review/v1/event/review_record/update`, {
    method: 'POST',
    headers: await getAIHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`Update review record failed: ${response.status}`);
  }

  const result = await response.json();
  if (result.code !== 2000) {
    throw new Error(result.message || 'Update review record failed');
  }
}

/**
 * 标记审核记录已使用（已创建市场）
 * POST /review/v1/event/review_record/update/used
 * 注意：此接口调用失败不应阻塞主流程
 * wallet 字段使用真实钱包地址（walletAddress），而非智能合约地址（smartAccountAddress）
 */
export async function markReviewRecordUsed(
  id: number,
  wallet: string,
): Promise<void> {
  // 确保使用 walletAddress 而非 smartAccountAddress
  const walletAddress = (await getWalletAddress()) || wallet;
  const response = await fetch(`${AI_API_BASE}/review/v1/event/review_record/update/used`, {
    method: 'POST',
    headers: await getAIHeaders(),
    body: JSON.stringify({ id, wallet: walletAddress }),
  });

  if (!response.ok) {
    throw new Error(`Mark review record used failed: ${response.status}`);
  }

  const result = await response.json();
  if (result.code !== 2000) {
    throw new Error(result.message || 'Mark review record used failed');
  }
}

/**
 * 获取审核记录列表
 * GET /review/v1/event/review_record/list?wallet=xxx&page=1&page_size=20
 * wallet 字段使用真实钱包地址（walletAddress），而非智能合约地址（smartAccountAddress）
 */
export async function getReviewRecordList(
  request: ReviewRecordListRequest
): Promise<ReviewRecordListResponse> {
  // 确保使用 walletAddress 而非 smartAccountAddress
  const walletAddress = (await getWalletAddress()) || request.wallet;
  const params = new URLSearchParams();
  params.set('wallet', walletAddress);
  if (request.page != null) params.set('page', String(request.page));
  if (request.page_size != null) params.set('page_size', String(request.page_size));

  const response = await fetch(
    `${AI_API_BASE}/review/v1/event/review_record/list?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        ...getLanguageHeaders(),
        ...(await getAIHeaders()),
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Get review records failed: ${response.status}`);
  }

  const result = await response.json();
  if (result.code !== 2000) {
    throw new Error(result.message || 'Get review records failed');
  }
  return result.data;
}

// ============== 工具函数 ==============

/**
 * 将时间戳转换为日期字符串 (YYYY-MM-DD)
 * 自动检测秒级或毫秒级时间戳
 */
export function timestampToDateString(timestamp: number): string {
  // 自动检测：如果 > 1e12 认为是毫秒级
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const date = new Date(ms);
  return date.toISOString().split('T')[0];
}

/**
 * 将日期字符串转换为毫秒级时间戳
 */
export function dateStringToTimestamp(dateString: string): number {
  return new Date(dateString).getTime();
}

/**
 * 格式化日期显示
 * 自动检测秒级或毫秒级时间戳
 */
export function formatDate(timestamp: number): string {
  const ms = timestamp > 1e12 ? timestamp : timestamp * 1000;
  const date = new Date(ms);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}
