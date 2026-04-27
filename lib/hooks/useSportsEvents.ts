/**
 * useSportsEvents Hook - 体育赛事列表数据管理
 * 基于 /api/sports/events 接口
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getSportsEvents } from '@/lib/services/sportsEventService';
import { SportsEventDetail, SportsEventsQuery } from '@/types/sports';

export interface UseSportsEventsOptions {
  tags?: string;
  tab?: 'games' | 'props';
  limit?: number;
  enabled?: boolean;
}

export interface UseSportsEventsReturn {
  events: SportsEventDetail[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

const DEFAULT_PAGE_SIZE = 20;

export function useSportsEvents(options: UseSportsEventsOptions = {}): UseSportsEventsReturn {
  const {
    tags,
    tab,
    limit = DEFAULT_PAGE_SIZE,
    enabled = true,
  } = options;

  const [events, setEvents] = useState<SportsEventDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);

  const loadInitialData = useCallback(async () => {
    if (!enabled || !tags) {
      setIsLoading(false);
      setEvents([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    offsetRef.current = 0;

    try {
      const data = await getSportsEvents({ tags, tab, limit, offset: 0 });
      setEvents(data);
      setHasMore(data.length >= limit);
      offsetRef.current = data.length;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [enabled, tags, tab, limit]);

  const loadMore = useCallback(async () => {
    if (!enabled || !tags || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);

    try {
      const data = await getSportsEvents({
        tags,
        tab,
        limit,
        offset: offsetRef.current,
      });
      setEvents(prev => [...prev, ...data]);
      setHasMore(data.length >= limit);
      offsetRef.current += data.length;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more');
    } finally {
      setIsLoadingMore(false);
    }
  }, [enabled, tags, tab, limit, isLoadingMore, hasMore]);

  const refresh = useCallback(async () => {
    await loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  return {
    events,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
  };
}

export default useSportsEvents;
