"use client";

/**
 * useMarketOrders - 当前市场我的「当前委托 / 历史委托」(走 legacy router/order/list)
 *
 * 接口:GET ${LEGACY_ROUTER_BASE_URL}/order/list?status=...&marketId=...
 *   - status="pending"               → 当前委托(仍在簿、未成交)
 *   - status="filled,partially_filled,canceled" → 历史委托
 *
 * embed 适配:
 *   - 改用 embed authStore stub 形态(直接 useAuthStore() 返对象,不用 useShallow 选择器)
 *
 * 全局刷新机制:下单 / 取消 / 成交后调 triggerMarketOrdersRefresh() 推所有挂载实例。
 * 不做常驻轮询;WS 推送上线后接 trigger 即可。
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useAuthStore } from "@/lib/stores/authStore";
import {
  getOrderList,
  adaptOrderItem,
  type UnfinishedAggregatedOrder,
} from "@/lib/api";
import { useCanceledOrdersStore } from "@/lib/stores/canceledOrdersStore";

// 全局刷新触发器
const refreshTriggers = new Set<() => void>();

export function triggerMarketOrdersRefresh() {
  refreshTriggers.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn("[useMarketOrders] refresh trigger error", e);
    }
  });
}

/** 订阅刷新信号(供 useEventPendingOrderCounts 等复用) */
export function onMarketOrdersRefresh(cb: () => void): () => void {
  refreshTriggers.add(cb);
  return () => {
    refreshTriggers.delete(cb);
  };
}

/**
 * 事件后「补刷」(settle-poll):取消/下单成功后一段时间内多刷几次,
 * 兜后端状态翻转(pending → canceled/filled)落库晚于事件的延迟。
 */
const settleRefreshTimers = new Set<ReturnType<typeof setTimeout>>();
export function scheduleOrdersSettleRefresh(
  delaysMs: number[] = [2000, 5000, 10000]
) {
  delaysMs.forEach((d) => {
    const timer = setTimeout(() => {
      settleRefreshTimers.delete(timer);
      triggerMarketOrdersRefresh();
    }, d);
    settleRefreshTimers.add(timer);
  });
}

export interface UseMarketOrdersResult {
  orders: UnfinishedAggregatedOrder[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

const PAGE_SIZE = 10;

export function useMarketOrders(
  marketId?: string | number | null,
  fallbackClobTokenIds?: string[] | null,
  status: string = "pending",
  enabled: boolean = true
): UseMarketOrdersResult {
  // embed authStore 是 stub(非 zustand selector 形态),直接调取整个对象
  const { isAuthenticated } = useAuthStore();

  const [rawOrders, setRawOrders] = useState<UnfinishedAggregatedOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const generationRef = useRef(0);
  const lastFetchedMarketIdRef = useRef<string | number | undefined>(undefined);

  const fetch = useCallback(async () => {
    if (!isAuthenticated || !enabled) {
      setRawOrders([]);
      setHasMore(false);
      lastFetchedMarketIdRef.current = undefined;
      return;
    }
    const fetchKey = marketId ?? "__ALL__";
    if (lastFetchedMarketIdRef.current !== fetchKey) {
      setRawOrders([]);
      setHasMore(true);
      lastFetchedMarketIdRef.current = fetchKey;
    }
    const gen = ++generationRef.current;
    setIsLoading(true);
    try {
      const resp = await getOrderList({
        status,
        ...(marketId != null ? { marketId } : {}),
        limit: PAGE_SIZE,
        offset: 0,
      });
      if (gen !== generationRef.current) return;
      if ((resp.code === 0 || resp.code === 200) && Array.isArray(resp.data)) {
        setRawOrders(resp.data.map(adaptOrderItem));
        setHasMore(resp.data.length >= PAGE_SIZE);
      }
    } catch (e) {
      console.warn("[useMarketOrders] fetch failed", e);
    } finally {
      if (gen === generationRef.current) setIsLoading(false);
    }
  }, [isAuthenticated, enabled, marketId, status]);

  const loadMore = useCallback(async () => {
    if (!isAuthenticated || !enabled || !hasMore || isLoading || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const offset = rawOrders.length;
      const resp = await getOrderList({
        status,
        ...(marketId != null ? { marketId } : {}),
        limit: PAGE_SIZE,
        offset,
      });
      if ((resp.code === 0 || resp.code === 200) && Array.isArray(resp.data)) {
        const seen = new Set(rawOrders.map((o) => String(o.orderId)));
        const fresh = resp.data
          .map(adaptOrderItem)
          .filter((o) => !seen.has(String(o.orderId)));
        if (fresh.length > 0) {
          setRawOrders((prev) => [...prev, ...fresh]);
        }
        if (resp.data.length < PAGE_SIZE || fresh.length === 0) {
          setHasMore(false);
        }
      }
    } catch (e) {
      console.warn("[useMarketOrders] loadMore failed", e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isAuthenticated, enabled, marketId, status, hasMore, isLoading, isLoadingMore, rawOrders]);

  useEffect(() => {
    void fetch();
    refreshTriggers.add(fetch);
    return () => {
      refreshTriggers.delete(fetch);
    };
  }, [fetch]);

  // 客户端兜底过滤:
  //  - 当前委托(pending)不展示 MARKET 单
  //  - 已取消单(乐观移除)仅对 pending 列表生效;历史委托保留
  //  - fallbackClobTokenIds 把全量返回过滤回该市场
  const canceled = useCanceledOrdersStore((s) => s.canceled);
  const isPendingList = String(status).toLowerCase().includes("pending");

  const orders = useMemo(() => {
    let result = rawOrders.filter((o) => {
      const isPending = String(o.status).toLowerCase() === "pending";
      const isMarket = String(o.orderType).toUpperCase() === "MARKET";
      if (isPending && isMarket) return false;
      if (isPendingList && canceled.has(String(o.orderId))) return false;
      return true;
    });
    if (fallbackClobTokenIds && fallbackClobTokenIds.length > 0) {
      const tokenSet = new Set(fallbackClobTokenIds.map(String));
      result = result.filter((o) => tokenSet.has(String(o.tokenId)));
    }
    return result;
  }, [rawOrders, fallbackClobTokenIds, isPendingList, canceled]);

  return {
    orders,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh: fetch,
  };
}
