/**
 * useGetPositions Hook
 * 获取用户持仓数据 - 基于新的 /api/positions/new 接口
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getPositions } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

export interface Position {
    id: string;
    question:string;
    marketId: number;
    market: string;
    outcome: string;
    shares: number;
    avgPrice: number;
    currentPrice: number;
    value: number;
    profit: number;
    profitPct: number;
    status: 'active' | 'closed';
    openedAt: string | null;
    closedAt: string | null;
    icon: string | null;
    canClaim: boolean;
    conditionId?: string;      // bytes32 conditionId
    marketNumericId?: string;  // 市场数字 ID
    yesTokenId?: string;       // YES Token ID
    noTokenId?: string;        // NO Token ID
    eventSlug?: string;        // 市场事件 slug
    unionKey?: string;         // 市场 unionKey，用于 /api/order/redeem 接口
}

interface UseGetPositionsNewOptions {
    limit?: number;
    offset?: number;
    enabled?: boolean;
    userId?: string;
}

export default function useGetPositions(options: UseGetPositionsNewOptions = {}) {
    const { limit = 25, offset = 0, enabled = true, userId: targetUserId } = options;
    const { user, accessToken, isAuthenticated } = useAuthStore();
    const { locale } = useLocale();
    const userId = targetUserId || user?.userId || "";

    const [positions, setPositions] = useState<Position[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);

    const fetchPositions = useCallback(async (): Promise<Position[]> => {
        if (!accessToken) return [];

        setIsLoading(true);
        setError(null);

        try {
            const result = await getPositions({
                limit,
                offset,
                userId: userId.toString(),
            });

            if (result.code !== 200) {
                throw new Error(result.message || 'Failed to fetch positions');
            }

            const data = result.data || [];
            setPositions(data);
            setHasFetched(true);
            return data;
        } catch (err: any) {
            console.error('[useGetPositionsNew] Failed to fetch positions:', err);
            setError(err.message || 'Failed to fetch positions');
            setPositions([]);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [limit, offset, accessToken, userId, locale]);

    // 只有在 enabled 且认证且有 token 且未请求过时才请求
    useEffect(() => {
        setHasFetched(false);
    }, [userId, limit, offset, locale]);

    useEffect(() => {
        if (enabled && isAuthenticated && accessToken && !hasFetched) {
            fetchPositions();
        }
    }, [enabled, isAuthenticated, accessToken, hasFetched, fetchPositions]);

    // 提供手动刷新方法，返回最新数据以便调用方做验证
    const refresh = useCallback((): Promise<Position[]> => {
        return fetchPositions();
    }, [fetchPositions]);

    return {
        positions,
        isLoading,
        error,
        refresh,
    };
}
