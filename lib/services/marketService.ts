/**
 * 市场创建 API 服务层
 * 基于 docs/API_MARKET.md
 */

import {
  ApiResponse,
  Pagination,
  TagResp,
  CandidateResp,
  CandidateDetailResp,
  CandidateQuery,
  CreateMarketReq,
  MarketCreateResp,
  ReviewSportsMarketReq,
  ReviewSportsMarketResp,
  CreateMarketReqV2,
  CreateMarketRespV2,
  ConfirmMarketReq,
} from '@/types/market';
import { authFetch, getLanguageHeaders, getValidAccessToken } from '../api';
import { getAuthApiHost } from '@/lib/config/authApiUrl';

// API 基础配置 - 直接访问，不使用代理
const API_BASE_URL = getAuthApiHost();

// 直接访问 API
const getApiUrl = (path: string) => {
  return `${API_BASE_URL}${path}`;
};

/**
 * 获取一级分类列表
 * GET /api/market/category
 */
export async function getCategories(locale?: string): Promise<TagResp[]> {
  const url = getApiUrl('/api/market/category');
  const languageHeaders = locale ? { 'Accept-Language': locale } : getLanguageHeaders();

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...languageHeaders,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.status}`);
  }

  const result: ApiResponse<TagResp[]> = await response.json();

  if (!result.success) {
    throw new Error(result.msg || 'Failed to fetch categories');
  }

  return result.data || [];
}

/**
 * 获取候选事件列表
 * GET /api/market/candidate
 */
export async function getCandidates(query: CandidateQuery = {}): Promise<Pagination<CandidateResp>> {
  const params = new URLSearchParams();
  params.append('status', 'SCHEDULED');
  if (query.offset !== undefined) params.append('offset', String(query.offset));
  if (query.limit !== undefined) params.append('limit', String(query.limit));
  if (query.key) params.append('key', query.key);
  if (query.slug) params.append('slug', query.slug);
  if (query.startDate !== undefined) params.append('startDate', String(query.startDate));
  if (query.endDate !== undefined) params.append('endDate', String(query.endDate));

  const url = getApiUrl(`/api/market/candidate?${params.toString()}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getLanguageHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch candidates: ${response.status}`);
  }

  const result: ApiResponse<Pagination<CandidateResp>> = await response.json();

  if (!result.success) {
    throw new Error(result.msg || 'Failed to fetch candidates');
  }

  return result.data || { page: 0, size: 0, total: 0, data: [] };
}

/**
 * 获取候选事件详情
 * GET /api/market/candidate/{candidateId}
 */
export async function getCandidateDetail(candidateId: number): Promise<CandidateDetailResp> {
  const url = getApiUrl(`/api/market/candidate/${candidateId}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...getLanguageHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch candidate detail: ${response.status}`);
  }

  const result: ApiResponse<CandidateDetailResp> = await response.json();

  if (!result.success) {
    throw new Error(result.msg || 'Failed to fetch candidate detail');
  }

  return result.data;
}

/**
 * 创建市场 (旧版)
 * POST /api/market
 */
export async function createMarket(req: CreateMarketReq): Promise<MarketCreateResp> {
  // 直接访问 API
  const url = `${API_BASE_URL}/api/market`;

  console.log('[marketService] createMarket POST to:', url);
  console.log('[marketService] createMarket body:', JSON.stringify(req));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  console.log('[marketService] createMarket response status:', response.status);

  if (!response.ok) {
    throw new Error(`Failed to create market: ${response.status}`);
  }

  const result: ApiResponse<MarketCreateResp> = await response.json();

  if (!result.success) {
    throw new Error(result.msg || 'Failed to create market');
  }

  return result.data;
}

// ============== 新版市场创建 API (API_MARKET2.md) ==============

/**
 * 审核体育市场
 * POST /market/v1/market/sports/
 * 返回 unique_key 用于后续创建市场
 */
export async function reviewSportsMarket(req: ReviewSportsMarketReq): Promise<ReviewSportsMarketResp> {
  const reviewHost = process.env.NEXT_PUBLIC_REVIEW_API_HOST || 'https://review.yesono.trade';
  const url = `${reviewHost}/review_api/review/v1/market/sports/`;

  const token = await getValidAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['tk'] = token;

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(req),
  });

  console.log('[marketService] reviewSportsMarket response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[marketService] reviewSportsMarket error:', errorText);
    throw new Error(`审核失败: ${response.status}`);
  }

  const result = await response.json();

  if (result.code !== 2000) {
    throw new Error(result.message || '审核失败');
  }

  return result.data;
}

/**
 * 创建市场 (新版)
 * POST /api/markets/create
 */
export async function createMarketV2(req: CreateMarketReqV2): Promise<CreateMarketRespV2> {
  const url = getApiUrl('/api/market');

  console.log('[marketService] createMarketV2 POST to:', url);
  console.log('[marketService] createMarketV2 body:', JSON.stringify(req));

  const response = await authFetch(url, {
    method: 'POST',
    body: JSON.stringify(req),
  });

  console.log('[marketService] createMarketV2 response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[marketService] createMarketV2 error:', errorText);
    throw new Error(`创建市场失败: ${response.status}`);
  }

  const result = await response.json();

  if (result.code !== 200) {
    throw new Error(result.message || '创建市场失败');
  }

  return result.data;
}

/**
 * 批量确认市场
 * POST /api/market/confirm
 */
export async function confirmMarkets(reqs: import('@/types/market').ConfirmMarketBatchItem[]): Promise<boolean> {
  const url = getApiUrl('/api/market/confirm');

  const response = await authFetch(url, {
    method: 'POST',
    body: JSON.stringify(reqs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[marketService] confirmMarkets error:', errorText);
    throw new Error(`确认市场失败: ${response.status}`);
  }

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.msg || '确认市场失败');
  }

  return result.data;
}

/**
 * 确认市场
 * PUT /api/market/{marketId}/confirm
 */
export async function confirmMarket(marketId: string, req: ConfirmMarketReq): Promise<boolean> {
  const url = getApiUrl(`/api/market/${marketId}/confirm`);

  console.log('[marketService] confirmMarket PUT to:', url);
  console.log('[marketService] confirmMarket body:', JSON.stringify(req));

  const response = await authFetch(url, {
    method: 'PUT',
    body: JSON.stringify(req),
  });

  console.log('[marketService] confirmMarket response status:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[marketService] confirmMarket error:', errorText);
    throw new Error(`确认市场失败: ${response.status}`);
  }

  const result = await response.json();

  if (result.code !== 200) {
    throw new Error(result.message || '确认市场失败');
  }

  return result.data;
}

// ============== Crypto 市场创建 API ==============

export interface CryptoCoin {
  id?: string | number;
  symbol: string;
  name: string;
  icon?: string;
}

export interface CryptoExchange {
  id: string;
  name: string;
  icon?: string;
}

/**
 * 获取支持的加密货币列表
 * GET /api/crypto/coins
 */
export async function getCryptoCoins(params?: { search?: string; limit?: number }): Promise<CryptoCoin[]> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.limit !== undefined) query.append('limit', String(params.limit));

  const url = getApiUrl(`/api/crypto/coins${query.toString() ? '?' + query.toString() : ''}`);

  const response = await authFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`Failed to fetch crypto coins: ${response.status}`);
  }

  const result = await response.json();

  if (result.code !== 200 || !Array.isArray(result.data)) {
    return [];
  }

  return result.data as CryptoCoin[];
}

/**
 * 获取支持的交易所列表
 * GET /api/crypto/exchanges
 */
export async function getCryptoExchanges(params?: { search?: string; limit?: number }): Promise<CryptoExchange[]> {
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.limit !== undefined) query.append('limit', String(params.limit));

  const url = getApiUrl(`/api/crypto/exchanges${query.toString() ? '?' + query.toString() : ''}`);

  const response = await authFetch(url, { method: 'GET' });

  if (!response.ok) {
    throw new Error(`Failed to fetch crypto exchanges: ${response.status}`);
  }

  const result = await response.json();

  if (result.code !== 200 || !Array.isArray(result.data)) {
    return [];
  }

  return result.data as CryptoExchange[];
}

/** 已创建的加密事件 */
export interface CreatedCryptoEvent {
  eventId: number;
  eventTitle: string;
  eventType: string; // "ABOVE" | "BELOW" | "PRICE_RANGE" | "HIT_PRICE" | "FIRST_TO_HIT"
  description?: string;
  image?: string;
  commonResolutionDate: number | string;
  coinId: number | string;
  coinSymbol?: string;
  tagsSlug?: string[];
}

/**
 * 获取已创建的加密事件列表
 * GET /api/events/crypto/created
 */
export async function getCreatedCryptoEvents(params?: { searchText?: string; limit?: number; offset?: number }): Promise<CreatedCryptoEvent[]> {
  const query = new URLSearchParams();
  if (params?.searchText) query.append('searchText', params.searchText);
  if (params?.limit !== undefined) query.append('limit', String(params.limit));
  if (params?.offset !== undefined) query.append('offset', String(params.offset));
  const url = getApiUrl(`/api/events/crypto/created${query.toString() ? '?' + query.toString() : ''}`);
  const response = await authFetch(url, { method: 'GET' });
  if (!response.ok) return [];
  const result = await response.json();
  if (result.code !== 200) return [];
  const data = result.data;
  if (Array.isArray(data)) return data as CreatedCryptoEvent[];
  if (data && Array.isArray(data.data)) return data.data as CreatedCryptoEvent[];
  return [];
}

/** 事件已有市场项 */
export interface EventMarketItem {
  id: string;
  eventId: string;
  eventSlug?: string;
  question: string;
  type?: string;
  slug?: string;
  marketValue?: number;
  targetRule?: string;
  groupItemTitle?: string;
  status?: string;
  active?: boolean;
  closed?: boolean;
}

/**
 * 获取某个事件下已有的市场列表
 * GET /api/market/event/{eventId}/markets
 */
export async function getEventMarkets(eventId: number | string): Promise<EventMarketItem[]> {
  const url = getApiUrl(`/api/market/event/${eventId}/markets`);
  const response = await authFetch(url, { method: 'GET' });
  if (!response.ok) return [];
  const result = await response.json();
  if (result.code !== 200) return [];
  if (Array.isArray(result.data)) return result.data as EventMarketItem[];
  return [];
}

export interface CreateCryptoMarketReq {
  eventId?: number;
  eventTitle?: string;
  eventType: string;
  description?: string;
  image?: string;
  commonResolutionDate?: number;
  submittedBy?: string;
  coinId?: number;
  coinSymbol: string;
  exchangeId?: string;
  tagsSlug?: string[];
  markets: Array<{
    question: string;
    marketValue?: number;
    targetRule?: string;
    outcomes?: string[];
    description?: string;
  }>;
}

export interface CreateCryptoMarketResp {
  eventId: number;
  slug: string;
  title: string;
  markets: Array<{
    marketId: number;
    eventId: number;
    type: string;
    option: string;
    line: number;
    question: string;
    outcomes: Array<{ id: number; name: string; outcomeKey: string; originalIndex: number }>;
  }>;
}

/**
 * 创建加密货币市场
 * POST /api/market/crypto
 */
export async function createCryptoMarket(req: CreateCryptoMarketReq): Promise<CreateCryptoMarketResp> {
  const url = getApiUrl('/api/market/crypto');
  const response = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.msg || `Failed to create crypto market: ${response.status}`);
  }
  const result = await response.json();
  if (result.code !== 200) {
    throw new Error(result.msg || 'Failed to create crypto market');
  }
  return result.data as CreateCryptoMarketResp;
}

// ============== React Hooks ==============

import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocale } from '@/lib/i18n';

/**
 * 获取分类列表 Hook
 */
export function useCategories() {
  const { locale } = useLocale();
  const [categories, setCategories] = useState<TagResp[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCategories(locale);
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    load();
  }, [load]);

  return { categories, isLoading, error, reload: load };
}

/**
 * 获取候选事件列表 Hook
 */
export function useCandidates(initialQuery: CandidateQuery = {}) {
  const [candidates, setCandidates] = useState<CandidateResp[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<CandidateQuery>(initialQuery);

  // 用 ref 保存最新 query / candidates / total，使回调引用稳定
  const queryRef = useRef(query);
  queryRef.current = query;
  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;
  const totalRef = useRef(total);
  totalRef.current = total;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  const load = useCallback(async (newQuery?: CandidateQuery) => {
    const q = newQuery || queryRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCandidates(q);
      setCandidates(data.data);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load candidates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const search = useCallback((key: string) => {
    const newQuery = { ...queryRef.current, key, offset: 0 };
    setQuery(newQuery);
    load(newQuery);
  }, [load]);

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current || candidatesRef.current.length >= totalRef.current) return;

    const newQuery = { ...queryRef.current, offset: candidatesRef.current.length };
    setIsLoading(true);
    try {
      const data = await getCandidates(newQuery);
      setCandidates(prev => [...prev, ...data.data]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filterBySlug = useCallback((slug: string) => {
    const newQuery = { ...queryRef.current, slug, offset: 0 };
    setQuery(newQuery);
    load(newQuery);
  }, [load]);

  const filterByDateRange = useCallback((startDate?: number, endDate?: number) => {
    const newQuery = { ...queryRef.current, startDate, endDate, offset: 0 };
    setQuery(newQuery);
    load(newQuery);
  }, [load]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    candidates,
    total,
    isLoading,
    error,
    hasMore: candidates.length < total,
    search,
    loadMore,
    filterBySlug,
    filterByDateRange,
    reload: () => load(),
  };
}

/**
 * 创建市场 Hook
 */
export function useCreateMarket() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MarketCreateResp | null>(null);

  const submit = useCallback(async (req: CreateMarketReq) => {
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const data = await createMarket(req);
      setResult(data);
      return data;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create market';
      setError(errorMsg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsSubmitting(false);
    setError(null);
    setResult(null);
  }, []);

  return { submit, isSubmitting, error, result, reset };
}
