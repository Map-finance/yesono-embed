import { useState, useEffect, useCallback } from 'react';
import { getMyOverview } from '@/lib/services/profitLossService';
import { mapTimeRangeToLeaderboardPeriod } from '@/lib/services/profitLossService';

export interface MyOverviewData {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  avatarGradient: string | null;
  profitLoss: number;
  volume: number;
}

export default function useMyOverview(
  isAuthenticated: boolean,
  timeRange: string
) {
  const [data, setData] = useState<MyOverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated) {
      setData(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const periodType = mapTimeRangeToLeaderboardPeriod(timeRange);
      const res = await getMyOverview(periodType);
      if (res.success && res.data) {
        const d = res.data;
        setData({
          rank: d.rank,
          userId: d.userId,
          userName: d.userName,
          avatarUrl: d.avatarUrl ?? null,
          avatarGradient: d.avatarGradient ?? null,
          profitLoss: typeof d.profitLoss === 'number' ? d.profitLoss : parseFloat(String(d.profitLoss)) || 0,
          volume: typeof d.volume === 'number' ? d.volume : parseFloat(String(d.volume)) || 0,
        });
      } else {
        setData(null);
      }
    } catch (err) {
      console.error('❌ [Leaderboard] 获取个人排名失败:', err);
      setError(null);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
