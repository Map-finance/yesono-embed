/**
 * useGetOracleResultEvents - 获取用户市场创建记录
 * 使用 /api/market/created-record 接口
 * 仅针对当前登录用户，用于 PNA 页面的「市场创建记录」Tab
 *
 * 数据刷新策略（SWR）：
 * - 初次加载 + 翻页 + 语言切换 + 登录态变化自动 revalidate
 * - tab 失焦再回来自动 revalidate（revalidateOnFocus）
 * - 列表里存在 DEPLOYING / DEPLOYED 等过渡态时每 10s 轮询，
 *   全部进入终态后自动停止（refreshInterval 动态函数）
 * - 2s 内重复 key 去重（dedupingInterval）
 */

import { useCallback } from "react";
import useSWR from "swr";
import { useAuthStore } from "@/lib/stores/authStore";
import { getMarketCreatedRecords } from "@/lib/api";
import { useLocale } from "@/lib/i18n";

/** 事件下的单个市场记录 */
export interface MarketRecord {
  id?: string;
  eventId?: string;
  eventSlug?: string;
  source?: string;
  externalId?: string | null;
  question?: string;
  slug?: string;
  groupItemTitle?: string;
  conditionId?: string;
  questionId?: string;
  status?: string;
  active?: boolean;
  closed?: boolean;
  volume?: string | null;
  liquidity?: string | null;
  umaResolutionStatus?: string;
  rawOutcomes?: string;
  rawClobTokenIds?: string;
  rawOutcomePrice?: string;
  unionKey?: string;
  parentId?: string;
  marketType?: string;
  subType?: string;
  line?: number | null;
  exchangeId?: string | null;
  targetRule?: string | null;
  rowOutcomePrice?: string;
  submittedBy?: string;
  resolvedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
  i18nData?: Record<string, Record<string, string>>;
  image?: string | null;
  icon?: string | null;
}

/** 标签 */
export interface TagRecord {
  id?: string;
  label?: string;
  slug?: string;
}

/** 市场创建记录 - 事件级，与 /api/events/user 返回的 Event 实体对齐 */
export interface MarketCreatedRecord {
  id?: string;
  title?: string;
  slug?: string;
  description?: string;
  seriesId?: string | null;
  icon?: string | null;
  image?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string;
  active?: boolean;
  closed?: boolean;
  archived?: boolean;
  volume?: string | null;
  volume24hr?: string | null;
  liquidity?: string | null;
  featured?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
  tags?: TagRecord[];
  enableOrderBook?: boolean | null;
  acceptingOrders?: boolean | null;
  unionKey?: string;
  parentId?: string;
  markets?: MarketRecord[];
  cardType?: string | null;
  isLive?: boolean;
  isBookmarked?: boolean | null;
  subtitle?: string | null;
  secondaryLines?: any | null;
  stats?: any | null;
  favorite?: boolean;
  category?: string;
  /** 体育市场 candidateId（用于 gameId 和参与者查询） */
  candidateId?: string;
  /** 体育市场参与者 ID 列表 */
  participantIds?: string[];
  /** 兼容旧字段 */
  txHash?: string;
  /** Crypto 事件：交易所 ID */
  exchangeId?: string | null;
}

/** @deprecated 使用 MarketCreatedRecord 替代 */
export type OracleResultEvent = MarketCreatedRecord;

interface UseGetOracleResultEventsOptions {
  page?: number;
  size?: number;
  enabled?: boolean;
}

const SWR_KEY = "market-created-records";

interface FetchResult {
  items: MarketCreatedRecord[];
  totalCount: number;
}

async function fetchMarketCreatedRecords(
  _key: string,
  page: number,
  size: number,
  _locale: string
): Promise<FetchResult> {
  const result = await getMarketCreatedRecords({ page, size });
  if (result.code !== 200 && result.success !== true) {
    throw new Error((result as any).message || "Failed to fetch");
  }

  const data = (result as any).data;
  let items: MarketCreatedRecord[] = [];
  let totalCount = 0;

  if (Array.isArray(data)) {
    items = data;
  } else if (data && typeof data === "object") {
    items = data.data ?? data.list ?? data.records ?? [];
    const totalRaw = data.total ?? data.totalCount;
    totalCount =
      typeof totalRaw === "string" ? parseInt(totalRaw, 10) : totalRaw ?? 0;
    if (isNaN(totalCount)) totalCount = items.length;
  }

  return {
    items: Array.isArray(items) ? items : [],
    totalCount,
  };
}

export default function useGetOracleResultEvents(
  options: UseGetOracleResultEventsOptions = {}
) {
  const { page = 1, size = 20, enabled = true } = options;
  const { accessToken, isAuthenticated } = useAuthStore();
  const { locale } = useLocale();

  const swrKey =
    enabled && isAuthenticated && accessToken
      ? ([SWR_KEY, page, size, locale] as const)
      : null;

  const { data, error, isLoading, mutate } = useSWR<FetchResult>(
    swrKey,
    ([key, p, s, l]: readonly [string, number, number, string]) =>
      fetchMarketCreatedRecords(key, p, s, l),
    {
      // 每 10s 轮询一次 —— 覆盖"刚创建后等 dYdX 索引从 DEPLOYED 变 ACTIVE"场景
      // SWR 会自动在 tab 不可见时暂停（refreshWhenHidden 默认 false）
      refreshInterval: 10_000,
      revalidateOnFocus: true,
      dedupingInterval: 2_000,
      keepPreviousData: true,
    }
  );

  // 关键：refresh 必须是稳定引用，否则消费方的 useCallback([refresh, ...])
  // 每次 render 都 rebuild → 配合切语言时 I18nContext 的全 SWR mutate，
  // 会偶发触发 #185 (maximum update depth exceeded)。mutate 本身在 SWR
  // 内部对同一个 key 是稳定的。
  const refresh = useCallback(() => mutate(), [mutate]);

  return {
    list: data?.items ?? [],
    total: data?.totalCount ?? 0,
    isLoading,
    error: error ? ((error as Error).message || "Failed to fetch") : null,
    refresh,
  };
}
