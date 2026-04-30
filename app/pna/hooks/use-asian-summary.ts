/**
 * 亚盘持仓汇总
 * SWR 包装 lib/api.getUserOrderSummary：返回 marketCounts / marketValues。
 */

import useSWR from "swr";
import { getUserOrderSummary } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/authStore";

interface UseAsianSummaryOptions {
  userId?: string;
}

interface UseAsianSummaryResult {
  marketCounts: number;
  marketValues: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export default function useAsianSummary(
  options: UseAsianSummaryOptions = {}
): UseAsianSummaryResult {
  const { userId } = options;
  const { isAuthenticated, accessToken } = useAuthStore();

  const shouldFetch = isAuthenticated && Boolean(accessToken);
  const key = shouldFetch ? (["asian-summary", userId ?? ""] as const) : null;

  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    const res = await getUserOrderSummary(userId);
    return {
      marketCounts: Number(res?.data?.marketCounts ?? 0) || 0,
      marketValues: Number(res?.data?.marketValues ?? 0) || 0,
    };
  });

  return {
    marketCounts: data?.marketCounts ?? 0,
    marketValues: data?.marketValues ?? 0,
    isLoading,
    error: (error as Error) ?? null,
    refresh: () => void mutate(),
  };
}
