'use client';

/**
 * SpotOrderbook - 订单簿组件
 * 基于文档 docs/API_Order_book_ws.md 实现
 * 显示买卖盘深度、价差、中间价
 * 
 * 数据源架构:
 * - WebSocket: 实时增量更新 (orderBook 频道) - 优先使用
 * - 增量更新: price 为唯一键，size=0 时删除
 * - 显示: price * 100, total = size * price
 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, ArrowUpDown, Info } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import {
  OrderBookWebSocket,
  OrderBookStore,
  OrderBookSnapshot,
  PriceChangeMessage,
  ProcessedOrderBook,
  formatDisplayPrice,
  formatSize,
} from '@/lib/services/orderBookService';
import {
  getOutcomeLabel,
  normalizeBinaryOutcomeLabel,
  sortOutcomesByOriginalIndex,
} from "@/lib/utils/outcomes";

// 本地订单簿条目类型
interface LocalOrderbookEntry {
  price: number;
  displayPrice: number;
  size: number;
  total: number;
  cumulative: number;
}

// 本地订单簿数据类型
interface LocalOrderbookData {
  bids: LocalOrderbookEntry[];
  asks: LocalOrderbookEntry[];
  midPrice: number;
  spread: number;
  spreadPercent: number;
}

interface MarketOutcomeData {
  tokenId?: string;
  tradingPair?: string;
  originalIndex?: number;
  name?: string;
  outcome?: string;
  outcomeKey?: string;
}

interface SpotOrderbookProps {
  ticker: string;
  basePrice?: number;
  label?: string;
  /** Market numeric ID for WS subscription */
  marketId?: string;
  /** Market source: 'POLYMARKET' | 'INTERNAL' etc */
  marketSource?: string;
  /** Market outcomes array for asset_id matching */
  marketOutcomes?: MarketOutcomeData[];
  selectedSide?: 'yes' | 'no';
  onSideChange?: (side: 'yes' | 'no') => void;
}

// 使用种子生成伪随机数
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// 生成模拟订单簿数据
const generateMockOrderbook = (basePrice: number, depth: number = 15): LocalOrderbookData => {
  const asks: LocalOrderbookEntry[] = [];
  const bids: LocalOrderbookEntry[] = [];
  
  // 生成卖单 (asks) - 价格从低到高
  let askCumulative = 0;
  for (let i = 0; i < depth; i++) {
    const priceIncrement = 0.001 + seededRandom(basePrice * 100 + i) * 0.002;
    const price = basePrice + (i + 1) * priceIncrement;
    const size = Math.round(seededRandom(basePrice * 100 + i + 100) * 50000 + 5000);
    askCumulative += size;
    asks.push({
      price: Math.round(price * 10000) / 10000,
      displayPrice: Math.round(price * 10000) / 100, // price * 100
      size,
      total: Math.round(size * price), // size * price
      cumulative: askCumulative,
    });
  }
  
  // 生成买单 (bids) - 价格从高到低
  let bidCumulative = 0;
  for (let i = 0; i < depth; i++) {
    const priceDecrement = 0.001 + seededRandom(basePrice * 100 + i + 200) * 0.002;
    const price = basePrice - (i + 1) * priceDecrement;
    const size = Math.round(seededRandom(basePrice * 100 + i + 300) * 50000 + 5000);
    bidCumulative += size;
    const finalPrice = Math.round(Math.max(0.001, price) * 10000) / 10000;
    bids.push({
      price: finalPrice,
      displayPrice: finalPrice * 100, // price * 100
      size,
      total: Math.round(size * finalPrice), // size * price
      cumulative: bidCumulative,
    });
  }
  
  const bestAsk = asks[0]?.price || basePrice;
  const bestBid = bids[0]?.price || basePrice;
  const midPrice = (bestAsk + bestBid) / 2;
  const spread = bestAsk - bestBid;
  const spreadPercent = (spread / midPrice) * 100;
  
  return {
    asks: asks.reverse(), // 显示时从高到低
    bids,
    midPrice,
    spread,
    spreadPercent,
  };
};

// 显示模式
type DisplayMode = 'both' | 'bids' | 'asks';

const SpotOrderbook: React.FC<SpotOrderbookProps> = ({
  ticker,
  basePrice = 0.5,
  label,
  marketId,
  marketSource,
  marketOutcomes,
  selectedSide = 'yes',
  onSideChange,
}) => {
  const { t } = useTranslation();
  const [displayMode, setDisplayMode] = useState<DisplayMode>('both');
  const [precision, setPrecision] = useState(4);
  // 内部 Trade Yes / Trade No 切换状态，和 PC 端 selectedSide 逻辑一致
  const [activeSide, setActiveSide] = useState<'yes' | 'no'>(selectedSide);

  const [sideALabel, sideBLabel] = useMemo(() => {
    if (!marketOutcomes || marketOutcomes.length < 2) {
      return [t.common.yes, t.common.no];
    }
    const sorted = sortOutcomesByOriginalIndex(marketOutcomes as any);
    const label0 = getOutcomeLabel(sorted[0] as any);
    const label1 = getOutcomeLabel(sorted[1] as any);
    return [
      normalizeBinaryOutcomeLabel(label0, t.common.yes, {
        yes: t.common.yes,
        no: t.common.no,
        up: t.common.up,
        down: t.common.down,
      }),
      normalizeBinaryOutcomeLabel(label1, t.common.no, {
        yes: t.common.yes,
        no: t.common.no,
        up: t.common.up,
        down: t.common.down,
      }),
    ];
  }, [
    marketOutcomes,
    t.common.yes,
    t.common.no,
    t.common.up,
    t.common.down,
  ]);

  // 同步外部 prop 变化
  useEffect(() => {
    setActiveSide(selectedSide);
  }, [selectedSide]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const asksContainerRef = useRef<HTMLDivElement>(null);

  // 存储从 WebSocket 获取的订单簿数据 (yes 和 no 分别存储)
  const [yesOrderBook, setYesOrderBook] = useState<ProcessedOrderBook | null>(null);
  const [noOrderBook, setNoOrderBook] = useState<ProcessedOrderBook | null>(null);
  const yesStoreRef = useRef<OrderBookStore>(new OrderBookStore());
  const noStoreRef = useRef<OrderBookStore>(new OrderBookStore());
  // 每个 SpotOrderbook 实例独立的 WS 连接
  const wsRef = useRef<OrderBookWebSocket | null>(null);
  const getWS = useCallback(() => {
    if (!wsRef.current) {
      wsRef.current = new OrderBookWebSocket();
    }
    return wsRef.current;
  }, []);

  // Resolve yes/no asset id candidates (support multiple formats)
  // 用 ref 存储，避免数组引用变化导致 handler 函数重建，进而触发 WS 重订阅
  const yesCandidatesRef = useRef<string[]>([]);
  const noCandidatesRef = useRef<string[]>([]);

  // 同步计算 candidates 到 ref（不作为 useEffect 依赖）
  useMemo(() => {
    const candidatesForYes: string[] = [];
    const candidatesForNo: string[] = [];

    // 1) marketOutcomes provided (tokenId / tradingPair)
    if (marketOutcomes && marketOutcomes.length > 0) {
      const sorted = sortOutcomesByOriginalIndex(marketOutcomes as any);
      const yesOutcome = sorted[0];
      const noOutcome = sorted[1];
      if (yesOutcome?.tokenId) candidatesForYes.push(String(yesOutcome.tokenId));
      if (noOutcome?.tokenId) candidatesForNo.push(String(noOutcome.tokenId));
      if (yesOutcome?.tradingPair) candidatesForYes.push(String(yesOutcome.tradingPair));
      if (noOutcome?.tradingPair) candidatesForNo.push(String(noOutcome.tradingPair));
    }

    // 2) 不再使用 marketId 拼接约定兜底（统一以接口返回为准）

    // dedupe and filter empty
    const dedupe = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));
    yesCandidatesRef.current = dedupe(candidatesForYes);
    noCandidatesRef.current = dedupe(candidatesForNo);
  }, [marketOutcomes]);

  // 节流：价格变化只应用到 store，定时刷新 UI（最多 500ms 一次）
  const priceChangeThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdateRef = useRef<{ yes: boolean; no: boolean }>({ yes: false, no: false });

  // 稳定的 flushOrderBookUI，不依赖任何 state/props
  const flushOrderBookUI = useCallback(() => {
    const pending = pendingUpdateRef.current;
    if (pending.yes) {
      setYesOrderBook(yesStoreRef.current.getProcessedOrderBook());
    }
    if (pending.no) {
      setNoOrderBook(noStoreRef.current.getProcessedOrderBook());
    }
    if (pending.yes || pending.no) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);
    }
    pendingUpdateRef.current = { yes: false, no: false };
  }, []);

  // 稳定的 handleSnapshot —— 通过 ref 读取 candidates，不把 candidates 列入依赖
  const handleSnapshot = useCallback((snapshots: OrderBookSnapshot[]) => {
    const yesCandidates = yesCandidatesRef.current;
    const noCandidates = noCandidatesRef.current;
    const yesSnapshot = snapshots.find(s => yesCandidates.includes(s.asset_id));
    const noSnapshot = snapshots.find(s => noCandidates.includes(s.asset_id));

    if (yesSnapshot) {
      yesStoreRef.current.applySnapshot(yesSnapshot);
      setYesOrderBook(yesStoreRef.current.getProcessedOrderBook());
    }
    if (noSnapshot) {
      noStoreRef.current.applySnapshot(noSnapshot);
      setNoOrderBook(noStoreRef.current.getProcessedOrderBook());
    }
    if (yesSnapshot || noSnapshot) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);
      setIsLoading(false);
    }
  }, []); // 无外部依赖，永久稳定

  // 稳定的 handlePriceChange —— 同样通过 ref 读取 candidates
  const handlePriceChange = useCallback((message: PriceChangeMessage) => {
    const yesCandidates = yesCandidatesRef.current;
    const noCandidates = noCandidatesRef.current;
    message.price_changes.forEach(change => {
      if (yesCandidates.includes(change.asset_id)) {
        yesStoreRef.current.applyUpdate(change);
        pendingUpdateRef.current.yes = true;
      }
      if (noCandidates.includes(change.asset_id)) {
        noStoreRef.current.applyUpdate(change);
        pendingUpdateRef.current.no = true;
      }
    });
    // 节流：500ms 内最多刷新一次 UI
    if (!priceChangeThrottleRef.current) {
      priceChangeThrottleRef.current = setTimeout(() => {
        priceChangeThrottleRef.current = null;
        flushOrderBookUI();
      }, 500);
    }
  }, [flushOrderBookUI]); // flushOrderBookUI 本身已经稳定

  // ============== WebSocket: 实时订单簿更新 ==============
  // 依赖只有 marketId —— candidates/handler 变化不会触发重订阅
  useEffect(() => {
    // 只有提供了 marketId 才订阅 WebSocket
    if (!marketId) {
      setIsLoading(false);
      return;
    }

    // 切换 market 时重置状态
    setYesOrderBook(null);
    setNoOrderBook(null);
    yesStoreRef.current = new OrderBookStore();
    noStoreRef.current = new OrderBookStore();
    setIsLoading(true);
    setError(null);

    // 获取/创建独立 WS 实例
    const ws = getWS();

    // 添加消息处理器
    ws.addHandler('orderbook_snapshot', handleSnapshot);
    ws.addHandler('price_change', handlePriceChange);

    // 订阅新的 market
    const subscribeToNewMarket = async () => {
      try {
        await ws.subscribeOrderBook(marketId);
      } catch (err: any) {
        console.error('[SpotOrderbook] Failed to subscribe:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    subscribeToNewMarket();

    // 保底：5s 后如果仍在 loading，取消 loading 状态（避免永远显示 connecting）
    const loadingTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    return () => {
      clearTimeout(loadingTimeout);
      ws.removeHandler('orderbook_snapshot', handleSnapshot);
      ws.removeHandler('price_change', handlePriceChange);
      ws.unsubscribeOrderBook(marketId);
      // 清理节流定时器
      if (priceChangeThrottleRef.current) {
        clearTimeout(priceChangeThrottleRef.current);
        priceChangeThrottleRef.current = null;
      }
      // 组件卸载时断开独立 WS 连接
      ws.disconnect();
      wsRef.current = null;
    };
  }, [marketId, handleSnapshot, handlePriceChange, getWS]); // handleSnapshot/handlePriceChange 现在永久稳定

  // 根据 activeSide 选择显示 yes 或 no 的数据
  const activeOrderBook = activeSide === 'yes' ? yesOrderBook : noOrderBook;

  // 使用 WebSocket 数据，无数据时显示空
  const orderbook = useMemo((): LocalOrderbookData | null => {
    // 如果有 WebSocket 数据，转换为本地格式
    if (activeOrderBook && (activeOrderBook.bids.length > 0 || activeOrderBook.asks.length > 0)) {
      return {
        bids: activeOrderBook.bids.map(b => ({
          price: b.price,
          displayPrice: b.displayPrice,
          size: b.size,
          total: b.total,
          cumulative: b.cumulative,
        })),
        asks: activeOrderBook.asks.map(a => ({
          price: a.price,
          displayPrice: a.displayPrice,
          size: a.size,
          total: a.total,
          cumulative: a.cumulative,
        })),
        midPrice: activeOrderBook.midPrice,
        spread: activeOrderBook.spread,
        spreadPercent: activeOrderBook.spreadPercent,
      };
    }
    return null;
  }, [activeOrderBook]);

  // 计算最大累计量（用于深度条宽度）
  const maxCumulative = useMemo(() => {
    if (!orderbook) return 0;
    const maxAsk = Math.max(...orderbook.asks.map(a => a.cumulative), 0);
    const maxBid = Math.max(...orderbook.bids.map(b => b.cumulative), 0);
    return Math.max(maxAsk, maxBid);
  }, [orderbook]);

  // 格式化价格
  const formatPrice = (price: number) => {
    return (price * 100).toFixed(precision - 2) + '¢';
  };

  // 精度选项（以 ¢ 为单位显示）
  const precisionOptions = [
    { value: 2, label: '1¢' },
    { value: 3, label: '0.1¢' },
    { value: 4, label: '0.01¢' },
  ];

  // 格式化数量
  const formatSize = (size: number) => {
    if (size >= 1000000) return (size / 1000000).toFixed(2) + 'M';
    if (size >= 1000) return (size / 1000).toFixed(1) + 'K';
    return size.toLocaleString();
  };

  // 渲染订单行
  const renderOrderRow = (
    entry: LocalOrderbookEntry, 
    type: 'ask' | 'bid',
    index: number,
    showLabel: boolean = false
  ) => {
    const isAsk = type === 'ask';
    const color = isAsk ? '#ef4444' : '#22c55e';
    const bgColor = isAsk ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)';
    const depthPercent = (entry.cumulative / maxCumulative) * 100;
    
    return (
      <div 
        key={`${type}-${index}`}
        className={`relative grid grid-cols-[56px_1fr_1fr_1fr] py-2 text-xs font-mono hover:bg-[var(--bg-hover)] transition-colors cursor-pointer ${
          isAnimating ? 'animate-pulse' : ''
        }`}
      >
        {/* 深度背景条 */}
        <div 
          className="absolute top-0 bottom-0 transition-all duration-300"
          style={{ 
            left: 0,
            width: `${depthPercent}%`,
            backgroundColor: bgColor,
          }}
        />
        
        {/* Asks/Bids 标签 */}
        <span className="relative z-10 flex items-center pl-2">
          {showLabel && (
            <span 
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ 
                color: 'white',
                backgroundColor: color,
              }}
            >
              {isAsk ? t.market.asks : t.market.bids}
            </span>
          )}
        </span>
        
        {/* 价格 */}
        <span 
          className="relative z-10 text-center font-medium"
          style={{ color }}
        >
          {formatPrice(entry.price)}
        </span>
        
        {/* 数量 */}
        <span className="relative z-10 text-center text-[var(--text-primary)]">
          {formatSize(entry.size)}
        </span>
        
        {/* 总额 */}
        <span className="relative z-10 text-right pr-3 text-[var(--text-secondary)]">
          ${entry.total.toLocaleString()}
        </span>
      </div>
    );
  };

  // 切换 yes/no 时重置滚动标记
  const asksScrolledRef = useRef(false);
  useEffect(() => {
    asksScrolledRef.current = false;
  }, [activeSide]);

  // asks 列表在首次数据载入或切换 yes/no 后滚到最底部
  useEffect(() => {
    if (!asksScrolledRef.current && asksContainerRef.current && orderbook && orderbook.asks.length > 0) {
      asksContainerRef.current.scrollTop = asksContainerRef.current.scrollHeight;
      asksScrolledRef.current = true;
    }
  }, [orderbook]);

  // 最新价（使用 best bid 作为 last price 的近似）
  const lastPrice = orderbook ? orderbook.midPrice : basePrice;

  return (
    <div className="rounded-lg">
      {/* Trade Yes / Trade No 切换 + 工具栏 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-[#1a1a1a]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setActiveSide('yes'); onSideChange?.('yes'); }}
            className={`text-sm font-semibold transition-colors ${
              activeSide === 'yes'
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {sideALabel}
          </button>
          <button
            onClick={() => { setActiveSide('no'); onSideChange?.('no'); }}
            className={`text-sm font-semibold transition-colors ${
              activeSide === 'no'
                ? 'text-[var(--text-primary)]'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            }`}
          >
            {sideBLabel}
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 显示模式切换 - 移动端隐藏 */}
          <div className="hidden md:flex bg-[var(--bg-secondary)] rounded">
            <button
              onClick={() => setDisplayMode('both')}
              className={`px-2 py-1 text-xs rounded-l ${
                displayMode === 'both' ? 'bg-[var(--bg-hover)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
              }`}
            >
              <ArrowUpDown size={12} />
            </button>
            <button
              onClick={() => setDisplayMode('bids')}
              className={`px-2 py-1 text-xs ${
                displayMode === 'bids' ? 'bg-[var(--bg-hover)]' : 'text-[var(--text-secondary)]'
              }`}
              style={displayMode === 'bids' ? { color: '#22c55e' } : {}}
            >
              {t.market.bids}
            </button>
            <button
              onClick={() => setDisplayMode('asks')}
              className={`px-2 py-1 text-xs rounded-r ${
                displayMode === 'asks' ? 'bg-[var(--bg-hover)]' : 'text-[var(--text-secondary)]'
              }`}
              style={displayMode === 'asks' ? { color: '#ef4444' } : {}}
            >
              {t.market.asks}
            </button>
          </div>

          <button
            onClick={() => {
              if (!marketId || isLoading) return;
              // 清空本地订单簿数据
              setYesOrderBook(null);
              setNoOrderBook(null);
              yesStoreRef.current = new OrderBookStore();
              noStoreRef.current = new OrderBookStore();
              setIsLoading(true);
              setError(null);

              // 断开 WS 并重新连接+订阅，服务器会推送完整快照
              const ws = getWS();
              ws.forceReconnect();

              // 保底：5s 后取消加载状态（正常情况 handleSnapshot 会更早设置）
              setTimeout(() => setIsLoading(false), 5000);
            }}
            className="p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          
          {/* 精度选择 */}
          <select 
            value={precision}
            onChange={(e) => setPrecision(Number(e.target.value))}
            className="bg-[var(--bg-secondary)] text-[var(--text-secondary)] text-xs px-2 py-1 rounded border border-gray-200 dark:border-[#333] cursor-pointer outline-none"
          >
            {precisionOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 表头 - 4列布局 */}
      <div className="grid grid-cols-[56px_1fr_1fr_1fr] py-2 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] border-b border-gray-200 dark:border-[#1a1a1a]">
        <span className="pl-2 flex items-center gap-1">
          {activeSide === 'yes' ? sideALabel : sideBLabel}
          <ArrowUpDown size={10} />
        </span>
        <span className="text-center">{t.market.obPrice}</span>
        <span className="text-center">{t.market.obShares}</span>
        <span className="text-right pr-3">{t.market.obTotal}</span>
      </div>

      {/* 订单列表 */}
      <div className="h-[320px] flex flex-col">
        {!orderbook ? (
          <div className="flex flex-col items-center justify-center flex-1 text-[var(--text-secondary)] py-10">
            <RefreshCw size={24} className={isLoading ? 'animate-spin' : ''} />
            <p className="mt-2 text-sm">{isLoading ? t.market.connecting : t.market.noOrderbookData}</p>
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>
        ) : (
          <>
            {/* Asks - 固定占一半高度 */}
            {(displayMode === 'both' || displayMode === 'asks') && (
              <div ref={asksContainerRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-hide border-b border-gray-200 dark:border-[#1a1a1a]">
                <div className="flex flex-col justify-end min-h-full">
                  {orderbook.asks.map((entry, index) => 
                    renderOrderRow(entry, 'ask', index, index === orderbook.asks.length - 1)
                  )}
                </div>
              </div>
            )}

            {/* Last / Spread 中间栏 */}
            <div className="flex-shrink-0 border-y border-gray-200 dark:border-[#1a1a1a] py-2 px-3">
              <div className="flex items-center gap-6 text-sm">
                <span className="text-[var(--text-secondary)]">
                  {t.market.last}: <span className="font-medium text-[var(--text-primary)]">{formatPrice(lastPrice)}</span>
                </span>
                <span className="text-[var(--text-secondary)]">
                  {t.market.spread}: <span className="font-medium text-[var(--text-primary)]">{formatPrice(orderbook.spread)}</span>
                </span>
              </div>
            </div>

            {/* Bids - 固定占一半高度 */}
            {(displayMode === 'both' || displayMode === 'bids') && (
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                {orderbook.bids.map((entry, index) => 
                  renderOrderRow(entry, 'bid', index, index === 0)
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SpotOrderbook;
