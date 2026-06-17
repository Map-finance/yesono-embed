"use client";

/**
 * useOrderFills - 拉取单笔订单的成交明细(走 legacy router/order/fills?orderId=)
 *
 * 用于「订单列表展开行」场景:
 *   - 点击行展开 → enabled=true → 触发 fetch
 *   - 模块级缓存(orderId → fills),避免反复展开/收起重复拉
 */

import { useCallback, useEffect, useState } from "react";
import { getOrderFills, type OrderFillItem } from "@/lib/api";

const fillsCache = new Map<string, OrderFillItem[]>();

export function clearOrderFillsCache(orderId?: string | number) {
  if (orderId == null) {
    fillsCache.clear();
  } else {
    fillsCache.delete(String(orderId));
  }
}

interface UseOrderFillsOptions {
  enabled: boolean;
}

export function useOrderFills(
  orderId: string | number | null | undefined,
  options: UseOrderFillsOptions
) {
  const { enabled } = options;
  const key = orderId != null ? String(orderId) : null;

  const [fills, setFills] = useState<OrderFillItem[]>(() =>
    key && fillsCache.has(key) ? fillsCache.get(key)! : []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (): Promise<OrderFillItem[]> => {
    if (!key) return [];
    if (fillsCache.has(key)) {
      const cached = fillsCache.get(key)!;
      setFills(cached);
      return cached;
    }
    setIsLoading(true);
    setError(null);
    try {
      const resp = await getOrderFills(key);
      if ((resp.code === 0 || resp.code === 200) && Array.isArray(resp.data)) {
        fillsCache.set(key, resp.data);
        setFills(resp.data);
        return resp.data;
      }
      setFills([]);
      return [];
    } catch (e: any) {
      console.warn("[useOrderFills] fetch failed", e);
      setError(e?.message || "Failed to fetch fills");
      setFills([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [key]);

  useEffect(() => {
    if (!enabled || !key) return;
    void fetch();
  }, [enabled, key, fetch]);

  const refresh = useCallback(async () => {
    if (!key) return [];
    fillsCache.delete(key);
    return fetch();
  }, [key, fetch]);

  return { fills, isLoading, error, refresh };
}
