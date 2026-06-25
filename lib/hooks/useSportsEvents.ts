/**
 * useSportsEvents Hook - 体育赛事列表数据管理(SWR)
 * 基于 /api/sports/events 接口
 *
 * 取数迁移到 useSWRInfinite,与主列表 useEvents 对齐:
 *  - 按 query 缓存:切回(games/props tab、切联赛)秒返;revalidateOnFocus 保鲜
 *  - 按「视图」abort:切到新视图(tags/tab)时取消旧视图仍在途的请求;卸载全部 abort
 *  - keepPreviousData/persistSize 取默认 false → 切视图自动「清空→骨架」、分页回第 1 页
 */

import { useCallback, useMemo } from "react";
import useSWRInfinite from "swr/infinite";
import { getSportsEvents } from "@/lib/services/sportsEventService";
import { SportsEventDetail } from "@/types/sports";

export interface UseSportsEventsOptions {
  tags?: string;
  tab?: "games" | "props";
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

interface SportsPageKey {
  _scope: "sports-events";
  tags: string;
  tab: "games" | "props" | "";
  limit: number;
  page: number;
  offset: number;
}

function fetchSportsPage(key: SportsPageKey): Promise<SportsEventDetail[]> {
  return getSportsEvents({
    tags: key.tags,
    tab: key.tab || undefined,
    limit: key.limit,
    offset: key.offset,
  });
}

export function useSportsEvents(
  options: UseSportsEventsOptions = {}
): UseSportsEventsReturn {
  const { tags, tab, limit = DEFAULT_PAGE_SIZE, enabled = true } = options;

  const getKey = useCallback(
    (
      pageIndex: number,
      previousPageData: SportsEventDetail[] | null
    ): SportsPageKey | null => {
      // tags 为空或未启用 → 不请求
      if (!enabled || !tags) return null;
      // 上一页返回数 < limit → 没有更多
      if (previousPageData && previousPageData.length < limit) return null;
      return {
        _scope: "sports-events",
        tags,
        tab: tab ?? "",
        limit,
        page: pageIndex,
        offset: pageIndex * limit,
      };
    },
    [enabled, tags, tab, limit]
  );

  // 不做手动 abort(同 useEvents):SWR 丢弃过期结果即可,手动 abort 会污染缓存。
  const { data, error, size, setSize, isValidating, mutate } = useSWRInfinite<
    SportsEventDetail[]
  >(getKey, fetchSportsPage, {
    revalidateFirstPage: true,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
  });

  const events = useMemo<SportsEventDetail[]>(
    () => (data ? data.flat() : []),
    [data]
  );

  const lastPage = data ? data[data.length - 1] : undefined;
  const hasMore = lastPage ? lastPage.length >= limit : true;

  const isLoading = enabled && !!tags && !data && (isValidating || !error);
  const isLoadingMore =
    size > 1 && (!data || typeof data[size - 1] === "undefined") && isValidating;

  const loadMore = useCallback(async () => {
    if (!enabled || !tags || isLoadingMore || !hasMore) return;
    await setSize(size + 1);
  }, [enabled, tags, isLoadingMore, hasMore, setSize, size]);

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  return {
    events,
    isLoading,
    isLoadingMore,
    hasMore,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
    loadMore,
    refresh,
  };
}

export default useSportsEvents;
