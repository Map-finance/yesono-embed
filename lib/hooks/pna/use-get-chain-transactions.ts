/**
 * useGetChainTransactions Hook
 * 获取用户链上交易记录 - 基于 /api/activity/chain-transactions 接口
 * 支持下滑加载更多
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { getChainTransactions } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

export interface ChainTransaction {
    type: 'MERGE' | 'REDEEM' | 'DEPOSIT' | 'WITHDRAW';
    market?: string;
    amount?: number;
    timestamp?: number;
    marketId?: number;
    txHash?: string;
}

interface UseGetChainTransactionsOptions {
    pageSize?: number;
    enabled?: boolean;
    userId?: string;
}

export default function useGetChainTransactions(options: UseGetChainTransactionsOptions = {}) {
    const { pageSize = 10, enabled = true, userId: targetUserId } = options;
    const { user, accessToken, isAuthenticated } = useAuthStore();
    const { locale } = useLocale();
    const userId = targetUserId || user?.userId || "";

    const [transactions, setTransactions] = useState<ChainTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const offsetRef = useRef(0);

    const fetchTransactions = useCallback(async (isLoadMore = false) => {
        if (!accessToken) return;

        if (isLoadMore) {
            setIsLoadingMore(true);
        } else {
            setIsLoading(true);
            offsetRef.current = 0;
            setHasMore(true);
        }
        setError(null);

        try {
            const result = await getChainTransactions({
                limit: pageSize,
                offset: offsetRef.current,
                userId: userId.toString(),
            });

            console.log('[useGetChainTransactions] API Result:', result);

            if (result.code !== 200) {
                throw new Error(result.message || 'Failed to fetch chain transactions');
            }

            let data = result.data;
            if (data && typeof data === 'object' && !Array.isArray(data)) {
                data = data.list || data.records || data.data || [];
            }

            const list = Array.isArray(data) ? data : [];

            if (list.length < pageSize) {
                setHasMore(false);
            }

            if (isLoadMore) {
                setTransactions(prev => [...prev, ...list]);
            } else {
                setTransactions(list);
            }

            offsetRef.current += list.length;
        } catch (err: any) {
            console.error('[useGetChainTransactions] Failed to fetch chain transactions:', err);
            setError(err.message || 'Failed to fetch chain transactions');
            if (!isLoadMore) {
                setTransactions([]);
            }
        } finally {
            setIsLoading(false);
            setIsLoadingMore(false);
        }
    }, [pageSize, accessToken, userId]);

    useEffect(() => {
        if (enabled && isAuthenticated && accessToken) {
            fetchTransactions(false);
        }
    }, [enabled, isAuthenticated, accessToken, fetchTransactions, locale]);

    const refresh = useCallback(() => {
        fetchTransactions(false);
    }, [fetchTransactions]);

    const loadMore = useCallback(() => {
        if (!isLoadingMore && hasMore) {
            fetchTransactions(true);
        }
    }, [fetchTransactions, isLoadingMore, hasMore]);

    return {
        transactions,
        isLoading,
        isLoadingMore,
        hasMore,
        error,
        refresh,
        loadMore,
    };
}
