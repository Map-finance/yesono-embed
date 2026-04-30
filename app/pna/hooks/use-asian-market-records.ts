/**
 * 亚盘 - 开盘记录
 * SWR 包装 lib/api.getUserMarketRecords
 */

import useSWR from "swr";
import { getUserMarketRecords } from "@/lib/api";
import { useAuthStore } from "@/lib/stores/authStore";

/**
 * 后端返回每条记录的字段（基于原 OpenRecordsTab 推断）。
 * 真实接口可能字段更多，未列字段忽略即可。
 */
export interface AsianMarketRecord {
  id?: string | number;
  serialNumber?: string;
  league?: string;
  event?: string;
  handicapType?: string;
  handicap?: string;
  homeTeamPool?: string;
  awayTeamPool?: string;
  setupFee?: string;
  createTime?: string | number;
  eventStatus?: string;
  matchResult?: string;
}

interface UseAsianMarketRecordsOptions {
  page?: number;
  size?: number;
  catalog?: string;
}

interface UseAsianMarketRecordsResult {
  rows: AsianMarketRecord[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export default function useAsianMarketRecords(
  options: UseAsianMarketRecordsOptions = {}
): UseAsianMarketRecordsResult {
  const { page = 1, size = 25, catalog = "football" } = options;
  const { isAuthenticated, accessToken } = useAuthStore();

  const shouldFetch = isAuthenticated && Boolean(accessToken);
  const key = shouldFetch
    ? (["asian-market-records", page, size, catalog] as const)
    : null;

  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    const res = await getUserMarketRecords(page, size, catalog);
    const records = (res?.data?.records ?? []) as AsianMarketRecord[];
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
