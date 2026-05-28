/**
 * Order Book & Activity Service - 订单簿和交易活动服务
 * 基于文档 docs/API_Order_book_ws.md 和 docs/API_TRADES_ALL.md 实现
 */

// ============== 常量定义 ==============
import { getAuthApiUrl } from '@/lib/config/authApiUrl';
import { LRUMap } from '@/lib/utils/lruMap';

// §6.1 #6: WS URL 顶层校验，缺值直接 throw（启动期暴露），禁用 process.env.XXX! 非空断言
const RAW_WS_URL = process.env.NEXT_PUBLIC_ORDERBOOK_WS_URL;
if (!RAW_WS_URL) {
  throw new Error("NEXT_PUBLIC_ORDERBOOK_WS_URL is required");
}
export const WS_URL: string = RAW_WS_URL;
const API_BASE_URL = getAuthApiUrl('/api');

// ============== 类型定义 ==============

// 订单簿条目
export interface OrderBookEntry {
  price: string;
  size: string;
}

// 订单簿快照数据
export interface OrderBookSnapshot {
  asset_id: string;
  timestamp: string;
  hash: string;
  event_type: 'orderbook';
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

// 价格变化数据
export interface PriceChange {
  asset_id: string;
  price: string;
  size: string;
  side: 'BUY' | 'SELL';
  hash: string;
  best_bid: string;
  best_ask: string;
}

// 价格变化消息
export interface PriceChangeMessage {
  timestamp: string;
  event_type: 'price_change';
  price_changes: PriceChange[];
}

// 最新成交价格消息
export interface LastTradePriceMessage {
  event_type: 'last_trade_price';
  market: string;
  asset_id: string;
  price: string;
  size: string;
  fee_rate_bps: string;
  side: 'BUY' | 'SELL';
  timestamp: string;
  transaction_hash: string;
  address: string;
}

// 交易消息
export interface TradeMessage {
  type: 'trade_message';
  userId: string;
  name: string;
  profileImage: string;
  outcome: string;
  price: number;
  side: 'BUY' | 'SELL';
  size: number;
  timestamp: number;
  assetId?: string;  // 对应 outcome 列表中的 market
  hash?: string;     // 链上交易哈希
}

// WebSocket 订阅响应
export interface SubscriptionResponse {
  status: 'success' | 'error';
  message: string;
  assets_ids?: string[];
  event_id?: string[];
}

// 处理后的订单簿条目 (用于UI显示)
export interface ProcessedOrderBookEntry {
  price: number;       // 原始价格
  displayPrice: number; // 显示价格 (price * 100)
  size: number;
  total: number;       // 累计金额 Σ(size×price),到该档为止(深度,对齐 Polymarket Total 列)
  cumulative: number;  // 累计份额,到该档为止(深度条宽度用)
}

// 处理后的订单簿数据
export interface ProcessedOrderBook {
  asks: ProcessedOrderBookEntry[];
  bids: ProcessedOrderBookEntry[];
  midPrice: number;
  spread: number;
  spreadPercent: number;
  bestBid: number;
  bestAsk: number;
}

// 交易记录 (用于Activity列表)
export interface TradeRecord {
  userId: string;
  name: string;
  profileImage: string;
  outcome: string;
  price: number;
  side: 'BUY' | 'SELL';
  size: number;
  timestamp: number;
  assetId?: string;  // 对应 outcome 列表中的 market
  hash?: string;     // 链上交易哈希
}

// API 响应
export interface TradesApiResponse {
  success: boolean;
  code: number;
  msg: string;
  data: TradeRecord[];
}

// ============== WebSocket 管理类 ==============

type MessageHandler = (data: any) => void;

export class OrderBookWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private pingInterval: NodeJS.Timeout | null = null;
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private subscribedMarketId: string | null = null;
  private subscribedEventSlug: string | null = null;
  private isConnecting = false;
  private subscriptionRefs: Map<string, number> = new Map(); // 订阅引用计数(orderBook)
  private tradeSubscriptionRefs: Map<string, number> = new Map(); // 订阅引用计数(trade_message)
  private isSubscribing = false; // 订阅锁
  private subscriptionQueue: Array<() => void> = []; // 订阅队列
  // 缓存最近一次的 orderbook 快照，key = asset_id
  private lastSnapshots: LRUMap<string, OrderBookSnapshot> = new LRUMap(100);
  // 服务器报"订阅被清理"(channel_inactive/上游断开)时的自动重订阅：防抖 + 次数上限，
  // 收到正常快照后清零，避免上游持续不可用时无限重订阅风暴
  private resubscribeTimer: NodeJS.Timeout | null = null;
  private autoResubscribeCount = 0;
  private maxAutoResubscribe = 5;

  // 连接 WebSocket
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        // 等待连接完成（最多 10 秒超时）
        let elapsed = 0;
        const checkConnection = setInterval(() => {
          elapsed += 100;
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            resolve();
          } else if (elapsed >= 10000) {
            clearInterval(checkConnection);
            reject(new Error('WebSocket connection timeout while waiting'));
          }
        }, 100);
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startPingInterval();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('[OrderBookWS] ❌ Error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = (event) => {
          this.isConnecting = false;
          this.stopPingInterval();
          // 只有非正常关闭时才重连
          if (event.code !== 1000) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        console.error('[OrderBookWS] ❌ Failed to create WebSocket:', error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // 处理消息
  private handleMessage(data: string) {
    try {
      const parsed = JSON.parse(data);

      // 处理订阅响应
      if (parsed.status === 'success' || parsed.status === 'error') {
        // 应用层 ping 保活:若服务端不识别 type:ping 会回错误,这里吞掉,
        // 否则会被下面的 scheduleAutoResubscribe 误触发(ping 失败 ≠ 订阅失效)
        if (parsed.message?.includes('ping')) {
          return;
        }
        // 服务器报错（上游断开 channel_inactive、订阅被清理"请重试"）：原来直接吞掉，
        // 导致界面卡在空数据、刷新也无法自愈。这里自动重订阅一次（防抖 + 次数上限）。
        if (parsed.status === 'error') {
          console.warn('[OrderBookWS] subscription error from server:', parsed.message);
          this.scheduleAutoResubscribe();
        }
        return;
      }

      // 订单簿快照 (数组格式)
      if (Array.isArray(parsed) && parsed[0]?.event_type === 'orderbook') {
        // 收到正常数据，重置自动重订阅计数
        this.autoResubscribeCount = 0;
        // 更新缓存（按 asset_id 存储），然后通知处理器
        try {
          parsed.forEach((snap: OrderBookSnapshot) => {
            if (snap?.asset_id) this.lastSnapshots.set(snap.asset_id, snap);
          });
        } catch (e) {
          console.warn('[OrderBookWS] Failed to update snapshot cache', e);
        }

        this.notifyHandlers('orderbook_snapshot', parsed);
        return;
      }

      // 价格变化
      if (parsed.event_type === 'price_change') {
        this.notifyHandlers('price_change', parsed);
        return;
      }

      // 最新成交价格
      if (parsed.event_type === 'last_trade_price') {
        this.notifyHandlers('last_trade_price', parsed);
        return;
      }

      // 交易消息
      if (parsed.type === 'trade_message') {
        this.notifyHandlers('trade_message', parsed);
        return;
      }
    } catch (error) {
      console.error('[OrderBookWS] Failed to parse message:', error);
    }
  }

  // 通知处理器
  private notifyHandlers(type: string, data: any) {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  // 添加消息处理器
  addHandler(type: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // 如果是订阅快照的 handler 并且缓存中已有快照，立即回放给新 handler
    if (type === 'orderbook_snapshot' && this.lastSnapshots.size > 0) {
      try {
        const snapshots = Array.from(this.lastSnapshots.values());
        // 调用 handler 异步回放（保持与真实消息处理一致的异步语义）
        setTimeout(() => {
          try { handler(snapshots); } catch (e) { console.error('[OrderBookWS] handler replay failed', e); }
        }, 0);
      } catch (e) {
        console.warn('[OrderBookWS] Failed to replay cached snapshots to new handler', e);
      }
    }
  }

  // 移除消息处理器
  removeHandler(type: string, handler: MessageHandler) {
    this.messageHandlers.get(type)?.delete(handler);
  }

  // 订阅订单簿 (使用 marketId)
  async subscribeOrderBook(marketId: string): Promise<void> {
    
    // 检查是否已经订阅了同一个 marketId
    if (this.subscribedMarketId === marketId) {
      const currentRefs = this.subscriptionRefs.get(marketId) || 0;
      this.subscriptionRefs.set(marketId, currentRefs + 1);
      return;
    }

    // 如果正在订阅中，等待当前订阅完成
    if (this.isSubscribing) {
      return new Promise((resolve) => {
        this.subscriptionQueue.push(() => {
          this.subscribeOrderBook(marketId).then(resolve);
        });
      });
    }

    this.isSubscribing = true;
    
    try {
      await this.connect();

      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.error('[OrderBookWS] ❌ WebSocket not connected after connect()');
        throw new Error('WebSocket not connected');
      }

      // 如果之前订阅了其他市场，先取消订阅
      if (this.subscribedMarketId && this.subscribedMarketId !== marketId) {
        await this.unsubscribeOrderBook(this.subscribedMarketId);
      }

      const message = {
        marketId,
        type: 'orderBook',
        operation: 'subscribe',
      };
      this.ws.send(JSON.stringify(message));
      this.subscribedMarketId = marketId;
      this.subscriptionRefs.set(marketId, 1);
    } finally {
      this.isSubscribing = false;
      
      // 处理队列中的下一个订阅
      const next = this.subscriptionQueue.shift();
      if (next) {
        next();
      }
    }
  }

  // 订阅交易消息(使用 event_slug)。引用计数:同一 eventSlug 第一次订阅才真正发请求,
  // 后续重复订阅只递增计数。这样多个消费者(useActivity + useSessionTradeVolume 等)
  // 共存时,只要还有人在用,服务端订阅就保持。
  async subscribeTradeMessage(eventSlug: string): Promise<void> {
    const currentRefs = this.tradeSubscriptionRefs.get(eventSlug) || 0;
    this.tradeSubscriptionRefs.set(eventSlug, currentRefs + 1);
    if (currentRefs > 0) {
      // 已有人订阅过,只递增 refCount,不重复发请求
      return;
    }

    await this.connect();

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[OrderBookWS] ❌ WebSocket not connected after connect()');
      throw new Error('WebSocket not connected');
    }

    const message = {
      type: 'trade_message',
      operation: 'subscribe',
      event_slug: eventSlug,
    };

    this.ws.send(JSON.stringify(message));
    this.subscribedEventSlug = eventSlug;
  }

  // 取消订阅订单簿
  async unsubscribeOrderBook(marketId?: string, force: boolean = false): Promise<void> {
    const idToUnsubscribe = marketId || this.subscribedMarketId;
    if (!idToUnsubscribe) {
      return;
    }

    // 强制取消订阅：忽略引用计数（用于用户手动刷新场景）
    if (!force) {
      // 减少引用计数
      const currentRefs = this.subscriptionRefs.get(idToUnsubscribe) || 0;
      if (currentRefs > 1) {
        this.subscriptionRefs.set(idToUnsubscribe, currentRefs - 1);
        return;
      }
    } else {
      console.log('[OrderBookWS] Force-unsubscribe requested for marketId:', idToUnsubscribe);
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // 即使 websocket 不可用，也要清理本地引用计数
      this.subscriptionRefs.delete(idToUnsubscribe);
      if (this.subscribedMarketId === idToUnsubscribe) this.subscribedMarketId = null;
      return;
    }

    const message = {
      marketId: idToUnsubscribe,
      type: 'orderBook',
      operation: 'unsubscribe',
    };

    this.ws.send(JSON.stringify(message));
    this.subscriptionRefs.delete(idToUnsubscribe);
    if (this.subscribedMarketId === idToUnsubscribe) {
      this.subscribedMarketId = null;
    }
  }

  // 取消订阅交易消息。引用计数:仅当最后一个消费者退订时,才真正发 unsubscribe 给服务端。
  async unsubscribeTradeMessage(eventSlug?: string): Promise<void> {
    const slugToUnsub = eventSlug || this.subscribedEventSlug;
    if (!slugToUnsub) return;

    const currentRefs = this.tradeSubscriptionRefs.get(slugToUnsub) || 0;
    if (currentRefs > 1) {
      this.tradeSubscriptionRefs.set(slugToUnsub, currentRefs - 1);
      return;
    }
    this.tradeSubscriptionRefs.delete(slugToUnsub);

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // WS 已不可用,本地状态已清,直接返回
      if (this.subscribedEventSlug === slugToUnsub) this.subscribedEventSlug = null;
      return;
    }

    const message = {
      type: 'trade_message',
      operation: 'unsubscribe',
      event_slug: slugToUnsub,
    };

    this.ws.send(JSON.stringify(message));
    if (this.subscribedEventSlug === slugToUnsub) this.subscribedEventSlug = null;
  }

  // 应用层心跳:20s 发一次 {type:'ping'} 保活。
  // 协议层 ping/pong 由浏览器内核自动处理(服务器发 ping → 浏览器自动回 pong),
  // JS 不可见、也无法主动发协议层 ping,所以这里走应用层 JSON 消息。
  // 若服务端不识别该 type 会回 status:error,handleMessage 里有兜底过滤(message 含 ping),
  // 不会触发自动重订阅。
  private startPingInterval() {
    this.stopPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 20_000);
  }

  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // 重连
  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[OrderBookWS] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    // 保存当前订阅，重置状态，确保 re-subscribe 时不会被 early-return 跳过
    const savedMarketId = this.subscribedMarketId;
    const savedEventSlug = this.subscribedEventSlug;
    this.subscribedMarketId = null;
    this.subscribedEventSlug = null;
    this.subscriptionRefs.clear();

    setTimeout(async () => {
      try {
        await this.connect();
        // 重新订阅
        if (savedMarketId) {
          await this.subscribeOrderBook(savedMarketId);
        }
        if (savedEventSlug) {
          await this.subscribeTradeMessage(savedEventSlug);
        }
      } catch (error) {
        console.error('[OrderBookWS] Reconnect failed:', error);
      }
    }, delay);
  }

  // 强制重连（用于手动刷新：断开 WS 并重新连接+订阅）
  forceReconnect() {
    // 清除快照缓存，确保收到全新数据
    this.lastSnapshots.clear();
    this.reconnectAttempts = 0;
    this.autoResubscribeCount = 0;
    if (this.resubscribeTimer) {
      clearTimeout(this.resubscribeTimer);
      this.resubscribeTimer = null;
    }

    const savedMarketId = this.subscribedMarketId;
    const savedEventSlug = this.subscribedEventSlug;

    // 主动拆掉旧连接：置空 onclose/onerror，避免旧 socket 触发 attemptReconnect 抢跑。
    // 不再依赖"close → onclose → attemptReconnect"链路 —— 旧 socket 若已 CLOSED 或为 null，
    // 那条链路根本不触发，正是"刷新没反应"的根因。这里无论什么状态都统一重连+重订阅。
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.isConnecting = false;
    this.subscribedMarketId = null;
    this.subscribedEventSlug = null;
    this.subscriptionRefs.clear();

    void (async () => {
      try {
        await this.connect();
        if (savedMarketId) await this.subscribeOrderBook(savedMarketId);
        if (savedEventSlug) await this.subscribeTradeMessage(savedEventSlug);
      } catch (err) {
        console.error('[OrderBookWS] forceReconnect failed:', err);
      }
    })();
  }

  // 服务器清理订阅后的自动重订阅：防抖 + 次数上限（收到正常快照会清零计数）。
  // subscribeOrderBook 对相同 marketId 会 early-return，故必须先清掉 subscribedMarketId。
  private scheduleAutoResubscribe() {
    if (this.resubscribeTimer) return; // 已排队
    if (this.autoResubscribeCount >= this.maxAutoResubscribe) {
      console.warn('[OrderBookWS] 达到自动重订阅上限，停止重试');
      return;
    }
    const delay = this.reconnectDelay * Math.pow(2, this.autoResubscribeCount);
    this.autoResubscribeCount++;
    this.resubscribeTimer = setTimeout(() => {
      this.resubscribeTimer = null;
      const marketId = this.subscribedMarketId;
      if (!marketId) return;
      // 先清订阅标记，否则 subscribeOrderBook 认为"已订阅"直接返回，不会重发
      this.subscribedMarketId = null;
      this.subscriptionRefs.delete(marketId);
      this.subscribeOrderBook(marketId).catch((e) =>
        console.error('[OrderBookWS] auto resubscribe failed:', e)
      );
    }, delay);
  }

  // 断开连接
  disconnect() {
    this.stopPingInterval();
    if (this.resubscribeTimer) {
      clearTimeout(this.resubscribeTimer);
      this.resubscribeTimer = null;
    }
    this.autoResubscribeCount = 0;
    if (this.ws) {
      this.ws.close(1000);
      this.ws = null;
    }
    this.messageHandlers.clear();
    this.subscribedMarketId = null;
    this.subscribedEventSlug = null;
    this.subscriptionRefs.clear();
  }

  // 获取连接状态
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // 返回缓存快照（按 asset_id 列表）
  getCachedSnapshots(assetIds: string[]) {
    return assetIds.map(id => this.lastSnapshots.get(id)).filter(Boolean) as OrderBookSnapshot[];
  }
}

// 单例实例：订单簿专用
export const orderBookWS = new OrderBookWebSocket();
// 单例实例：Activity 交易消息专用（独立连接，不和订单簿共用）
export const activityWS = new OrderBookWebSocket();

// ============== 订单簿数据处理 ==============

// 订单簿存储 (以 price 为唯一键)
export class OrderBookStore {
  private bids: Map<string, string> = new Map(); // price -> size
  private asks: Map<string, string> = new Map(); // price -> size

  // 应用快照
  applySnapshot(snapshot: OrderBookSnapshot) {
    this.bids.clear();
    this.asks.clear();

    snapshot.bids.forEach(entry => {
      if (parseFloat(entry.size) > 0) {
        this.bids.set(entry.price, entry.size);
      }
    });

    snapshot.asks.forEach(entry => {
      if (parseFloat(entry.size) > 0) {
        this.asks.set(entry.price, entry.size);
      }
    });
  }

  // 应用增量更新
  applyUpdate(change: PriceChange) {
    const map = change.side === 'BUY' ? this.bids : this.asks;
    const size = parseFloat(change.size);

    if (size === 0) {
      // size 为 0 则删除该价格
      map.delete(change.price);
    } else {
      // 更新或添加
      map.set(change.price, change.size);
    }
  }

  // 获取处理后的订单簿数据
  getProcessedOrderBook(): ProcessedOrderBook {
    // 转换并排序 bids (从高到低)
    const bids = Array.from(this.bids.entries())
      .map(([price, size]) => {
        const p = parseFloat(price);
        const s = parseFloat(size);
        return {
          price: p,
          displayPrice: p * 100, // price * 100
          size: s,
          total: 0, // 由下方累计循环填充为「累计金额」
          cumulative: 0,
        };
      })
      .sort((a, b) => b.price - a.price);

    // 转换并排序 asks (从低到高)
    const asks = Array.from(this.asks.entries())
      .map(([price, size]) => {
        const p = parseFloat(price);
        const s = parseFloat(size);
        return {
          price: p,
          displayPrice: p * 100, // price * 100
          size: s,
          total: 0, // 由下方累计循环填充为「累计金额」
          cumulative: 0,
        };
      })
      .sort((a, b) => a.price - b.price);

    // 计算累计量:cumulative = 累计份额(深度条用);total = 累计金额 Σ(size×price)。
    // 均从"最优档 → 最差档"方向累加(bids 高→低、asks 低→高),对齐 Polymarket 的 Total 列
    // (Total 是到该档为止的累计成交额/深度,不是当前档的 size×price)。
    let bidCumulative = 0;
    let bidTotal = 0;
    bids.forEach(entry => {
      bidCumulative += entry.size;
      bidTotal += entry.size * entry.price;
      entry.cumulative = bidCumulative;
      entry.total = bidTotal;
    });

    let askCumulative = 0;
    let askTotal = 0;
    asks.forEach(entry => {
      askCumulative += entry.size;
      askTotal += entry.size * entry.price;
      entry.cumulative = askCumulative;
      entry.total = askTotal;
    });

    // 计算中间价和价差
    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const midPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : bestBid || bestAsk;
    const spread = bestAsk - bestBid;
    const spreadPercent = midPrice > 0 ? (spread / midPrice) * 100 : 0;

    return {
      bids,
      asks: asks.reverse(), // 显示时从高到低
      midPrice,
      spread,
      spreadPercent,
      bestBid,
      bestAsk,
    };
  }
}

// ============== API 服务函数 ==============

/**
 * 获取所有交易数据 (Activity 列表)
 * GET /api/trades1/all
 */
export async function getAllTrades(
  eventId: string,
  limit: number = 10,
  offset: number = 0,
  filterAmount: number = 1
): Promise<TradesApiResponse> {
  const params = new URLSearchParams({
    eventId,
    limit: String(limit),
    offset: String(offset),
    filterAmount: String(filterAmount),
  });

  try {
    const response = await fetch(`${API_BASE_URL}/trades1/all?${params}`);
    const data = await response.json();
    // 归一交易哈希字段（后端字段名可能为 hash / transactionHash / transaction_hash / txHash）
    if (data && Array.isArray(data.data)) {
      data.data = data.data.map((r: any) => ({
        ...r,
        hash:
          r?.hash ??
          r?.transactionHash ??
          r?.transaction_hash ??
          r?.txHash ??
          undefined,
      }));
    }
    return data;
  } catch (error) {
    console.error('[OrderBookService] Failed to fetch trades:', error);
    return {
      success: false,
      code: 500,
      msg: 'Failed to fetch trades',
      data: [],
    };
  }
}

// ============== 辅助函数 ==============

/**
 * 格式化价格显示 (price * 100 + ¢)
 */
export function formatDisplayPrice(price: number, decimals: number = 1): string {
  return (price * 100).toFixed(decimals) + '¢';
}

/**
 * 格式化数量
 */
export function formatSize(size: number): string {
  if (size >= 1000000) return (size / 1000000).toFixed(2) + 'M';
  if (size >= 1000) return (size / 1000).toFixed(1) + 'K';
  return size.toLocaleString();
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp: number | string): string {
  const date = new Date(Number(timestamp));
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const isZh = typeof window !== 'undefined' && (localStorage.getItem('locale') === 'zh-CN' || localStorage.getItem('locale') === 'zh-TW');

  if (diff < 60000) {
    return isZh ? '刚刚' : 'Just now';
  }
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return isZh ? `${minutes}分钟前` : `${minutes}m ago`;
  }
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return isZh ? `${hours}小时前` : `${hours}h ago`;
  }
  return date.toLocaleDateString(isZh ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
}
