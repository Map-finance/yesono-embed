'use client';

/**
 * SpotOrderbook - 订单簿组件
 * 基于文档 docs/API_Order_book_ws.md 实现
 * 显示买卖盘深度、价差、中间价
 * 
 * 数据源架构:
 * - WebSocket: 实时增量更新 (orderBook 频道) - 优先使用
 * - 增量更新: price 为唯一键，size=0 时删除
 * - 显示: price * 100;total = 到该档为止的累计金额 Σ(size×price)(深度,对齐 Polymarket);
 *   size 仍为当前档份额
 */

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { RefreshCw, ArrowUpDown, Info } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useSessionTradeVolume } from '@/lib/hooks/useSessionTradeVolume';
import { setLongTimeout } from '@/utils/timers';
import {
  OrderBookWebSocket,
  OrderBookStore,
  OrderBookSnapshot,
  PriceChangeMessage,
  ProcessedOrderBook,
  formatDisplayPrice,
  formatSize,
  acquireOrderbookWS,
  releaseOrderbookWS,
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
  /** Event slug, for session-scoped trade-volume display (对齐 Polymarket) */
  eventSlug?: string;
  /** 市场截止时间(ms);提供时在截止瞬间打印一次该市场所有 WS 推送(调试用,排查推送/漂移) */
  endDateMs?: number;
}

/** 格式化金额为 K/M 缩写,$8000 → "$8.0K"; $0 → "$0" */
function formatKMB(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
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
  
  const hasAsk = asks.length > 0;
  const hasBid = bids.length > 0;
  const bestAsk = hasAsk ? asks[0].price : basePrice;
  const bestBid = hasBid ? bids[0].price : basePrice;
  const midPrice = (bestAsk + bestBid) / 2;
  // 单边盘口(只有买单或只有卖单)时 spread 无意义 → 置 0,避免 0 − bestBid 这种负数;
  // UI 侧会据 asks/bids 是否都非空再决定显示数值还是 "—"。
  const spread = hasAsk && hasBid ? bestAsk - bestBid : 0;
  const spreadPercent =
    hasAsk && hasBid && midPrice > 0 ? (spread / midPrice) * 100 : 0;
  
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
  eventSlug,
  endDateMs,
}) => {
  const { t } = useTranslation();
  const [displayMode, setDisplayMode] = useState<DisplayMode>('both');
  const [precision, setPrecision] = useState(4);
  // 会话级累计交易量(对齐 Polymarket):页面打开后通过 WS 看到的所有成交累加,
  // 刷新归零。仅在 eventSlug 提供时启用。
  const sessionVolume = useSessionTradeVolume(eventSlug);
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const asksContainerRef = useRef<HTMLDivElement>(null);

  // 存储从 WebSocket 获取的订单簿数据 (yes 和 no 分别存储)
  const [yesOrderBook, setYesOrderBook] = useState<ProcessedOrderBook | null>(null);
  const [noOrderBook, setNoOrderBook] = useState<ProcessedOrderBook | null>(null);
  const yesStoreRef = useRef<OrderBookStore>(new OrderBookStore());
  const noStoreRef = useRef<OrderBookStore>(new OrderBookStore());
  // 当前市场的订单簿 WS 实例:经 registry 按 marketId 去重共享(与 tradingStore 同市场共用
  // 一条连接,refCount 自管),满足后端"切市场断开新开"约束。wsRef 只为刷新按钮拿当前实例。
  const wsRef = useRef<OrderBookWebSocket | null>(null);
  // 交叉盘口自愈:本地增量盘口可能因丢消息/重连间隙残留过期档位 → bestBid ≥ bestAsk
  // (交叉,不可能的合法状态)。持续交叉就自动重拉全量快照修复(快速市场低流动性 + 频繁
  // 断线时尤其需要,否则会永久显示无效状态)。
  const healCooldownRef = useRef(false); // heal 后 10s 冷却,防 heal 风暴
  const crossedSinceRef = useRef<number | null>(null); // 首次发现交叉的时间戳

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

  // rAF 合并:增量永远即时落进内部 store(数据实时),仅把 setState 攒到下一帧统一刷。
  // pendingUpdateRef 标记本帧更新了哪侧,flush 时只 setState 有变化的那一侧,避免无谓重渲染。
  // key=price 保证行 DOM 稳定,数字变只改文本不闪。
  const pendingUpdateRef = useRef<{ yes: boolean; no: boolean }>({ yes: false, no: false });
  const rafIdRef = useRef<number | null>(null);

  // 稳定的 flushOrderBookUI，不依赖任何 state/props
  const flushOrderBookUI = useCallback(() => {
    const pending = pendingUpdateRef.current;
    if (pending.yes) {
      setYesOrderBook(yesStoreRef.current.getProcessedOrderBook());
    }
    if (pending.no) {
      setNoOrderBook(noStoreRef.current.getProcessedOrderBook());
    }
    pendingUpdateRef.current = { yes: false, no: false };
  }, []);

  // rAF 调度:一帧内的多条 price_change 只触发一次 flush。对齐浏览器绘制周期(~16ms),
  // 延迟比固定 100ms 定时器更低;标签页隐藏时 rAF 自动降频。环境无 rAF 时回退到立即 flush。
  const scheduleFlushOrderBookUI = useCallback(() => {
    if (rafIdRef.current != null) return; // 本帧已排,合并进同一次 flush
    if (typeof requestAnimationFrame !== 'function') {
      flushOrderBookUI();
      return;
    }
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      flushOrderBookUI();
    });
  }, [flushOrderBookUI]);

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
      setIsLoading(false);
    }
    // snapshot 立即 setState(上面已刷),取消已排的 rAF 并清标记,避免下一帧用陈旧增量重复 flush
    if (rafIdRef.current != null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingUpdateRef.current = { yes: false, no: false };
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
    // rAF 合并刷新:一帧内多条 price_change 只触发一次 setState。
    // key=price 保证行 DOM 稳定,高频更新只改数字文本不闪。
    scheduleFlushOrderBookUI();
  }, [scheduleFlushOrderBookUI]); // scheduleFlushOrderBookUI 本身已经稳定

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

    // 经 registry 申请该 marketId 的 WS 实例(同市场与 tradingStore 共享同一条)
    const ws = acquireOrderbookWS(marketId);
    wsRef.current = ws;

    // 添加消息处理器
    ws.addHandler('orderbook_snapshot', handleSnapshot);
    ws.addHandler('price_change', handlePriceChange);

    // 复用实例检测:若 WS 实例已有 lastSnapshots 缓存,说明之前有别的消费者
    // (典型是 tradingStore 选中市场时)订阅过。缓存只被 snapshot 更新、不被 price_change 更新,
    // 长时间持有后缓存严重陈旧;mount 时回放陈旧 base + 后续增量在错的 base 上 apply,
    // 会导致"离开页面再回来后,订单簿显示陈旧/漂移"。
    // 这里主动 forceReconnect:close 旧 WS → 重连 → 重订阅 → 后端推全新全量,
    // 覆盖陈旧缓存,所有消费者拿到一致最新状态。新实例(无缓存)走正常 subscribe,无开销。
    const candidates = [
      ...yesCandidatesRef.current,
      ...noCandidatesRef.current,
    ];
    const isReusedInstance =
      candidates.length > 0 &&
      ws.getCachedSnapshots(candidates).length > 0;
    if (isReusedInstance) {
      ws.forceReconnect();
    } else {
      // 订阅失败(连接未就绪等)静默处理 —— handler 已挂,该实例自身的重连链路
      // (attemptReconnect / idle check)恢复后会自动重订阅,数据会流回来
      ws.subscribeOrderBook(marketId).catch((err) => {
        console.warn('[SpotOrderbook] subscribe deferred (will retry via reconnect):', err?.message);
      });
    }

    // 保底：5s 后如果仍在 loading，取消 loading 状态（避免永远显示 connecting）
    const loadingTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    return () => {
      clearTimeout(loadingTimeout);
      ws.removeHandler('orderbook_snapshot', handleSnapshot);
      ws.removeHandler('price_change', handlePriceChange);
      ws.unsubscribeOrderBook(marketId);
      // 取消挂起的 rAF + 重置 pending,防切 market 后旧帧/旧标记落到新 store 上
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingUpdateRef.current = { yes: false, no: false };
      // 经 registry 释放:refCount 到 0 时实例自动 disconnect;
      // 若同市场 tradingStore 仍持有,则连接保留(不会被这里断掉)
      releaseOrderbookWS(marketId);
      wsRef.current = null;
    };
  }, [marketId, handleSnapshot, handlePriceChange]); // handleSnapshot/handlePriceChange 现在永久稳定

  // 静默自愈 + forceReconnect 拉全新全量快照(刷新按钮 / 交叉自愈共用)。
  //
  // 关键:不清空已展示的订单簿、不重置 store —— 保留现有数据继续显示,等后端推来的全量
  // snapshot 经 handleSnapshot 的 applySnapshot(内部 clear 后全量重建)原地覆盖旧数据。
  // 用户无感、不会闪 "Connecting...";薄盘/临近结算市场交叉自愈频繁触发时尤其明显。
  //
  // 为何连 store 也不重置:若先 new OrderBookStore() 清空,而 price_change 早于 snapshot
  // 到达,增量会落在近空 store 上 flush 出近空簿造成闪烁。保留旧 store 让增量先叠在旧数据
  // 上,snapshot 到达时由 applySnapshot 一次性全量覆盖,过渡平滑。
  //
  // opts.feedback=true(手动点刷新按钮):短暂翻 isLoading 让刷新图标转一下作反馈。
  const healOrderbook = useCallback((opts?: { feedback?: boolean }) => {
    if (!marketId) return;
    setError(null);
    if (opts?.feedback) {
      setIsLoading(true);
      // snapshot 到达时 handleSnapshot 会置 false;此处兜底防快照迟迟不来导致图标永转
      setTimeout(() => setIsLoading(false), 5000);
    }
    // forceReconnect 内部带 single-flight 锁,狂触发不会堆 pending 连接
    wsRef.current?.forceReconnect();
  }, [marketId]);

  // 交叉盘口自愈:1s 巡检,持续交叉(bestBid ≥ bestAsk,两侧都有单)≥2s 自动重拉全量快照
  // 修复。排除瞬时在途更新(只一帧交叉不 heal);heal 后 10s 冷却避免风暴。快速市场低
  // 流动性 + 高频更新场景下尤为关键 —— 没有这个守卫,WS 丢一个 size=0 删除消息就会让
  // 本地簿残留过期档,bestBid 反超 bestAsk 后用户看到的将是无效的负 spread / 错乱档位。
  useEffect(() => {
    if (!marketId) return;
    const isCrossed = (ob: ProcessedOrderBook | null) =>
      !!ob && ob.bestBid > 0 && ob.bestAsk > 0 && ob.bestBid >= ob.bestAsk;
    const id = setInterval(() => {
      if (healCooldownRef.current) return;
      const crossed =
        isCrossed(yesStoreRef.current.getProcessedOrderBook()) ||
        isCrossed(noStoreRef.current.getProcessedOrderBook());
      if (!crossed) {
        crossedSinceRef.current = null;
        return;
      }
      if (crossedSinceRef.current == null) {
        crossedSinceRef.current = Date.now(); // 首帧交叉,先观望
        return;
      }
      if (Date.now() - crossedSinceRef.current >= 2000) {
        crossedSinceRef.current = null;
        healCooldownRef.current = true;
        setTimeout(() => {
          healCooldownRef.current = false;
        }, 10_000);
        console.warn(
          '[SpotOrderbook] crossed orderbook (bestBid ≥ bestAsk) → auto re-snapshot'
        );
        healOrderbook();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [marketId, healOrderbook]);

  // 调试:截止时间到时打印该市场所有 WS 推送(用于排查推送/漂移/陈旧)。
  // 只在 endDateMs 提供、有效、未过期时启用,截止瞬间打印一次。
  useEffect(() => {
    if (endDateMs == null) return;
    // 后端 endDate 可能是字符串(如 "1796054399999"),强制转 number + 有效性校验,
    // 否则 new Date(字符串) 当 ISO 解析失败 → Invalid Date → toISOString 抛 RangeError
    const ms = Number(endDateMs);
    if (!Number.isFinite(ms) || ms <= 0) return;
    const delay = ms - Date.now();
    if (delay <= 0) return; // 已过期,不挂 timer(也不立即打印,避免历史市场刷出脏日志)

    const ws = wsRef.current;
    if (!ws) return;
    const buffer: Array<{ t: number; type: string; data: any }> = [];
    const snapHandler = (d: any) =>
      buffer.push({ t: Date.now(), type: 'orderbook_snapshot', data: d });
    const pcHandler = (d: any) =>
      buffer.push({ t: Date.now(), type: 'price_change', data: d });
    ws.addHandler('orderbook_snapshot', snapHandler);
    ws.addHandler('price_change', pcHandler);

    let dumped = false;
    const cancelTimer = setLongTimeout(() => {
      if (dumped) return;
      dumped = true;
      // 一次性打印:整段完整 buffer + 元数据。
      // 完整复制:在 console 里右键 messages 数组 → Store as global variable → copy(JSON.stringify(temp1))
      console.log('[WS DUMP] 市场截止前所有推送', {
        marketId,
        endDate: new Date(ms).toISOString(),
        durationMs: delay,
        count: buffer.length,
        messages: buffer,
      });
    }, delay);

    return () => {
      cancelTimer();
      ws.removeHandler('orderbook_snapshot', snapHandler);
      ws.removeHandler('price_change', pcHandler);
    };
  }, [marketId, endDateMs]);

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
        key={`${type}-${entry.price}`}
        className="relative grid grid-cols-[56px_1fr_1fr_1fr] py-2 text-xs font-mono hover:bg-(--bg-hover) transition-colors cursor-pointer"
      >
        {/* 深度背景条 */}
        <div
          className="absolute top-0 bottom-0 transition-all duration-100"
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
        <span className="relative z-10 text-center text-(--text-primary)">
          {formatSize(entry.size)}
        </span>
        
        {/* 总额:到该档为止的累计金额(深度),非当前档 size×price */}
        <span className="relative z-10 text-right pr-3 text-(--text-secondary)">
          ${entry.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>
    );
  };

  // asks 容器"贴底跟随":best ask 在最底部,只要用户没主动向上滚,新增更优档时自动跟随到底
  // (旧实现只在首次滚一次,后来 WS 增量补的 55/56 等更优档会掉到滚动条下方看不见,
  // 表现为"按钮显示 55¢ 而表格底部看到 57¢"的伪不一致)。
  const isAtBottomRef = useRef(true);

  // 切 yes/no 重置为贴底,让下一次 orderbook flush 把视口对齐到 best ask
  useEffect(() => {
    isAtBottomRef.current = true;
  }, [activeSide]);

  // 贴底滚动用 useLayoutEffect(paint 前同步执行),否则会出现:
  // ① 先 paint「未滚到底」一帧再滚 → 闪;② scroll 事件先于 useEffect 把 isAtBottom 误设 false → 没贴底
  useLayoutEffect(() => {
    const el = asksContainerRef.current;
    if (!el || !orderbook || orderbook.asks.length === 0) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [orderbook]);

  // 用户主动滚动时维护贴底状态:32px 容差(≈ 一行高度)允许小幅偏离仍跟随,
  // 显式向上滚开后停止跟随,避免打断查看高价档
  const handleAsksScroll = useCallback(() => {
    const el = asksContainerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.clientHeight - el.scrollTop < 32;
  }, []);

  // 最新价（使用 best bid 作为 last price 的近似）
  const lastPrice = orderbook ? orderbook.midPrice : basePrice;

  return (
    <div className="rounded-lg">
      {/* 会话级累计交易量(对齐 Polymarket;刷新归零) */}
      {eventSlug && (
        <div className="flex items-center justify-end px-3 pt-2 pb-1 text-xs text-(--text-secondary)">
          <span className="font-medium tabular-nums">
            {formatKMB(sessionVolume)}
          </span>
          <span className="ml-1">{t.common.volume}</span>
        </div>
      )}
      {/* Trade Yes / Trade No 切换 + 工具栏 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-[#1a1a1a]">
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setActiveSide('yes'); onSideChange?.('yes'); }}
            className={`text-sm font-semibold transition-colors ${
              activeSide === 'yes'
                ? 'text-(--text-primary)'
                : 'text-(--text-tertiary) hover:text-(--text-secondary)'
            }`}
          >
            {sideALabel}
          </button>
          <button
            onClick={() => { setActiveSide('no'); onSideChange?.('no'); }}
            className={`text-sm font-semibold transition-colors ${
              activeSide === 'no'
                ? 'text-(--text-primary)'
                : 'text-(--text-tertiary) hover:text-(--text-secondary)'
            }`}
          >
            {sideBLabel}
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 显示模式切换 - 移动端隐藏 */}
          <div className="hidden md:flex bg-(--bg-secondary) rounded">
            <button
              onClick={() => setDisplayMode('both')}
              className={`px-2 py-1 text-xs rounded-l ${
                displayMode === 'both' ? 'bg-(--bg-hover) text-(--text-primary)' : 'text-(--text-secondary)'
              }`}
            >
              <ArrowUpDown size={12} />
            </button>
            <button
              onClick={() => setDisplayMode('bids')}
              className={`px-2 py-1 text-xs ${
                displayMode === 'bids' ? 'bg-(--bg-hover)' : 'text-(--text-secondary)'
              }`}
              style={displayMode === 'bids' ? { color: '#22c55e' } : {}}
            >
              {t.market.bids}
            </button>
            <button
              onClick={() => setDisplayMode('asks')}
              className={`px-2 py-1 text-xs rounded-r ${
                displayMode === 'asks' ? 'bg-(--bg-hover)' : 'text-(--text-secondary)'
              }`}
              style={displayMode === 'asks' ? { color: '#ef4444' } : {}}
            >
              {t.market.asks}
            </button>
          </div>

          <button
            onClick={() => {
              if (isLoading) return;
              // 手动刷新:复用统一 healOrderbook(带 feedback 让图标转一下);
              // 不清空旧簿,数据原地刷新不闪屏。详细注释见 healOrderbook 函数体。
              healOrderbook({ feedback: true });
            }}
            className="p-1 rounded hover:bg-(--bg-hover) text-(--text-secondary)"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
          
          {/* 精度选择 */}
          <select 
            value={precision}
            onChange={(e) => setPrecision(Number(e.target.value))}
            className="bg-(--bg-secondary) text-(--text-secondary) text-xs px-2 py-1 rounded border border-gray-200 dark:border-[#333] cursor-pointer outline-hidden"
          >
            {precisionOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 表头 - 4列布局 */}
      <div className="grid grid-cols-[56px_1fr_1fr_1fr] py-2 text-[10px] uppercase tracking-wider text-(--text-tertiary) border-b border-gray-200 dark:border-[#1a1a1a]">
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
          <div className="flex flex-col items-center justify-center flex-1 text-(--text-secondary) py-10">
            <RefreshCw size={24} className={isLoading ? 'animate-spin' : ''} />
            <p className="mt-2 text-sm">{isLoading ? t.market.connecting : t.market.noOrderbookData}</p>
            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
          </div>
        ) : (
          <>
            {/* Asks - 固定占一半高度 */}
            {(displayMode === 'both' || displayMode === 'asks') && (
              <div ref={asksContainerRef} onScroll={handleAsksScroll} className="flex-1 min-h-0 overflow-y-auto scrollbar-hide border-b border-gray-200 dark:border-[#1a1a1a]">
                <div className="flex flex-col justify-end min-h-full">
                  {orderbook.asks.map((entry, index) => 
                    renderOrderRow(entry, 'ask', index, index === orderbook.asks.length - 1)
                  )}
                </div>
              </div>
            )}

            {/* Last / Spread 中间栏 */}
            <div className="shrink-0 border-y border-gray-200 dark:border-[#1a1a1a] py-2 px-3">
              <div className="flex items-center gap-6 text-sm">
                <span className="text-(--text-secondary)">
                  {t.market.last}: <span className="font-medium text-(--text-primary)">{formatPrice(lastPrice)}</span>
                </span>
                <span className="text-(--text-secondary)">
                  {t.market.spread}: <span className="font-medium text-(--text-primary)">{
                    // 两侧都有真实挂单 → 显示数值,交叉盘口(bid>ask 的负数)钳到 0;
                    // 单边盘口(一侧无挂单)→ "—"(此时 spread 无意义)
                    orderbook.asks.length > 0 && orderbook.bids.length > 0
                      ? formatPrice(Math.max(0, orderbook.spread))
                      : "—"
                  }</span>
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
