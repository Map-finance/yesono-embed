import { WS_URL } from "@/lib/services/orderBookService";
import { PolymarketEventResp, PolymarketMarketResp } from "@/types/home";
import { create } from "zustand";

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

interface OrderBookEntry {
  price: string;
  size: string;
}

interface OrderBookSnapshot {
  asset_id: string;
  event_type: 'orderbook';
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

interface PriceChange {
  asset_id: string;
  price: string;
  size: string;
  side: 'BUY' | 'SELL';
}

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

// Global WebSocket State (Module Level)
let ws: WebSocket | null = null;
let activeMarketId: string | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

// 节流：将高频 WS 消息批量合并，最多 500ms 刷新一次 Zustand store
// 避免每条 price_change 消息都触发全量组件重渲染
let throttleTimer: NodeJS.Timeout | null = null;
let pendingRaw: Record<string, AssetStore> | null = null;

export const useTradingStore = create<TradingStore & TradingStoreActions>((set, get) => ({
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

        // If market changed or is explicitly null
        if (currentMarketId !== newMarketId) {
             // 1. Cleanup old connection
             // 先清除 activeMarketId，再关闭 ws，防止 onclose 在 activeMarketId
             // 清空前触发，导致为旧市场创建幽灵重连定时器
             activeMarketId = null;
             if (reconnectTimer) {
                 clearTimeout(reconnectTimer);
                 reconnectTimer = null;
             }
             // 切换 market 时丢弃未提交的批次，防止旧数据污染新 market
             if (throttleTimer) {
                 clearTimeout(throttleTimer);
                 throttleTimer = null;
             }
             pendingRaw = null;
             if (ws) {
                 ws.close();
                 ws = null;
             }

             // 2. Clear data and Update State
             set({ 
                 market, 
                 // If clearing market, clear outcome. If setting new, default to first clobToken
                 selectOutcomeId: market ? (JSON.parse(market.clobTokenIds || '[]') as string[])[0] || null : null,
                 direction: "BUY",
                 orderBookRaw: {},
                 isConnected: false
             });

             // 3. Connect new
             if (newMarketId) {
                activeMarketId = newMarketId;
                connectWS(newMarketId, set, get);
             }
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
         if (ws) {
             ws.close();
             ws = null;
         }
         if (reconnectTimer) clearTimeout(reconnectTimer);
         if (throttleTimer) { clearTimeout(throttleTimer); throttleTimer = null; }
         pendingRaw = null;
         activeMarketId = null;
         set({ isConnected: false, market: null, orderBookRaw: {} });
    }
}));

// ============== Helper Functions ==============

function connectWS(marketId: string, set: any, get: any) {
    if (ws) return; // Already connecting or connected
    try {
        ws = new WebSocket(WS_URL);
        
        ws.onopen = () => {
            if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    marketId,
                    type: 'orderBook',
                    operation: 'subscribe',
                }));
                set({ isConnected: true });
            }
        };

        ws.onmessage = (event) => {
            // Check if this socket is still the active one
            if (activeMarketId !== marketId) return;

            try {
                const data = JSON.parse(event.data);
                // 始终写入 pendingRaw（而非直接读取 store），确保批量合并所有挂起的变更
                if (!pendingRaw) {
                    pendingRaw = { ...get().orderBookRaw };
                }
                // after init above, pendingRaw is non-null
                const nextRaw = pendingRaw!;
                let hasUpdate = false;

                // Handle Snapshot
                if (Array.isArray(data) && data[0]?.event_type === 'orderbook') {
                    data.forEach((snap: OrderBookSnapshot) => {
                        if (!nextRaw[snap.asset_id]) {
                            nextRaw[snap.asset_id] = { bids: new Map(), asks: new Map() };
                        }
                        const store = nextRaw[snap.asset_id];
                        store.bids.clear();
                        store.asks.clear();
                        snap.bids.forEach(x => Number(x.size) > 0 && store.bids.set(x.price, x.size));
                        snap.asks.forEach(x => Number(x.size) > 0 && store.asks.set(x.price, x.size));
                    });
                    hasUpdate = true;
                }

                // Handle Update
                if (data.event_type === 'price_change' && Array.isArray(data.price_changes)) {
                     data.price_changes.forEach((change: PriceChange) => {
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
                     hasUpdate = true;
                }

                // 节流刷新：500ms 内多条消息只触发一次 setState，大幅减少全量重渲染次数
                if (hasUpdate && !throttleTimer) {
                    throttleTimer = setTimeout(() => {
                        throttleTimer = null;
                        if (pendingRaw && activeMarketId === marketId) {
                            set({ orderBookRaw: pendingRaw });
                        }
                        pendingRaw = null;
                    }, 500);
                }

            } catch(e) {
                console.error("WS Parse Error", e);
            }
        };

        ws.onclose = (e) => {
            // Only update disjointed state if this was the active market
            if (activeMarketId === marketId) {
                set({ isConnected: false });
                ws = null; 
                if (e.code !== 1000) {
                    reconnectTimer = setTimeout(() => {
                        connectWS(marketId, set, get);
                    }, 3000);
                }
            }
        };

        ws.onerror = (e) => {
             console.error("WS Error", e);
        };

    } catch (e) {
        console.error("WS Connect Error", e);
        reconnectTimer = setTimeout(() => {
             connectWS(marketId, set, get);
         }, 3000);
    }
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
