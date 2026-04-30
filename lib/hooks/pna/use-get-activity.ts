/**
 * useGetActivity Hook
 * 获取用户活动记录 - 基于新的 /api/activity 接口
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getActivityList } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

export interface Activity {
    type: 'Buy' | 'Sell' | 'MERGE' | 'REDEEM' | 'DEPOSIT' | 'WITHDRAW';
    market: string;
    outcomeName: string | null;
    price: number;
    shares: number;
    amount: number;
    timestamp: number;
    marketId: number | null;
    txHash: string;
    // 后端实际还会带这几个字段（原 ActivityTable 用），但旧接口声明遗漏。
    icon?: string | null;
    eventSlug?: string | null;
    question?: string | null;
}

interface UseGetActivityOptions {
    limit?: number;
    offset?: number;
    enabled?: boolean;
    userId?: string;
}

export default function useGetActivity(options: UseGetActivityOptions = {}) {
    const { limit = 25, offset = 0, enabled = true, userId: targetUserId } = options;
    const { user, accessToken, isAuthenticated } = useAuthStore();
    const { locale } = useLocale();
    const userId = targetUserId || user?.userId || "";

    const [activities, setActivities] = useState<Activity[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchActivities = useCallback(async () => {
        if (!accessToken) return;

        setIsLoading(true);
        setError(null);

        try {
            // 使用统一的 API 方法
            const result = await getActivityList({
                limit,
                offset,
                userId: userId.toString(),
            });

            console.log('[useGetActivity] API Result:', result);

            if (result.code !== 200) {
                throw new Error(result.message || 'Failed to fetch activity');
            }

            // 兼容不同的数据返回格式
            let data = result.data;
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                data = data.list || data.records || data.data || [];
            }

            setActivities(Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error('[useGetActivity] Failed to fetch activity:', err);
            setError(err.message || 'Failed to fetch activity');
            setActivities([]);
        } finally {
            setIsLoading(false);
        }
    }, [limit, offset, accessToken, userId, locale]);

    // 初始加载
    useEffect(() => {
        if (enabled && isAuthenticated && accessToken) {
            fetchActivities();
        }
    }, [fetchActivities, enabled, isAuthenticated, accessToken]);

    // 提供手动刷新方法
    const refresh = useCallback(() => {
        fetchActivities();
    }, [fetchActivities]);

    return {
        activities,
        isLoading,
        error,
        refresh,
    };
}
