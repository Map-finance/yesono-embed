/**
 * useGetClosedPositions Hook
 * 获取用户已结束持仓数据 - 基于新的 /api/positions/closed-new 接口
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getClosedPositions } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

export interface ClosedPosition {
    market: string;
    question:string;
    outcome: string;
    result: string;       // "Won" | "Lost"
    totalBet: number;
    amountWon: number;
    profit: number;
    profitPct: number;
    icon: string | null;
    resolvedAt: number;   // Unix timestamp in seconds
    eventSlug?: string;
}

interface UseGetClosedPositionsNewOptions {
    limit?: number;
    offset?: number;
    enabled?: boolean;
    userId?: string;
}

export default function useGetClosedPositionsNew(options: UseGetClosedPositionsNewOptions = {}) {
    const { limit = 25, offset = 0, enabled = true, userId: targetUserId } = options;
    const { user, accessToken, isAuthenticated } = useAuthStore();
    const { locale } = useLocale();
    const userId = targetUserId || user?.userId || "";

    const [positions, setPositions] = useState<ClosedPosition[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);

    const fetchPositions = useCallback(async () => {
        if (!accessToken) return;

        setIsLoading(true);
        setError(null);

        try {
            const result = await getClosedPositions({
                limit,
                offset,
                userId: userId.toString(),
            });

            if (result.code !== 200) {
                throw new Error(result.message || 'Failed to fetch closed positions');
            }

            setPositions(result.data || []);
            setHasFetched(true);
        } catch (err: any) {
            console.error('[useGetClosedPositionsNew] Failed to fetch closed positions:', err);
            setError(err.message || 'Failed to fetch closed positions');
            setPositions([]);
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

    // 提供手动刷新方法
    const refresh = useCallback(() => {
        fetchPositions();
    }, [fetchPositions]);

    return {
        positions,
        isLoading,
        error,
        refresh,
    };
}
