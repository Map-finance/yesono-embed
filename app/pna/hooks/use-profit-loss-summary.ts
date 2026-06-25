import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import {
  getProfitLossSummary,
  ProfitLossSummary,
} from '@/lib/services/profitLossService';

/**
 * 拉取盈亏汇总（today / weekly / monthly / yearly / total），用于盈亏图头部
 * 默认值显示"对应窗口的总盈亏"。汇总跟 timeRange 无关，targetUserId / 登录态
 * 变化时才需要重拉。
 *
 * Embed 适配：与 use-profit-loss-chart 一致，仅在 isAuthenticated 时发起请求。
 * 同时支持 self（无 targetUserId）和他人主页（targetUserId）视图。
 */
export interface UseProfitLossSummaryResult {
  summary: ProfitLossSummary | null;
  isLoading: boolean;
  refetch: () => void;
}

export default function useProfitLossSummary(
  targetUserId?: string,
): UseProfitLossSummaryResult {
  const { isAuthenticated } = useAuthStore();
  const [summary, setSummary] = useState<ProfitLossSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    // 未认证时不发起请求，头部回退到曲线点 / 0
    if (!isAuthenticated) {
      setSummary(null);
      return;
    }

    setIsLoading(true);
    try {
      const response = await getProfitLossSummary(targetUserId);
      if (response.success && response.data) {
        setSummary(response.data);
      } else {
        setSummary(null);
      }
    } catch (err) {
      console.error('❌ [ProfitLossSummary] 获取失败:', err);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, targetUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { summary, isLoading, refetch: fetchData };
}
