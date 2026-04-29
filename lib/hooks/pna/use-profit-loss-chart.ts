import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  getProfitLossStatistics,
  transformToChartData,
  mapTimeRangeToStatisticsPeriod,
  ChartDataPoint,
} from '@/lib/services/profitLossService';

export interface UseProfitLossChartResult {
  chartData: ChartDataPoint[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export default function useProfitLossChart(timeRange: string, targetUserId?: string): UseProfitLossChartResult {
  const { isAuthenticated } = useAuthStore();
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    // 未认证时直接显示 0，不使用模拟数据，不发起请求
    if (!isAuthenticated) {
      setChartData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('📈 [ProfitLoss] 开始获取盈亏统计数据...', {
        isAuthenticated,
        timeRange
      });

      const periodType = mapTimeRangeToStatisticsPeriod(timeRange);
      const response = await getProfitLossStatistics(periodType, targetUserId);

      console.log('📈 [ProfitLoss] API 响应:', response);

      if (response.success && response.data) {
        if (response.data.length === 0) {
          console.log('📈 [ProfitLoss] 无数据，清空图表');
          setChartData([]);
        } else {
          const transformedData = transformToChartData(response.data, periodType);
          setChartData(transformedData);
          console.log('✅ [ProfitLoss] 数据加载成功:', { count: transformedData.length });
        }
      } else {
        console.warn('⚠️ [ProfitLoss] API 返回失败，显示 0:', response.msg);
        setError(null);
        setChartData([]);
      }
    } catch (err) {
      console.error('❌ [ProfitLoss] 获取盈亏统计失败:', err);
      setError(null);
      // Fallback to empty data on error
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, timeRange, targetUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    chartData,
    isLoading,
    error,
    refetch: fetchData,
  };
}
