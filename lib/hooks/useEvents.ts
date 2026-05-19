/**
 * useEvents Hook - 事件列表数据管理
 * 基于 docs/API_HOME.md 文档
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getEvents,
  getCryptoEvents,
  getFinanceEvents,
} from "@/lib/services/homeService";
import { EventSummary, EventsQuery } from "@/types/home";
import { useLocale } from "@/lib/i18n";

export interface UseEventsOptions extends EventsQuery {
  enabled?: boolean;
  /** 指定 API 类型：'crypto' 时使用 /api/crypto，'finance' 时使用 /api/finance，默认使用 /api/events */
  apiType?: "crypto" | "finance" | "default";
  /** crypto 模式下的 slug 参数 */
  cryptoSlug?: string;
  /** crypto 模式下的模糊搜索 */
  cryptoSearchText?: string;
  /** crypto 模式下的排序字段 */
  cryptoOrderBy?: string;
  /** crypto 模式下是否升序 */
  cryptoAscending?: boolean;
  /** finance 模式下的 slug 参数 */
  financeSlug?: string;
  /** finance 模式下的模糊搜索 */
  financeSearchText?: string;
  /** finance 模式下的排序字段 */
  financeOrderBy?: string;
  /** finance 模式下是否升序 */
  financeAscending?: boolean;
  /** optional initial data from SSR */
  initialData?: any;
}

export interface UseEventsReturn {
  events: EventSummary[];
  total: number;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_PAGE_SIZE = 20;

export function useEvents(options: UseEventsOptions = {}): UseEventsReturn {
  const {
    enabled = true,
    limit = DEFAULT_PAGE_SIZE,
    apiType = "default",
    cryptoSlug,
    cryptoSearchText,
    cryptoOrderBy,
    cryptoAscending,
    financeSlug,
    financeSearchText,
    financeOrderBy,
    financeAscending,
    initialData,
    ...queryOptions
  } = options;

  // 统一的 fetch 函数，根据 apiType 调用不同的 API
  const fetchFn = useCallback(
    async (fetchLimit: number, fetchOffset: number) => {
      if (apiType === "crypto" && cryptoSlug) {
        return getCryptoEvents({
          slug: cryptoSlug,
          limit: fetchLimit,
          offset: fetchOffset,
          searchText: cryptoSearchText,
          orderBy: cryptoOrderBy,
          ascending: cryptoAscending,
        });
      }
      if (apiType === "finance" && financeSlug) {
        return getFinanceEvents({
          slug: financeSlug,
          limit: fetchLimit,
          offset: fetchOffset,
          searchText: financeSearchText,
          orderBy: financeOrderBy,
          ascending: financeAscending,
        });
      }
      return getEvents({
        ...queryOptionsRef.current,
        limit: fetchLimit,
        offset: fetchOffset,
      });
    },
    [
      apiType,
      cryptoSlug,
      cryptoSearchText,
      cryptoOrderBy,
      cryptoAscending,
      financeSlug,
      financeSearchText,
      financeOrderBy,
      financeAscending,
    ]
  );

  const [events, setEvents] = useState<EventSummary[]>(initialData?.events || []);
  const [total, setTotal] = useState(initialData?.total || 0);
  const [isLoading, setIsLoading] = useState(initialData ? false : true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(initialData?.nextOffset ?? (initialData?.events?.length || 0));
  const queryOptionsRef = useRef(queryOptions);
  const initialDataRef = useRef(initialData);
  const initialDataUsedRef = useRef(false);

  // 更新 queryOptions ref
  useEffect(() => {
    queryOptionsRef.current = queryOptions;
  }, [JSON.stringify(queryOptions)]);

  // 加载初始数据
  const loadInitialData = useCallback(async () => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    offsetRef.current = 0;

    try {
      const response = await fetchFn(limit, 0);

      const loadedEvents = response.events || [];
      setEvents(loadedEvents);
      setTotal(response.total || 0);
      // hasMore = true only if returned count equals limit (may have more pages)
      setHasMore(loadedEvents.length >= limit);
      offsetRef.current = response.nextOffset || loadedEvents.length;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, limit, fetchFn]);

  // 加载更多数据
  const loadMore = useCallback(async () => {
    if (!enabled || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);

    try {
      const response = await fetchFn(limit, offsetRef.current);

      const newEvents = response.events || [];
      setEvents((prev) => [...prev, ...newEvents]);
      // hasMore = true only if returned count equals limit (may have more pages)
      setHasMore(newEvents.length >= limit);
      offsetRef.current =
        response.nextOffset > offsetRef.current
          ? response.nextOffset
          : offsetRef.current + newEvents.length;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load more events"
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [enabled, limit, isLoadingMore, hasMore, fetchFn]);

  // 刷新数据
  const refresh = useCallback(async () => {
    await loadInitialData();
  }, [loadInitialData]);

  const { locale } = useLocale();

  useEffect(() => {
    if (initialDataRef.current && !initialDataUsedRef.current) {
      initialDataUsedRef.current = true;
      setHasMore((initialDataRef.current.events?.length || 0) >= limit);
      offsetRef.current = initialDataRef.current.nextOffset ?? (initialDataRef.current.events?.length || 0);
      return;
    }
    loadInitialData();
  }, [loadInitialData, JSON.stringify(queryOptions), locale, limit]);

  return {
    events,
    total,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
  };
}

export default useEvents;
