/**
 * 亚盘 Order Book hook
 * SWR 包装 lib/api.getUserOrders。
 */

import useSWR from "swr";
import { getUserOrders, type UserOrder } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/authStore";

interface UseAsianOrderBookOptions {
  page?: number;
  size?: number;
}

interface UseAsianOrderBookResult {
  rows: UserOrder[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export default function useAsianOrderBook(
  options: UseAsianOrderBookOptions = {}
): UseAsianOrderBookResult {
  const { page = 1, size = 25 } = options;
  const { isAuthenticated, accessToken } = useAuthStore();

  const shouldFetch = isAuthenticated && Boolean(accessToken);
  const key = shouldFetch ? (["asian-orders", page, size] as const) : null;

  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    const res = await getUserOrders(page, size);
    return {
      records: res?.data?.records ?? [],
      total: res?.data?.total ?? 0,
    };
  });

  return {
    rows: data?.records ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: (error as Error) ?? null,
    refresh: () => void mutate(),
  };
}
