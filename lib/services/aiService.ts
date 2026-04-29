import { getLanguageHeaders, getValidAccessToken } from '../api';

const REVIEW_API_HOST = process.env.NEXT_PUBLIC_REVIEW_API_HOST || 'https://review.yesono.trade';
const AI_API_BASE = `${REVIEW_API_HOST}/review_api`;

/** 获取 AI 接口请求头，包含 tk 鉴权 token */
async function getAIHeaders(): Promise<Record<string, string>> {
  const token = await getValidAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['tk'] = token;
  return headers;
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

/** 事件审核响应 - 事件结果 */
export interface EventReviewEventResult {
  success: boolean;
  event_title: string;
  event_desc: string;
  event_error: string;
  repeat_event_id: number | null;
}

/** 事件审核响应 */
export interface EventReviewResponse {
  event_result: EventReviewEventResult;
  market_result: EventReviewMarketResult;
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


/** 审核记录列表请求 */
export interface ReviewRecordListRequest {
  wallet: string;
  status?: 'pending' | 'approved' | 'rejected';
  page?: number;
  page_size?: number;
  order?: string;
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
    } catch (e) {
      console.warn('[aiService] Failed to parse wallet address from payload', e);
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
  } catch (e) {
    console.warn('[aiService] Failed to resolve wallet address', e);
    return null;
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