"use client";

/**
 * useMyMarketActivity - 当前市场我的成交历史(走 legacy router/order/list?status=filled,partially_filled)
 *
 * 把 OrderListItem 映射到 Activity 供 MyHistoryList 消费:
 *   side BUY/SELL          → type Buy/Sell
 *   outcome                → outcomeName
 *   avgFillPrice           → price
 *   filledSize             → shares
 *   placedAmount           → amount
 *   completedAt(ms 字符串)→ timestamp(ms 数字)
 *   orderId                → txHash("order:{id}" 占位,后续真实链 hash 由后端补)
 *
 * embed 适配:useAuthStore stub 直接取对象,不用 useShallow 选择器;
 * Activity 类型从 /pna hooks 复用(字段完全一致)。
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useAuthStore } from "@/lib/stores/authStore";
import { getOrderList, type OrderListItem } from "@/lib/api";
import type { Activity } from "@/app/pna/hooks/use-get-activity";
import { useLocale } from "@/lib/i18n";

const refreshTriggers = new Set<() => void>();

export function triggerMarketActivityRefresh() {
  refreshTriggers.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn("[useMyMarketActivity] refresh trigger error", e);
    }
  });
}

export interface UseMyMarketActivityResult {
  activities: Activity[];
  isLoading: boolean;
  refresh: () => Promise<void>;
}

function toActivity(
  item: OrderListItem,
  marketId: string | number,
  locale: string
): Activity {
  const sideKey = String(item.side).toLowerCase();
  const type: Activity["type"] = sideKey === "sell" ? "Sell" : "Buy";
  const price = Number(item.avgFillPrice);
  const shares = Number(item.filledSize);
  const amount = Number(item.placedAmount);
  const localizedQuestion =
    item.i18nData?.[locale]?.question || item.question || "";
  return {
    type,
    market: localizedQuestion,
    outcomeName: item.outcome ?? null,
    price: Number.isFinite(price) ? price : 0,
    shares: Number.isFinite(shares) ? shares : 0,
    amount: Number.isFinite(amount) ? amount : 0,
    timestamp: Number(item.completedAt) || 0,
    marketId: Number(marketId) || null,
    txHash: `order:${item.orderId}`,
  };
}

export function useMyMarketActivity(
  marketId: string | number | undefined,
  limit: number = 10
): UseMyMarketActivityResult {
  const { isAuthenticated } = useAuthStore();
  const { locale } = useLocale();

  const [rawItems, setRawItems] = useState<OrderListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const generationRef = useRef(0);
  const lastFetchedMarketIdRef = useRef<string | number | undefined>(undefined);

  const fetch = useCallback(async () => {
    if (!isAuthenticated || marketId == null) {
      setRawItems([]);
      lastFetchedMarketIdRef.current = undefined;
      return;
    }
    if (lastFetchedMarketIdRef.current !== marketId) {
      setRawItems([]);
      lastFetchedMarketIdRef.current = marketId;
    }
    const gen = ++generationRef.current;
    setIsLoading(true);
    try {
      const resp = await getOrderList({
        status: "filled,partially_filled",
        marketId,
        limit,
        offset: 0,
      });
      if (gen !== generationRef.current) return;
      if ((resp.code === 0 || resp.code === 200) && Array.isArray(resp.data)) {
        setRawItems(resp.data);
      }
    } catch (e) {
      console.warn("[useMyMarketActivity] fetch failed", e);
    } finally {
      if (gen === generationRef.current) setIsLoading(false);
    }
  }, [isAuthenticated, marketId, limit]);

  useEffect(() => {
    void fetch();
    refreshTriggers.add(fetch);
    return () => {
      refreshTriggers.delete(fetch);
    };
  }, [fetch]);

  const activities = useMemo<Activity[]>(() => {
    if (marketId == null) return [];
    return rawItems.map((it) => toActivity(it, marketId, locale));
  }, [rawItems, marketId, locale]);

  return {
    activities,
    isLoading,
    refresh: fetch,
  };
}
