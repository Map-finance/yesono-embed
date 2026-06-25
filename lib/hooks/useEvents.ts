/**
 * useEvents Hook - 事件列表数据管理
 * 基于 docs/API_HOME.md 文档
 *
 * 取数迁移到 SWR(useSWRInfinite):
 *  - 按 query 缓存 → 切回看过的分类秒开;revalidateOnFocus 切回标签页自动保鲜
 *  - key 不含 token/登录态 → 列表缓存稳定,不因登录态变化重拉整张 ~900kB 列表
 *  - keepPreviousData/persistSize 取默认(false) → 切分类自动「清空→骨架」、size 回第 1 页
 *
 * 收藏(embed 适配):本 fork 为「只读 embed」,无登录/钱包/真实收藏接口。
 *  保留 overrides / removedSlugs 内存叠加层用于乐观 UI(updateFavorite / removeEvent),
 *  但不发起任何真实 collected/auth 请求(collected 恒为空集),displayed favorite 完全由
 *  原始数据 + 本地 overrides 决定。叠加层 useMemo 计算,不动 SWR 缓存,降低回归风险。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWRInfinite from "swr/infinite";
import {
  getEvents,
  getCryptoEvents,
  getFinanceEvents,
} from "@/lib/services/homeService";
import { EventSummary, EventsQuery, EventsResp } from "@/types/home";
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
  /** 本地翻转某个事件的收藏标记(按 slug 或 id 匹配),无需重拉整张列表 */
  updateFavorite: (key: string, favorite: boolean) => void;
  /** 本地移除某个事件(用于「只看已收藏」视图下取消收藏后从列表剔除) */
  removeEvent: (key: string) => void;
}

const DEFAULT_PAGE_SIZE = 20;

/** useSWRInfinite 每页的 key:序列化后唯一标识一页请求。刻意不含 token/登录态。 */
interface EventsPageKey {
  _scope: "events";
  apiType: "crypto" | "finance" | "default";
  cryptoSlug?: string;
  cryptoSearchText?: string;
  cryptoOrderBy?: string;
  cryptoAscending?: boolean;
  financeSlug?: string;
  financeSearchText?: string;
  financeOrderBy?: string;
  financeAscending?: boolean;
  queryOptions: Record<string, unknown>;
  locale: string;
  limit: number;
  page: number;
  offset: number;
}

async function fetchEventsPage(key: EventsPageKey): Promise<EventsResp> {
  const { limit, offset } = key;
  if (key.apiType === "crypto" && key.cryptoSlug) {
    return getCryptoEvents({
      slug: key.cryptoSlug,
      limit,
      offset,
      searchText: key.cryptoSearchText,
      orderBy: key.cryptoOrderBy,
      ascending: key.cryptoAscending,
    });
  }
  if (key.apiType === "finance" && key.financeSlug) {
    return getFinanceEvents({
      slug: key.financeSlug,
      limit,
      offset,
      searchText: key.financeSearchText,
      orderBy: key.financeOrderBy,
      ascending: key.financeAscending,
    });
  }
  return getEvents({ ...key.queryOptions, limit, offset });
}

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

  const { locale } = useLocale();

  // queryOptions 是 rest 对象,每次渲染引用都变;用其 JSON 作为稳定标识,避免 getKey 抖动。
  const queryOptionsKey = JSON.stringify(queryOptions);

  // ============== 列表取数(useSWRInfinite) ==============
  const getKey = useCallback(
    (pageIndex: number, previousPageData: EventsResp | null): EventsPageKey | null => {
      if (!enabled) return null;
      // 上一页返回数 < limit → 没有更多,停止
      if (previousPageData && (previousPageData.events?.length ?? 0) < limit) {
        return null;
      }
      const offset =
        pageIndex === 0 ? 0 : previousPageData?.nextOffset ?? pageIndex * limit;
      return {
        _scope: "events",
        apiType,
        cryptoSlug,
        cryptoSearchText,
        cryptoOrderBy,
        cryptoAscending,
        financeSlug,
        financeSearchText,
        financeOrderBy,
        financeAscending,
        queryOptions,
        locale,
        limit,
        page: pageIndex,
        offset,
      };
    },
    // queryOptions 用其 JSON 作为依赖;其余基本类型直接列出。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      enabled,
      limit,
      apiType,
      cryptoSlug,
      cryptoSearchText,
      cryptoOrderBy,
      cryptoAscending,
      financeSlug,
      financeSearchText,
      financeOrderBy,
      financeAscending,
      locale,
      queryOptionsKey,
    ]
  );

  // 不做手动 abort:SWR 会丢弃过期 key 的结果(切分类/切页时旧结果不会被采用)。
  const { data, error, size, setSize, isValidating, mutate } =
    useSWRInfinite<EventsResp>(getKey, fetchEventsPage, {
      revalidateFirstPage: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      // keepPreviousData / persistSize 取默认 false:
      //   - 切分类 → 新 key → data 变 undefined → isLoading=true → 走骨架(清空→骨架)
      //   - size 回第 1 页(避开 persistSize 的分页错位)
      dedupingInterval: 5000,
      // 不设 refreshInterval:900kB 列表不轮询,靠 focus/reconnect 保鲜
      fallbackData: initialData ? [initialData as EventsResp] : undefined,
    });

  const rawEvents = useMemo<EventSummary[]>(
    () => (data ? data.flatMap((p) => p?.events ?? []) : []),
    [data]
  );

  const lastPage = data ? data[data.length - 1] : undefined;
  const hasMore = lastPage ? (lastPage.events?.length ?? 0) >= limit : true;

  // 首屏/切分类加载:无数据且在校验 → 骨架(配合 keepPreviousData:false)
  const isLoading = enabled && !data && (isValidating || !error);
  // 翻页加载:已请求第 size 页但尚未到手
  const isLoadingMore =
    size > 1 && (!data || typeof data[size - 1] === "undefined") && isValidating;

  // ============== 收藏叠加层(embed 适配,不动 SWR 缓存) ==============
  // overrides:本次会话手动翻转的收藏(可强制 true/false,优先级最高)。
  //   embed 无真实收藏接口,仅用于乐观 UI。跨分类/视图保留(同一事件全局一致)。
  const [overrides, setOverrides] = useState<Map<string, boolean>>(new Map());
  // removedSlugs:取消收藏后本地剔除。仅作用于「当前视图」,切换分类/筛选/语言时清空。
  const [removedSlugs, setRemovedSlugs] = useState<Set<string>>(new Set());
  const viewKey = `${apiType}|${cryptoSlug ?? ""}|${financeSlug ?? ""}|${queryOptionsKey}|${locale}`;
  useEffect(() => {
    setRemovedSlugs(new Set());
  }, [viewKey]);

  // 最终展示数据:在 SWR 原始数据上套用 本地 override / 剔除。
  // embed 无真实 collected/登录态来源,favorite 完全由原始数据 + 本地 overrides 决定。
  const events = useMemo<EventSummary[]>(() => {
    const computeFav = (e: EventSummary): boolean => {
      const k1 = e.slug || "";
      const k2 = String(e.id);
      if (overrides.has(k1)) return overrides.get(k1)!;
      if (overrides.has(k2)) return overrides.get(k2)!;
      return !!e.favorite;
    };

    let list = rawEvents;
    if (removedSlugs.size > 0) {
      list = list.filter(
        (e) => !removedSlugs.has(e.slug || "") && !removedSlugs.has(String(e.id))
      );
    }
    return list.map((e) => {
      const fav = computeFav(e);
      return fav === e.favorite ? e : { ...e, favorite: fav };
    });
  }, [rawEvents, overrides, removedSlugs]);

  const total = Math.max(0, (data?.[0]?.total ?? 0) - removedSlugs.size);

  // ============== 对外方法 ==============
  const loadMore = useCallback(async () => {
    if (!enabled || isLoadingMore || !hasMore) return;
    await setSize(size + 1);
  }, [enabled, isLoadingMore, hasMore, setSize, size]);

  const refresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const updateFavorite = useCallback((key: string, favorite: boolean) => {
    setOverrides((prev) => {
      const next = new Map(prev);
      next.set(key, favorite);
      return next;
    });
  }, []);

  const removeEvent = useCallback((key: string) => {
    setRemovedSlugs((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  return {
    events,
    total,
    isLoading,
    isLoadingMore,
    hasMore,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    loadMore,
    refresh,
    updateFavorite,
    removeEvent,
  };
}

export default useEvents;
