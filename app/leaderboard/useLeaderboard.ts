import { useState, useEffect, useCallback } from 'react';
import {
  getLeaderboard,
  getVolumeLeaderboard,
  LeaderboardUser as ApiLeaderboardUser,
  mapTimeRangeToLeaderboardPeriod,
} from '@/lib/services/profitLossService';

export type LeaderboardMetric = 'profitLoss' | 'volume';

export interface LeaderboardUser {
  rank: number;
  name: string;
  avatarGradient: string;
  avatarUrl?: string | null;
  userId?: string;
  profitLoss: number;
  volume: number;
}

const GRADIENTS = [
  "linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)",
  "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
  "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)",
  "linear-gradient(135deg, #cfd9df 0%, #e2ebf0 100%)",
  "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #5ee7df 0%, #b490ca 100%)",
];

function transformApiUser(user: ApiLeaderboardUser, index: number): LeaderboardUser {
  return {
    rank: user.rank,
    name: user.userName || `User_${user.rank}`,
    avatarGradient: user.avatarGradient || GRADIENTS[index % GRADIENTS.length],
    avatarUrl: user.avatarUrl,
    userId: user.userId,
    profitLoss: parseFloat(String(user.profitLoss)) || 0,
    volume: parseFloat(String(user.volume)) || 0,
  };
}

export interface UseLeaderboardResult {
  data: LeaderboardUser[];
  topWinners: LeaderboardUser[];
  page: number;
  totalPages: number;
  total: number;
  isLoading: boolean;
  setPage: (page: number) => void;
  setTimeRange: (range: string) => void;
  setSearch: (search: string) => void;
  timeRange: string;
  search: string;
  refetch: () => void;
}

export default function useLeaderboard(
  initialTimeRange: string = 'All',
  metric: LeaderboardMetric = 'profitLoss',
  // 榜单走 authFetch(需 token)。首次进页面 token 可能还没水合 → 401 → 空列表。
  // 传入登录态,token 就绪(false→true)后自动重拉,修"第一次打开没数据"。
  isAuthenticated: boolean = false,
): UseLeaderboardResult {
  const [data, setData] = useState<LeaderboardUser[]>([]);
  const [topWinners, setTopWinners] = useState<LeaderboardUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRange, setTimeRange] = useState(initialTimeRange);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);

    try {
      const periodType = mapTimeRangeToLeaderboardPeriod(timeRange);
      // 主表格按当前指标走对应 endpoint(盈亏 / 交易量),服务端排序+分页;
      // Biggest Wins 始终用盈亏榜(它本身是"盈利最高")
      const fetchMain = metric === 'volume' ? getVolumeLeaderboard : getLeaderboard;

      const [mainRes, topRes] = await Promise.all([
        fetchMain({
          periodType,
          searchName: search || undefined,
          page,
          size: 20,
        }),
        search ? null : getLeaderboard({ periodType, page: 1, size: 10 }),
      ]);

      if (mainRes.success && mainRes.data) {
        const { list, totalPages: tp, total: t } = mainRes.data;
        const transformedData = list.map((user, index) => transformApiUser(user, index));
        setData(transformedData);
        setTotalPages(tp);
        setTotal(t);
      } else {
        setData([]);
        setTotalPages(0);
        setTotal(0);
      }

      if (topRes?.success && topRes?.data) {
        const transformed = topRes.data.list.map((user, index) => transformApiUser(user, index));
        setTopWinners(transformed);
      } else {
        setTopWinners([]);
      }
    } catch (err) {
      console.error('❌ [Leaderboard] 获取排行榜失败:', err);
      setData([]);
      setTopWinners([]);
      setTotalPages(0);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, timeRange, search, metric, isAuthenticated]);

  useEffect(() => {
    setPage(1);
  }, [search, timeRange, metric]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    topWinners,
    page,
    totalPages,
    total,
    isLoading,
    setPage,
    setTimeRange,
    setSearch,
    timeRange,
    search,
    refetch: fetchData,
  };
}
