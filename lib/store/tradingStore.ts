import {
    acquireOrderbookWS,
    releaseOrderbookWS,
    type OrderBookWebSocket,
    type OrderBookSnapshot as ServiceSnapshot,
    type PriceChangeMessage as ServicePriceChange,
} from "@/lib/services/orderBookService";
import { PolymarketEventResp, PolymarketMarketResp } from "@/types/home";
import { create } from "zustand";
import { shallow } from "zustand/shallow";

// ============== OrderBook Types ==============
export interface ProcessedOrderBookEntry {
  price: number;
  displayPrice: number;
  size: number;
  total: number;
  cumulative: number;
}

export interface ProcessedOrderBook {
  bids: ProcessedOrderBookEntry[];
  asks: ProcessedOrderBookEntry[];
  midPrice: number;
  spread: number;
  spreadPercent: number;
  bestBid: number;
  bestAsk: number;
}

// 内部存储格式:price → size 字符串,Map 便于 O(1) 增删改
// orderbook_snapshot / price_change 都解析进这个结构,再由 processStoreData 计算累计
interface AssetStore {
  bids: Map<string, string>;
  asks: Map<string, string>;
}

// ============== Store Definition ==============

export interface TradingStore {
    event: PolymarketEventResp | null,
    market: PolymarketMarketResp | null;
    selectOutcomeId: string | null;
    direction: "BUY" | "SELL";

    // OrderBook State
    orderBookRaw: Record<string, AssetStore>; // Internal raw storage
    isConnected: boolean;
}

interface TradingStoreActions {
    setEvent: (event: PolymarketEventResp | null) => void;
    setMarket: (market: PolymarketMarketResp | null) => void;
    setSelectOutcomeId: (outcomeId: string) => void;
    setDirection: (direction: "BUY" | "SELL") => void;
    getOrderBook: (assetId: string | string[]) => ProcessedOrderBook;
    cleanup: () => void; // Manually close connection
}

// =========================================================================
// 按市场独立的 OrderBookWebSocket(满足后端"切市场断 WS 新开 WS"约束)
//
// tradingStore 通过 acquireOrderbookWS(marketId) 拿到当前市场的 WS 实例:
//   - 同一 marketId 被多个消费者(tradingStore + SpotOrderbook)acquire → 共享同一实例(refCount 自管)
//   - 切到新市场:release(老) + acquire(新);老市场最后一个消费者 release 时实例 disconnect
//
// handler 必须挂在"具体实例"上而不是单例(因为每个市场是不同实例),
// 切市场时 removeHandler from 老实例 → 老实例进 release 后被 disconnect。
//
// activeMarketId:仅用于 throttleTimer flush 时再校验一次,
// 防止"切市场后旧批次落到新市场上"。不再按 asset_id 过滤 WS 消息 ——
// 因为 WS 推送的 asset_id 用 tradingPair(如 `${marketId}-YES-USDT`),
// 而非 clobTokenIds 中的链上 tokenId,二者不可互查;一过滤就把全部 WS 数据丢了。
// 每个市场独立 WS 实例,本来也不存在跨市场污染需要过滤。
// =========================================================================
let activeMarketId: string | null = null;
let currentOrderbookWS: OrderBookWebSocket | null = null;

// 节流：将高频 WS 消息批量合并，最多 500ms 刷新一次 Zustand store
// 避免每条 price_change 消息都触发全量组件重渲染
let throttleTimer: NodeJS.Timeout | null = null;
let pendingRaw: Record<string, AssetStore> | null = null;

// set/get 在闭包里捕获:Zustand store 创建时塞进来
type SetFn = (partial: Partial<TradingStore>) => void;
type GetFn = () => TradingStore & TradingStoreActions;
let storeSet: SetFn | null = null;
let storeGet: GetFn | null = null;

export const useTradingStore = create<TradingStore & TradingStoreActions>((set, get) => {
    // 把 set/get 暂存到模块级,供 OrderBookWebSocket handler 回写 store 用
    storeSet = set as SetFn;
    storeGet = get as GetFn;

    return ({
        event: null,
        market: null,
        selectOutcomeId: null,
        direction: "BUY",
        orderBookRaw: {},
        isConnected: false,

        setEvent: (event: PolymarketEventResp | null) => {
            set({ event });
        },
        setMarket: (market: PolymarketMarketResp | null) => {
            const currentMarketId = get().market?.id;
            const newMarketId = market?.id;
            if (currentMarketId === newMarketId) return;

            // 1) 拆掉旧市场:从老 WS 实例摘 handler,unsubscribe,然后 release
            //    (release 内部:refCount 到 0 时该实例自动 disconnect)
            if (currentMarketId && currentOrderbookWS) {
                currentOrderbookWS.removeHandler('orderbook_snapshot', handleSnapshot as any);
                currentOrderbookWS.removeHandler('price_change', handlePriceChange as any);
                currentOrderbookWS.unsubscribeOrderBook(currentMarketId).catch(() => {});
                releaseOrderbookWS(currentMarketId);
                currentOrderbookWS = null;
            }
            // 切换市场时丢弃挂起的批次,防止旧数据混入新市场
            if (throttleTimer) {
                clearTimeout(throttleTimer);
                throttleTimer = null;
            }
            pendingRaw = null;

            // 2) 切"当前市场"(handler 不再按 asset_id 过滤,详见模块顶部注释)
            activeMarketId = newMarketId ?? null;

            // 3) 清状态(同步)
            set({
                market,
                selectOutcomeId: market ? (JSON.parse(market.clobTokenIds || '[]') as string[])[0] || null : null,
                direction: "BUY",
                orderBookRaw: {},
                isConnected: false,
            });

            // 4) 申请新市场专属 WS 实例 + 挂 handler + 订阅
            if (newMarketId) {
                currentOrderbookWS = acquireOrderbookWS(newMarketId);
                currentOrderbookWS.addHandler('orderbook_snapshot', handleSnapshot as any);
                currentOrderbookWS.addHandler('price_change', handlePriceChange as any);
                currentOrderbookWS.subscribeOrderBook(newMarketId)
                    .then(() => set({ isConnected: currentOrderbookWS?.isConnected() ?? false }))
                    .catch((err: any) => {
                        // subscribe 失败(连接未起来等)—— handler 已挂,attemptReconnect 链路
                        // 救回连接后会自动重订阅;此处仅记录,不阻断 UI
                        console.warn('[tradingStore] subscribe deferred:', err?.message);
                    });
            }
        },


        setSelectOutcomeId: (outcomeId: string) => {
            set({ selectOutcomeId: outcomeId });
        },
        setDirection: (direction: "BUY" | "SELL") => {
            set({ direction });
        },

        getOrderBook: (assetId: string | string[]) => {
            if (Array.isArray(assetId)) {
              const key = Object.keys(get().orderBookRaw).find(key => {
                  return assetId.includes(key);
              });
              if (!key) return { bids: [], asks: [], midPrice: 0, spread: 0, spreadPercent: 0, bestBid: 0, bestAsk: 0 };
              const rawStore = get().orderBookRaw[key];
              return processStoreData(rawStore);
            } else {
                const rawStore = get().orderBookRaw[assetId];
                return processStoreData(rawStore);
            }
        },

        cleanup: () => {
             // 完整释放当前市场:摘 handler、unsubscribe、release(refCount=0 时实例 disconnect)
             if (currentOrderbookWS && activeMarketId) {
                 currentOrderbookWS.removeHandler('orderbook_snapshot', handleSnapshot as any);
                 currentOrderbookWS.removeHandler('price_change', handlePriceChange as any);
                 currentOrderbookWS.unsubscribeOrderBook(activeMarketId).catch(() => {});
                 releaseOrderbookWS(activeMarketId);
                 currentOrderbookWS = null;
             }
             if (throttleTimer) { clearTimeout(throttleTimer); throttleTimer = null; }
             pendingRaw = null;
             activeMarketId = null;
             set({ isConnected: false, market: null, orderBookRaw: {} });
        }
    });
});

// ============== OrderBookWebSocket handlers(挂在当前市场专属 WS 实例上) ==============

// 写入 pendingRaw + 节流 setState(500ms),从原 connectWS.onmessage 抽出来
function applyAndScheduleFlush(mutate: (next: Record<string, AssetStore>) => void) {
    if (!storeGet || !storeSet) return;
    if (!pendingRaw) {
        pendingRaw = { ...storeGet().orderBookRaw };
    }
    mutate(pendingRaw!);

    if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
            throttleTimer = null;
            // flush 时再校验一次 activeMarketId,防止切市场后旧批次落到新市场上
            if (pendingRaw && activeMarketId && storeSet) {
                storeSet({ orderBookRaw: pendingRaw });
            }
            pendingRaw = null;
        }, 500);
    }
}

// orderbook_snapshot:数组形式,每个 asset_id 一个完整快照
// 不过滤 asset_id:WS 推送的 asset_id 是 tradingPair(类似 `${marketId}-YES-USDT`),
// 不是 clobTokenIds 的链上 tokenId,无法按 clobTokenIds 过滤。
// 每个市场独立 WS 实例本来也没有跨市场污染问题,信任 WS 推送的就是当前市场的数据。
//
// snapshot 不走 500ms 节流:它是低频事件(切市场/订阅初始时),走节流会让按钮上的
// best ask/bid 比订单簿组件(snapshot 立即 setState)晚最多 500ms 显示,造成
// "切市场瞬间按钮价比订单簿慢半拍"。这里把累积中的 pendingRaw(price_change 批)
// 也一起 flush,否则 trailing 定时器之后会用 stale pendingRaw 覆盖回去。
function handleSnapshot(snapshots: ServiceSnapshot[]) {
    const relevant = snapshots.filter(s => !!s?.asset_id);
    if (relevant.length === 0) return;
    if (!storeGet || !storeSet) return;

    if (!pendingRaw) {
        pendingRaw = { ...storeGet().orderBookRaw };
    }
    relevant.forEach((snap) => {
        if (!pendingRaw![snap.asset_id]) {
            pendingRaw![snap.asset_id] = { bids: new Map(), asks: new Map() };
        }
        const store = pendingRaw![snap.asset_id];
        // snapshot 是全量替换:先 clear 掉可能在 pendingRaw 里攒着的 price_change 增量,
        // 再写入快照数据(防止旧增量混入新快照)
        store.bids.clear();
        store.asks.clear();
        snap.bids.forEach(x => Number(x.size) > 0 && store.bids.set(x.price, x.size));
        snap.asks.forEach(x => Number(x.size) > 0 && store.asks.set(x.price, x.size));
    });

    if (throttleTimer) {
        clearTimeout(throttleTimer);
        throttleTimer = null;
    }
    // activeMarketId 校验对齐 applyAndScheduleFlush:切市场瞬间老消息不要落到新市场上
    if (activeMarketId) {
        storeSet({ orderBookRaw: pendingRaw, isConnected: true });
    }
    pendingRaw = null;
}

// price_change:增量更新,按 side 写 bids/asks,size=0 删除该档
function handlePriceChange(message: ServicePriceChange) {
    if (!Array.isArray(message?.price_changes)) return;
    const relevant = message.price_changes.filter(c => !!c?.asset_id);
    if (relevant.length === 0) return;

    applyAndScheduleFlush((nextRaw) => {
        relevant.forEach((change) => {
            if (!nextRaw[change.asset_id]) {
                nextRaw[change.asset_id] = { bids: new Map(), asks: new Map() };
            }
            const store = nextRaw[change.asset_id];
            const map = change.side === 'BUY' ? store.bids : store.asks;
            if (parseFloat(change.size) === 0) {
                map.delete(change.price);
            } else {
                map.set(change.price, change.size);
            }
        });
    });
}

function processStoreData(store?: AssetStore): ProcessedOrderBook {
    if (!store) {
        return { bids: [], asks: [], midPrice: 0, spread: 0, spreadPercent: 0, bestBid: 0, bestAsk: 0 };
    }

    const toArray = (map: Map<string, string>, sortDesc: boolean) => {
        return Array.from(map.entries())
            .map(([p, s]) => ({ price: parseFloat(p), size: parseFloat(s) }))
            .sort((a, b) => sortDesc ? (b.price - a.price) : (a.price - b.price));
    };

    const bidsRaw = toArray(store.bids, true);
    const asksRaw = toArray(store.asks, false);

    let bidAcc = 0;
    const bids = bidsRaw.map(item => {
        bidAcc += item.size;
        return { ...item, displayPrice: item.price * 100, total: item.price * item.size, cumulative: bidAcc };
    });

    let askAcc = 0;
    const asksProcessed = asksRaw.map(item => {
        askAcc += item.size;
        return { ...item, displayPrice: item.price * 100, total: item.price * item.size, cumulative: askAcc };
    });

    const bestBid = bidsRaw[0]?.price || 0;
    const bestAsk = asksRaw[0]?.price || 0;
    const midPrice = (bestBid && bestAsk) ? (bestBid + bestAsk) / 2 : (bestBid || bestAsk || 0);
    const spread = (bestBid && bestAsk) ? (bestAsk - bestBid) : 0;
    const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;

    return {
        bids,
        asks: asksProcessed.reverse(),
        midPrice,
        spread,
        spreadPercent,
        bestBid,
        bestAsk
    };
}

/**
 * 读取某市场两侧(yes/no)的实时盘口报价(bestAsk/bestBid/midpoint,ratio 0-1)。
 * 用 shallow 比较 6 个原始值:只有"当前选中市场"(其 key 在 orderBookRaw 中)的值会变动
 * 并触发重渲染;未选中行的 key 不在盘口里,恒返回 0,shallow 相等不重渲染 —— 故可放心
 * 给列表每一行使用,不会引起整列表高频重渲染。
 */
export function useSideQuotes(yesKey: string, noKey: string) {
    return useTradingStore((s) => {
        const y = yesKey ? s.getOrderBook(yesKey) : undefined;
        const n = noKey ? s.getOrderBook(noKey) : undefined;
        return {
            yesAsk: y?.bestAsk ?? 0,
            yesBid: y?.bestBid ?? 0,
            yesMid: y?.midPrice ?? 0,
            noAsk: n?.bestAsk ?? 0,
            noBid: n?.bestBid ?? 0,
            noMid: n?.midPrice ?? 0,
        };
    }, shallow);
}
