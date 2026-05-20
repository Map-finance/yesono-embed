'use client';

/**
 * usePriceHistory - Hook for fetching price history data with polling
 * Based on API_GRAPH_DOC.md requirements
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  getPriceHistory, 
  Fidelity, 
  PriceHistoryData, 
  PricePoint,
  OrderBookEntry 
} from '@/lib/api';

export type TimeRange = '1H' | '6H' | '1D' | '1W' | '1M' | 'ALL';

interface PolymarketOrderbook {
  market: string;
  asset_id: string;
  timestamp: string;
  hash: string;
  bids: { price: string; size: string }[];
  asks: { price: string; size: string }[];
  min_order_size: string;
  tick_size: string;
  neg_risk: boolean;
}

export interface ChartDataPoint {
  timestamp: number;       // Unix timestamp in ms
  date: string;           // Formatted date string for display
  [marketId: string]: number | string; // Dynamic market values (percentage 0-100)
}

export interface UsePriceHistoryResult {
  data: ChartDataPoint[];
  loading: boolean;
  error: Error | null;
  currentPrices: Record<string, number>; // Latest price for each market (percentage)
  refetch: () => void;
}

// Get fidelity and polling interval based on time range
// Mapping: 1H->1MIN, 6H->5MINS, 1D->15MINS, 1W->1HOUR, 1M->4HOURS, ALL->skip
const getRangeConfig = (range: TimeRange): { 
  fidelity: Fidelity; 
  startTsOffset: number;  // Seconds to subtract from now
  pollingInterval: number; // Milliseconds
  skip: boolean; // Whether to skip fetching (for ALL)
} => {
  switch (range) {
    case '1H':
      return { 
        fidelity: '1MIN', 
        startTsOffset: 3600,  // 1 hour
        pollingInterval: 60000,  // 1 minute polling for ≤1h
        skip: false
      };
    case '6H':
      return { 
        fidelity: '5MINS', 
        startTsOffset: 6 * 3600,  // 6 hours
        pollingInterval: 300000,  // 5 minute polling
        skip: false
      };
    case '1D':
      return { 
        fidelity: '15MINS', 
        startTsOffset: 24 * 3600,  // 1 day
        pollingInterval: 300000,  // 5 minute polling for 1d
        skip: false
      };
    case '1W':
      return { 
        fidelity: '1HOUR', 
        startTsOffset: 7 * 24 * 3600,  // 1 week
        pollingInterval: 300000,
        skip: false
      };
    case '1M':
      return { 
        fidelity: '4HOURS', 
        startTsOffset: 30 * 24 * 3600,  // 1 month
        pollingInterval: 300000,
        skip: false
      };
    case 'ALL':
      return { 
        fidelity: '1DAY', 
        startTsOffset: 365 * 24 * 3600,
        pollingInterval: 300000,
        skip: false
      };
    default:
      return { 
        fidelity: '1HOUR', 
        startTsOffset: 24 * 3600,
        pollingInterval: 300000,
        skip: false
      };
  }
};

// 图表 x 轴标签统一按美东时区（与 TimeCapsule / 图表 tooltip 对齐），避免使用浏览器本地时区
const ET_TIME_ZONE = 'America/New_York';
const formatDate = (timestamp: number, range: TimeRange): string => {
  const d = new Date(timestamp);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET_TIME_ZONE,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const mon = get('month');
  const day = get('day');
  const year = get('year');
  const h12 = get('hour');
  const mm = get('minute');
  const ampm = get('dayPeriod');

  switch (range) {
    case '1H':
    case '6H':
      return `${h12}:${mm} ${ampm}`;
    case '1D':
    case '1W':
      return `${mon} ${day}, ${h12} ${ampm}`;
    case '1M':
      return `${mon} ${day}`;
    case 'ALL':
      return `${mon} ${year}`;
    default:
      return `${mon} ${day}`;
  }
};

// Polymarket CLOB fidelity mapping: TimeRange -> fidelity number
const getPolyFidelity = (range: TimeRange): number => {
  switch (range) {
    case '1H': return 1;
    case '6H': return 1;
    case '1D': return 5;
    case '1W': return 30;
    case '1M': return 180;
    case 'ALL': return 720;
    default: return 5;
  }
};

// Get max bid price from orderbook
const getMaxBidPrice = (bids: { price: string; size: string }[]): number => {
  if (!bids || bids.length === 0) return 0;
  return Math.max(...bids.map(b => parseFloat(b.price)));
};

// Fetch Polymarket orderbook
// 通过 /api/polymarket 代理转发到 clob.polymarket.com，
// 避免浏览器直连暴露用户 IP / referer；CSP connect-src 同源即可。
const fetchPolymarketOrderbook = async (polyAssetId: string): Promise<number | null> => {
  try {
    const response = await fetch(
      `/api/polymarket?endpoint=book&token_id=${encodeURIComponent(polyAssetId)}`
    );
    if (!response.ok) return null;

    const data: PolymarketOrderbook = await response.json();
    return getMaxBidPrice(data.bids);
  } catch (error) {
    console.warn('[usePriceHistory] Failed to fetch Polymarket orderbook:', error);
    return null;
  }
};

// Fetch Polymarket CLOB price history as fallback
const fetchPolymarketPriceHistory = async (
  polyAssetId: string,
  range: TimeRange,
  startTsOffset: number
): Promise<PricePoint[]> => {
  try {
    const startTs = Math.floor(Date.now() / 1000) - startTsOffset;
    const fidelity = getPolyFidelity(range);
    const url =
      `/api/polymarket?endpoint=prices-history` +
      `&startTs=${startTs}` +
      `&market=${encodeURIComponent(polyAssetId)}` +
      `&fidelity=${fidelity}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    if (data.history && Array.isArray(data.history)) {
      return data.history as PricePoint[];
    }
    return [];
  } catch (error) {
    console.warn('[usePriceHistory] Failed to fetch Polymarket price history:', error);
    return [];
  }
};

/**
 * Hook for fetching and managing price history data
 * @param marketIds - Array of market IDs to fetch (max 4 for main chart)
 * @param range - Time range for the chart
 * @param enabled - Whether polling is enabled (set false when tab is closed)
 */
export function usePriceHistory(
  marketIds: string[],
  range: TimeRange = '1D',
  enabled: boolean = true
): UsePriceHistoryResult {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Limit to max 4 markets — stabilize reference via JSON comparison
  const marketIdsKey = useMemo(() => JSON.stringify(marketIds.slice(0, 4)), [marketIds]);
  const limitedMarketIds = useMemo(() => JSON.parse(marketIdsKey) as string[], [marketIdsKey]);
  
  const { fidelity, startTsOffset, pollingInterval, skip } = useMemo(() => 
    getRangeConfig(range), 
    [range]
  );

  const fetchData = useCallback(async () => {
    if (limitedMarketIds.length === 0 || skip) {
      setData([]);
      setLoading(false);
      return;
    }


    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const now = Math.floor(Date.now() / 1000);
      const startTs = now - startTsOffset;

      // Fetch data for all markets in parallel.
      // 关键：用 allSettled 而非 all —— 后端某个 marketId 返回 400（典型场景：
      // 该市场已 CLOSED / CANCELLED / 数据缺失）时，allSettled 让其它市场的
      // 数据照常显示；all 会让任何一个失败 reject 整条 Promise，进入外层
      // catch 把 chart 整个挂成"错误"状态。
      const settled = await Promise.allSettled(
        limitedMarketIds.map(id => getPriceHistory(id, startTs, fidelity))
      );
      const responses = settled.map((s, i) => {
        if (s.status === 'fulfilled') return s.value;
        console.warn(
          `[usePriceHistory] market ${limitedMarketIds[i]} request rejected:`,
          s.reason,
        );
        return null; // 单个失败 → 后续 loop 跳过此条
      });

      // Process responses and merge into unified timeline
      const timeMap = new Map<number, ChartDataPoint>();
      const prices: Record<string, number> = {};
      // Capture a single "now" timestamp so all markets share the same latest point
      const latestTimestamp = Date.now();

      // Phase 1: Parse responses and collect Polymarket fallback tasks
      interface MarketParsed {
        marketId: string;
        history: PricePoint[];
        orderbook: any;
        havePoly: boolean;
        polyAssetId: string | undefined;
        needPolyHistory: boolean;
        needPolyOrderbook: boolean;
      }
      const parsed: MarketParsed[] = [];

      for (let i = 0; i < responses.length; i++) {
        const response = responses[i];
        const marketId = limitedMarketIds[i];

        if (!response || response.code !== 200 || !response.data) {
          console.warn(`[usePriceHistory] Failed to fetch market ${marketId}:`, response?.message);
          continue;
        }

        const { history, orderbook, havePoly, polyAssetId } = response.data;
        const effectiveHistory: PricePoint[] = (history && Array.isArray(history)) ? history : [];

        parsed.push({
          marketId,
          history: effectiveHistory,
          orderbook,
          havePoly: !!havePoly,
          polyAssetId: polyAssetId || undefined,
          needPolyHistory: effectiveHistory.length === 0 && !!havePoly && !!polyAssetId,
          needPolyOrderbook: !!havePoly && !!polyAssetId,
        });
      }

      // Phase 2: Fetch all Polymarket data in parallel (history + orderbook)
      const polyHistoryPromises = parsed.map(m =>
        m.needPolyHistory
          ? fetchPolymarketPriceHistory(m.polyAssetId!, range, startTsOffset)
          : Promise.resolve(null)
      );
      const polyOrderbookPromises = parsed.map(m =>
        m.needPolyOrderbook
          ? fetchPolymarketOrderbook(m.polyAssetId!)
          : Promise.resolve(null)
      );

      const [polyHistories, polyOrderbooks] = await Promise.all([
        Promise.all(polyHistoryPromises),
        Promise.all(polyOrderbookPromises),
      ]);

      // Phase 3: Merge data into timeline
      for (let i = 0; i < parsed.length; i++) {
        const m = parsed[i];
        let effectiveHistory = m.history;

        // Use Polymarket history fallback if needed
        if (m.needPolyHistory && polyHistories[i] && polyHistories[i]!.length > 0) {
          effectiveHistory = polyHistories[i]!;
        }

        // Process history points
        for (const point of effectiveHistory) {
          const timestamp = point.t * 1000;
          if (!timeMap.has(timestamp)) {
            timeMap.set(timestamp, {
              timestamp,
              date: formatDate(timestamp, range),
            });
          }
          const entry = timeMap.get(timestamp)!;
          entry[m.marketId] = point.p * 100;
        }

        // Insert latest orderbook price point
        let finalPrice = 0;
        if (m.havePoly) {
          const ourMaxBid = m.orderbook ? getMaxBidPrice(m.orderbook.bids) : 0;
          const polyMaxBid = polyOrderbooks[i] || 0;
          finalPrice = Math.max(ourMaxBid, polyMaxBid);

          if (finalPrice > 0 && effectiveHistory.length > 0) {
            if (!timeMap.has(latestTimestamp)) {
              timeMap.set(latestTimestamp, {
                timestamp: latestTimestamp,
                date: formatDate(latestTimestamp, range),
              });
            }
            const entry = timeMap.get(latestTimestamp)!;
            entry[m.marketId] = finalPrice * 100;
          }
        }

        // Store current price
        if (effectiveHistory.length > 0) {
          const lastHistoryPrice = effectiveHistory[effectiveHistory.length - 1].p * 100;
          prices[m.marketId] = finalPrice > 0 ? finalPrice * 100 : lastHistoryPrice;
        }
      }

      // Convert map to sorted array
      const chartData = Array.from(timeMap.values())
        .sort((a, b) => a.timestamp - b.timestamp);

      // Forward-fill: for each market, carry last known value to fill undefined gaps
      // This prevents recharts line breaks (recharts treats undefined as break, null as skip)
      for (const marketId of limitedMarketIds) {
        let lastVal: number | undefined;
        for (const point of chartData) {
          if (typeof point[marketId] === 'number') {
            lastVal = point[marketId] as number;
          } else if (lastVal !== undefined) {
            point[marketId] = lastVal;
          }
        }
      }

      setData(chartData);
      setCurrentPrices(prices);
      setError(null);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[usePriceHistory] Error fetching data:', err);
        setError(err as Error);
      }
    } finally {
      setLoading(false);
    }
  }, [limitedMarketIds, fidelity, startTsOffset, range, skip]);

  // Initial fetch and setup polling
  useEffect(() => {
    if (!enabled) {
      // Clear polling when disabled
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Initial fetch
    setLoading(true);
    fetchData();

    // Setup polling
    pollingRef.current = setInterval(fetchData, pollingInterval);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchData, pollingInterval, enabled]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    currentPrices,
    refetch,
  };
}

/**
 * Hook for single market price history (for sub-charts/outcome graphs)
 */
export function useSingleMarketPriceHistory(
  marketId: string | null,
  range: TimeRange = '1D',
  enabled: boolean = true
): UsePriceHistoryResult {
  const marketIds = useMemo(() => 
    marketId ? [marketId] : [], 
    [marketId]
  );
  
  return usePriceHistory(marketIds, range, enabled);
}

export default usePriceHistory;
