/**
 * 亚盘 - 交易记录
 * SWR 包装 lib/api.getUserTransactions
 */

import useSWR from "swr";
import { getUserTransactions } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/authStore";
import type { ApiTransactionRecord } from "@/types/pna";

interface UseAsianTransactionsOptions {
  page?: number;
  size?: number;
}

interface UseAsianTransactionsResult {
  rows: ApiTransactionRecord[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export default function useAsianTransactions(
  options: UseAsianTransactionsOptions = {}
): UseAsianTransactionsResult {
  const { page = 1, size = 25 } = options;
  const { isAuthenticated, accessToken } = useAuthStore();

  const shouldFetch = isAuthenticated && Boolean(accessToken);
  const key = shouldFetch ? (["asian-transactions", page, size] as const) : null;

  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    const res = await getUserTransactions(page, size);
    const records = (res?.data?.records ?? []) as ApiTransactionRecord[];
    const total = (res?.data?.total ?? 0) as number;
    return { records, total };
  });

  return {
    rows: data?.records ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: (error as Error) ?? null,
    refresh: () => void mutate(),
  };
}
