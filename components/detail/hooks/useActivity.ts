/**
 * useActivity Hook - 交易活动数据管理
 * 基于 docs/API_TRADES_ALL.md 和 docs/API_Order_book_ws.md 实现
 * 
 * 功能:
 * - 从 REST API 加载历史交易数据 (滚动加载)
 * - 订阅 WebSocket 获取实时交易消息
 * - 合并显示交易活动列表
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  activityWS,
  getAllTrades,
  TradeRecord,
  TradeMessage,
} from '@/lib/services/orderBookService';

export interface UseActivityOptions {
  eventId: string;
  unionKey: string;
  eventSlug: string;
  enabled?: boolean;
  pageSize?: number;
}

export interface UseActivityReturn {
  trades: TradeRecord[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useActivity({
  eventId,
  unionKey,
  eventSlug,
  enabled = true,
  pageSize = 10, // 统一页大小:对齐后端单页上限 10(原 20 会让 hasMore=10>=20 误判到底)
}: UseActivityOptions): UseActivityReturn {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const offsetRef = useRef(0);
  const isSubscribedRef = useRef(false);
  const isLoadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);

  // 加载初始数据
  const loadInitialData = useCallback(async () => {
    if (!eventId) return;

    setIsLoading(true);
    setError(null);
    offsetRef.current = 0;

    try {
      const response = await getAllTrades(eventId, pageSize, 0);
      
      if (response.success) {
        setTrades(response.data || []);
        const more = (response.data?.length || 0) >= pageSize;
        hasMoreRef.current = more;
        setHasMore(more);
        offsetRef.current = response.data?.length || 0;
      } else {
        setError(response.msg);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trades');
    } finally {
      setIsLoading(false);
    }
  }, [eventId, pageSize]);

  // 加载更多数据（使用 ref 避免状态依赖导致 loadMore 引用变化，防止 IntersectionObserver 渲染循环）
  const loadMore = useCallback(async () => {
    if (!eventId || isLoadingMoreRef.current || !hasMoreRef.current) return;

    isLoadingMoreRef.current = true;
    setIsLoadingMore(true);

    try {
      const response = await getAllTrades(eventId, pageSize, offsetRef.current);
      
      if (response.success) {
        const newTrades = response.data || [];
        setTrades(prev => [...prev, ...newTrades]);
        const more = newTrades.length >= pageSize;
        hasMoreRef.current = more;
        setHasMore(more);
        offsetRef.current += newTrades.length;
      } else {
        setError(response.msg);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more trades');
    } finally {
      isLoadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [eventId, pageSize]);

  // 刷新数据
  const refresh = useCallback(async () => {
    await loadInitialData();
  }, [loadInitialData]);

  // 节流：批量收集 WS 推送的交易消息，定时刷新到 state（最多 1s 一次）
  const pendingTradesRef = useRef<TradeRecord[]>([]);
  const tradeThrottleRef = useRef<NodeJS.Timeout | null>(null);

  const flushPendingTrades = useCallback(() => {
    const pending = pendingTradesRef.current;
    if (pending.length > 0) {
      setTrades(prev => [...pending, ...prev]);
      pendingTradesRef.current = [];
    }
  }, []);

  // 处理实时交易消息（节流）
  const handleTradeMessage = useCallback((message: TradeMessage) => {
    const newTrade: TradeRecord = {
      userId: message.userId,
      name: message.name,
      profileImage: message.profileImage,
      outcome: message.outcome,
      price: message.price,
      side: message.side,
      size: message.size,
      timestamp: message.timestamp,
      assetId: message.assetId,
      hash:
        message.hash ??
        (message as any).transactionHash ??
        (message as any).transaction_hash ??
        (message as any).txHash ??
        undefined,
    };

    // 添加到待刷新队列
    pendingTradesRef.current.unshift(newTrade);

    // 节流：1s 内最多刷新一次 UI
    if (!tradeThrottleRef.current) {
      tradeThrottleRef.current = setTimeout(() => {
        tradeThrottleRef.current = null;
        flushPendingTrades();
      }, 1000);
    }
  }, [flushPendingTrades]);

  // 初始加载
  useEffect(() => {
    if (enabled && eventId) {
      loadInitialData();
    }
  }, [enabled, eventId, loadInitialData]);

  // 订阅 WebSocket 交易消息
  useEffect(() => {
    if (!enabled || !eventSlug) {
      return;
    }
    
    if (isSubscribedRef.current) {
      console.log('[useActivity] Already subscribed, skipping');
      return;
    }

    // 添加消息处理器（使用独立的 activityWS 实例）
    activityWS.addHandler('trade_message', handleTradeMessage);

    // 订阅交易消息（使用 event_slug）
    activityWS.subscribeTradeMessage(eventSlug)
      .then(() => {
        isSubscribedRef.current = true;
      })
      .catch((err) => {
        console.error('[useActivity] Failed to subscribe:', err);
      });

    return () => {
      activityWS.removeHandler('trade_message', handleTradeMessage);
      if (isSubscribedRef.current) {
        activityWS.unsubscribeTradeMessage(eventSlug);
        isSubscribedRef.current = false;
      }
      // 清理节流定时器，刷新剩余待处理消息
      if (tradeThrottleRef.current) {
        clearTimeout(tradeThrottleRef.current);
        tradeThrottleRef.current = null;
      }
      flushPendingTrades();
    };
  }, [enabled, eventSlug, handleTradeMessage, flushPendingTrades]);

  return {
    trades,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
  };
}

export default useActivity;
