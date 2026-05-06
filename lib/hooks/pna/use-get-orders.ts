import { getUnfinishedOrders } from "@/lib/api";
import { useAuthStore } from "@/lib/stores//authStore";
import { useEffect, useState, useCallback } from "react";
import { useLocale } from "@/lib/i18n";

interface UseGetOrdersOptions {
  enabled?: boolean;
  userId?: string;
}

export default function useGetOrders(options: UseGetOrdersOptions = {}) {
  const { enabled = true, userId: targetUserId } = options;
  const { isAuthenticated, accessToken, user } = useAuthStore();
  const { locale } = useLocale();
  const userId = targetUserId || user?.userId || "";
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated || !accessToken) {
      setOrders([]);
      return;
    }

    setIsLoading(true);
    try {
      const res = await getUnfinishedOrders(userId);
      if ((res.code === 200 || res.code === 0) && res.data) {
        setOrders(res.data);
      } else {
        setOrders([]);
      }
      setHasFetched(true);
    } catch (err) {
      console.error("[useGetOrders] Failed to fetch orders:", err);
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, accessToken, userId, locale]);

  // 只有在 enabled 且认证且有 token 且未请求过时才请求
  useEffect(() => {
    setHasFetched(false);
  }, [userId, locale]);

  useEffect(() => {
    if (enabled && isAuthenticated && accessToken && !hasFetched) {
      fetchOrders();
    }
  }, [enabled, isAuthenticated, accessToken, hasFetched, fetchOrders]);

  return {
    orders,
    isLoading,
    refresh: fetchOrders
  };
}
