/**
 * Order Book & Activity Service - 订单簿和交易活动服务
 * 基于文档 docs/API_Order_book_ws.md 和 docs/API_TRADES_ALL.md 实现
 */

// ============== 常量定义 ==============
import { getAuthApiUrl } from '@/lib/config/authApiUrl';
import { LRUMap } from '@/lib/utils/lruMap';
import { safeCloseWebSocket, jitterDelay, nextWsId, wsLog, isWsDebug } from '@/lib/utils/safeCloseWs';

// 静默检测:连续 30s 没收到任何消息就视为连接哑掉,主动重连
const IDLE_TIMEOUT_MS = 30_000;
const IDLE_CHECK_INTERVAL_MS = 15_000;

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
  hash?: string;     // 链上交易哈希,用于跳转区块浏览器
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
  // orderBook 订阅:支持多 marketId 并发(tradingStore + SpotOrderbook 各订自己的 marketId
  // 时不会互相踢)。每个 marketId 一个 refCount,refCount 到 0 才向服务端 unsubscribe。
  private subscribedMarketIds: Set<string> = new Set();
  // trade_message 仍是单租户:同一页面通常只有一个 eventSlug
  private subscribedEventSlug: string | null = null;
  // 当前正在握手中的 connect() Promise:多个 caller 并发 connect 时共享同一个,
  // 替代原来"先到的开 WS,后到的 setInterval 100ms 轮询 readyState"的实现 —
  // 复用 Promise 更省 CPU,且 onerror/onclose-before-open 能立刻拒绝所有等待者
  // 而不必等 10s 兜底超时。
  private connectingPromise: Promise<void> | null = null;
  private subscriptionRefs: Map<string, number> = new Map(); // 订阅引用计数(orderBook)
  private tradeSubscriptionRefs: Map<string, number> = new Map(); // 订阅引用计数(trade_message)
  private isSubscribing = false; // 订阅锁
  private subscriptionQueue: Array<() => void> = []; // 订阅队列
  // disconnect() 后置 true:用于让 await 中的 subscribe 醒来后识别"被取消",静默返回
  // 而不是误判成连接失败。StrictMode dev 下 useEffect 双 mount 会触发该场景。
  private disposed = false;
  // forceReconnect 单飞锁:用户狂点刷新按钮时,旧的 ws 还在 CONNECTING 就开新 ws,
  // 会堆积多条 pending 连接,服务器可能拒接或浏览器报 "WebSocket connection failed"。
  // 在前一次 forceReconnect 的 connect+subscribe 跑完前,忽略后续调用。
  private forceReconnectInFlight = false;
  // 缓存最近一次的 orderbook 快照,key = asset_id;LRU 100 上限,
  // 防长会话浏览过 N 个市场后无界增长
  private lastSnapshots: LRUMap<string, OrderBookSnapshot> = new LRUMap(100);
  // 服务器报"订阅被清理"(channel_inactive/上游断开)时的自动重订阅:防抖 + 次数上限,
  // 收到正常快照后清零,避免上游持续不可用时无限重订阅风暴
  private resubscribeTimer: NodeJS.Timeout | null = null;
  private autoResubscribeCount = 0;
  private maxAutoResubscribe = 5;
  // attemptReconnect 排队中的 setTimeout:forceReconnect/disconnect 时必须 clear,
  // 否则旧 timer 醒来会重复 connect + subscribe,导致 subscriptionRefs 累计泄漏
  private attemptReconnectTimer: NodeJS.Timeout | null = null;
  // 静默检测:云上 LB idle 杀连接但 onclose 不一定及时触发,前端按"30s 无消息"主动重连
  private lastMessageAt = 0;
  private idleCheckTimer: NodeJS.Timeout | null = null;
  // wsDebug:为每条 ws 实例打一个递增 id,串起 CREATE→OPEN→MSG→CLOSE 全生命周期
  private currentWsId: string | null = null;
  private wsConnectedAt = 0;
  // 页面可见性监听:后台 tab 的定时器被浏览器冻结,attemptReconnect/idleCheck 不跑,
  // WS 被 LB idle 断掉后无法自愈。回前台时立即自检,断了就 forceReconnect(不等被节流的定时器)。
  private visibilityHandler: (() => void) | null = null;

  // 连接 WebSocket。多个 caller 并发调用时共享同一个 Promise:
  //   - OPEN:立即 resolve
  //   - CONNECTING(已有 connectingPromise):复用,所有 awaiter 同时被唤醒
  //   - 否则:开新 WS,把握手过程封装成 connectingPromise
  // 握手期间任何一方先到的事件(onopen / onerror / onclose / 10s 超时)负责
  // settle 一次,清空 connectingPromise,后续 connect 调用会触发新一轮。
  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    // 用 localPromise 锁定 identity:外部(forceReconnect / disconnect)若强行
    // 把 connectingPromise 置 null 又开新一轮,旧 promise 的延迟 settle 也不会
    // 误清空新的 connectingPromise(只有匹配 localPromise 时才清)。
    let localPromise: Promise<void>;
     
    localPromise = new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        if (this.connectingPromise === localPromise) {
          this.connectingPromise = null;
        }
        fn();
      };
      // 10s 兜底:握手卡死时让 awaiter 知道失败而不是无限挂起。
      // 同时主动 close 卡住的 ws,避免它停留在 CONNECTING 占资源(孤儿连接,等浏览器自然超时可能很久)
      const timeoutId = setTimeout(() => {
        if (this.ws) {
          try { this.ws.onclose = null; this.ws.onerror = null; } catch { /* ignore */ }
          safeCloseWebSocket(this.ws);
          this.ws = null;
        }
        settle(() => reject(new Error('WebSocket connection timeout')));
      }, 10_000);

      try {
        const wsId = nextWsId('orderBookWS');
        this.currentWsId = wsId;
        this.wsConnectedAt = Date.now();
        wsLog(wsId, 'CREATE', { url: WS_URL });
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          wsLog(wsId, 'OPEN', { elapsedMs: Date.now() - this.wsConnectedAt });
          this.startPingInterval();
          this.startIdleCheck();
          this.startVisibilityWatch();
          settle(resolve);
        };

        this.ws.onmessage = (event) => {
          this.lastMessageAt = Date.now();
          if (isWsDebug()) {
            const len = typeof event.data === 'string' ? event.data.length : 0;
            let kind = 'unknown';
            try {
              const d = JSON.parse(event.data);
              if (Array.isArray(d) && d[0]?.event_type === 'orderbook') kind = `snapshot×${d.length}`;
              else if (d?.event_type === 'price_change') kind = `price_change×${d.price_changes?.length ?? 0}`;
              else if (d?.event_type === 'last_trade_price') kind = 'last_trade_price';
              else if (d?.type === 'trade_message') kind = 'trade_message';
              else if (d?.status) kind = `status:${d.status}`;
              else kind = d?.type || d?.event_type || 'unknown';
            } catch {}
            wsLog(wsId, 'MSG', { kind, bytes: len });
          }
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          wsLog(wsId, 'ERROR', { readyState: this.ws?.readyState });
          console.error('[OrderBookWS] ❌ Error:', error);
          // 不主动 close:onerror 后浏览器会自动 onclose,
          // 在 onclose 里走 attemptReconnect 即可,这里 close 反而触发
          // "WebSocket is closed before connection established" 警告
          settle(() => reject(error));
        };

        this.ws.onclose = (event) => {
          wsLog(wsId, 'CLOSE', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            lifetimeMs: Date.now() - this.wsConnectedAt,
          });
          this.stopPingInterval();
          this.stopIdleCheck();
          // 握手期间(还没 settle)就被 close —— 把等待者 reject 掉,
          // 否则它们会等到 10s 超时才退出
          settle(() => reject(new Error(`WS closed before open: code=${event.code}`)));
          // 只有非正常关闭时才重连
          if (event.code !== 1000) {
            this.attemptReconnect();
          }
        };
      } catch (error) {
        wsLog(this.currentWsId ?? 'orderBookWS:?', 'CTOR_THROW', { err: String(error) });
        console.error('[OrderBookWS] ❌ Failed to create WebSocket:', error);
        settle(() => reject(error));
      }
    });
    this.connectingPromise = localPromise;

    return localPromise;
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
        // 服务器报错(如上游断开 channel_inactive、订阅被清理"请重试"):原来直接吞掉,
        // 导致界面卡在空数据、刷新也无法自愈。这里自动重订阅一次(防抖 + 次数上限)。
        if (parsed.status === 'error') {
          console.warn('[OrderBookWS] subscription error from server:', parsed.message);
          this.scheduleAutoResubscribe();
        }
        return;
      }

      // 订单簿快照 (数组格式)
      if (Array.isArray(parsed) && parsed[0]?.event_type === 'orderbook') {
        // 收到正常数据,重置自动重订阅计数
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
        // 把增量同步合并到 lastSnapshots,让回放的缓存保持「实时合并态」,
        // 根治"晚加入消费者(SpotOrderbook re-mount)回放陈旧快照"的问题。
        // 注意:hash/timestamp 不更新(保留上次全量推送时刻的值),不能用作一致性校验。
        if (Array.isArray(parsed.price_changes)) {
          for (const change of parsed.price_changes) {
            if (change?.asset_id) this.mergeChangeIntoCachedSnapshot(change);
          }
        }
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

  /**
   * 把一条 price_change 增量合并到 lastSnapshots 里对应 asset_id 的快照。
   * 让缓存保持「最新合并态」,addHandler 回放时新消费者拿到的是最新数据而非陈旧 base。
   *
   * 约定 & 风险:
   * - 缓存空(无 base)时跳过:正常协议是订阅时先推全量 snapshot 再推增量,空 base 收到增量
   *   只在异常(snapshot 帧丢)时发生,跳过以避免合成"残缺快照",下一条 snapshot 会重建。
   * - price 用字符串比对(同 OrderBookStore 的 Map<string,string> 一致),依赖后端格式稳定。
   * - 不更新 snapshot.hash / timestamp(保留上次全量值),所以这俩字段不能用作一致性校验
   *   ——本来当前消费者也只读 bids/asks。
   */
  private mergeChangeIntoCachedSnapshot(change: PriceChange) {
    const snap = this.lastSnapshots.get(change.asset_id);
    if (!snap) return; // 没 base,跳过
    const list = change.side === 'BUY' ? snap.bids : snap.asks;
    const sizeNum = parseFloat(change.size);
    const idx = list.findIndex((e) => e.price === change.price);
    if (!Number.isFinite(sizeNum) || sizeNum === 0) {
      // 该档清零 → 删档
      if (idx >= 0) list.splice(idx, 1);
    } else if (idx >= 0) {
      // 改量
      list[idx] = { price: change.price, size: change.size };
    } else {
      // 新档(顺序不维护:消费者 applySnapshot 会重新放进 Map,本就不依赖数组顺序)
      list.push({ price: change.price, size: change.size });
    }
  }

  // 通知处理器:每个 handler 单独 try/catch 隔离,任一抛错不影响其他消费者
  // (SpotOrderbook / tradingStore / useActivity 等共享同一类型事件,缺隔离会出现状态分裂)
  private notifyHandlers(type: string, data: any) {
    const handlers = this.messageHandlers.get(type);
    if (!handlers) return;
    handlers.forEach((handler) => {
      try {
        handler(data);
      } catch (e) {
        console.error('[OrderBookWS] handler threw, isolated to prevent blocking others', { type, error: e });
      }
    });
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
    // 实例已被 disconnect:调用方(SpotOrderbook)在 await connect() 之前就放弃了,
    // 这是合法取消场景,静默返回,不要让上层把它当连接错误显示。
    if (this.disposed) return;

    // 已订阅同一个 marketId:只递增 refCount,不重复发请求
    if (this.subscribedMarketIds.has(marketId)) {
      const currentRefs = this.subscriptionRefs.get(marketId) || 0;
      this.subscriptionRefs.set(marketId, currentRefs + 1);
      return;
    }

    // 如果正在订阅中（其他 marketId）,排队等当前订阅完成再继续
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

      // 关键:await 期间 disconnect() 可能已被调用(StrictMode 双 mount / 切市场 race),
      // 此时 this.ws 已被置 null。这是"调用方放弃"的合法场景,静默返回。
      if (this.disposed || !this.ws) {
        wsLog(this.currentWsId ?? 'orderBookWS:?', 'SUBSCRIBE_CANCELLED', { reason: 'disposed-mid-flight', marketId });
        return;
      }

      if (this.ws.readyState !== WebSocket.OPEN) {
        console.error('[OrderBookWS] ❌ WebSocket not connected after connect()');
        throw new Error('WebSocket not connected');
      }

      // 不再自动 unsubscribe 旧 marketId:每个 marketId 独立 refCount,
      // 调用方(tradingStore / SpotOrderbook)按需自己退订。这样多个消费者订不同
      // marketId 时(如 sports 跨卡片)互不干扰。

      const message = {
        marketId,
        type: 'orderBook',
        operation: 'subscribe',
      };
      this.ws.send(JSON.stringify(message));
      wsLog(this.currentWsId ?? 'orderBookWS:?', 'SEND_SUBSCRIBE', message);
      this.subscribedMarketIds.add(marketId);
      this.subscriptionRefs.set(marketId, 1);
    } finally {
      this.isSubscribing = false;

      // 处理队列中的下一个订阅:try/catch 隔离,防某一次失败阻塞后续 queue
      const next = this.subscriptionQueue.shift();
      if (next) {
        try {
          next();
        } catch (e) {
          console.error('[OrderBookWS] subscription queue handler threw', e);
        }
      }
    }
  }

  // 订阅交易消息(使用 event_slug)。引用计数:同一 eventSlug 第一次订阅才真正发请求,
  // 后续重复订阅只递增计数。这样多个消费者(useActivity + useSessionTradeVolume 等)
  // 共存时,只要还有人在用,服务端订阅就保持。
  async subscribeTradeMessage(eventSlug: string): Promise<void> {
    if (this.disposed) return;

    const currentRefs = this.tradeSubscriptionRefs.get(eventSlug) || 0;
    this.tradeSubscriptionRefs.set(eventSlug, currentRefs + 1);
    if (currentRefs > 0) {
      // 已有人订阅过,只递增 refCount,不重复发请求
      return;
    }

    await this.connect();

    // await 期间 disconnect() 可能已被调用:静默返回(同 subscribeOrderBook)
    if (this.disposed || !this.ws) {
      wsLog(this.currentWsId ?? 'orderBookWS:?', 'SUBSCRIBE_TRADE_CANCELLED', { reason: 'disposed-mid-flight', eventSlug });
      return;
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error('[OrderBookWS] ❌ WebSocket not connected after connect()');
      throw new Error('WebSocket not connected');
    }

    const message = {
      type: 'trade_message',
      operation: 'subscribe',
      event_slug: eventSlug,
    };

    this.ws.send(JSON.stringify(message));
    wsLog(this.currentWsId ?? 'orderBookWS:?', 'SEND_SUBSCRIBE_TRADE', message);
    this.subscribedEventSlug = eventSlug;
  }

  // 取消订阅订单簿(按 marketId 独立 refCount,refCount 到 0 才真正向服务端 unsubscribe)
  async unsubscribeOrderBook(marketId?: string, force: boolean = false): Promise<void> {
    // 不传 marketId 时:取任意一个已订阅的(向后兼容旧用法;实际调用方都会传)
    const idToUnsubscribe = marketId || this.subscribedMarketIds.values().next().value;
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
      this.subscribedMarketIds.delete(idToUnsubscribe);
      return;
    }

    const message = {
      marketId: idToUnsubscribe,
      type: 'orderBook',
      operation: 'unsubscribe',
    };

    this.ws.send(JSON.stringify(message));
    this.subscriptionRefs.delete(idToUnsubscribe);
    this.subscribedMarketIds.delete(idToUnsubscribe);
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
  // 若服务端不识别该 type 会回 status:error,handleMessage 里有兜底过滤,不会触发自动重订阅。
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

  // 重连 —— 永不放弃:前 maxReconnectAttempts 次指数退避(1s,2s,4s,8s,16s)
  // 之后固定 30s 慢速重试,直到 disconnect 被调用。长断线 / 网络抖动恢复后
  // 下一次重试能自动救回,不必用户手动刷新页面。
  private attemptReconnect() {
    // 实例已被销毁:停止重连(disconnect 后唯一的退出路径)
    if (this.disposed) return;

    this.reconnectAttempts++;
    const cappedAttempts = Math.min(this.reconnectAttempts, this.maxReconnectAttempts);
    const baseDelay =
      this.reconnectAttempts <= this.maxReconnectAttempts
        ? this.reconnectDelay * Math.pow(2, cappedAttempts - 1) // 1s,2s,4s,8s,16s
        : 30_000; // 之后固定 30s 慢速重试
    // ±30% 抖动,避免多客户端同时重连风暴
    const delay = jitterDelay(baseDelay);
    wsLog(this.currentWsId ?? 'orderBookWS:?', 'SCHEDULE_RECONNECT', {
      attempts: this.reconnectAttempts,
      delay,
      mode: this.reconnectAttempts <= this.maxReconnectAttempts ? 'exp-backoff' : 'slow-retry',
    });

    // 保存当前所有订阅,重置状态,确保 re-subscribe 时不会被 early-return 跳过。
    // trade 订阅用 tradeSubscriptionRefs.keys() 取**全部** eventSlug(activityWS 同时订阅多个 event 时,
    // subscribedEventSlug 是单值只记最后一个,直接用它会丢前面的订阅 → 重连后只恢复 1 个)
    const savedMarketIds = Array.from(this.subscribedMarketIds);
    const savedEventSlugs = Array.from(this.tradeSubscriptionRefs.keys());
    this.subscribedMarketIds.clear();
    this.subscribedEventSlug = null;
    this.subscriptionRefs.clear();
    this.tradeSubscriptionRefs.clear();

    // 存 timer ref:forceReconnect/disconnect 时清掉,
    // 防止旧 timer 醒来后重复 connect+subscribe 造成 subscriptionRefs 累计泄漏
    this.attemptReconnectTimer = setTimeout(async () => {
      this.attemptReconnectTimer = null;
      if (this.disposed) return;
      try {
        await this.connect();
        // 重新订阅之前持有的每个 marketId(每个独立 refCount = 1,因为状态已 clear)
        for (const marketId of savedMarketIds) {
          await this.subscribeOrderBook(marketId);
        }
        // 恢复所有 trade 订阅(不只一个)
        for (const eventSlug of savedEventSlugs) {
          await this.subscribeTradeMessage(eventSlug);
        }
      } catch (error) {
        console.error('[OrderBookWS] Reconnect failed:', error);
        // connect/subscribe 失败 → ws 没起来,不会触发 onclose,需要这里主动再排一次
        if (!this.disposed) this.attemptReconnect();
      }
    }, delay);
  }

  // 强制重连（用于手动刷新：断开 WS 并重新连接+订阅）
  forceReconnect() {
    // 单飞:前一次 forceReconnect 的 connect+subscribe 还没跑完就直接返回,
    // 防止用户狂点刷新按钮时堆积多条 pending WS 把服务器/浏览器打挂
    if (this.forceReconnectInFlight) {
      wsLog(this.currentWsId ?? 'orderBookWS:?', 'FORCE_RECONNECT_SKIPPED', { reason: 'already-in-flight' });
      return;
    }
    this.forceReconnectInFlight = true;
    wsLog(this.currentWsId ?? 'orderBookWS:?', 'FORCE_RECONNECT');
    // 清除快照缓存，确保收到全新数据
    this.lastSnapshots.clear();
    this.reconnectAttempts = 0;
    this.autoResubscribeCount = 0;
    if (this.resubscribeTimer) {
      clearTimeout(this.resubscribeTimer);
      this.resubscribeTimer = null;
    }
    // 关键:清掉 attemptReconnect 已排队的 setTimeout,否则旧 timer 醒来后会再走一遍
    // connect+subscribe,导致 subscriptionRefs 在已订阅状态上累计 ++(refCount 泄漏)
    if (this.attemptReconnectTimer) {
      clearTimeout(this.attemptReconnectTimer);
      this.attemptReconnectTimer = null;
    }

    const savedMarketIds = Array.from(this.subscribedMarketIds);
    // 同 attemptReconnect:用 keys() 取全部 trade 订阅,而非单值 subscribedEventSlug
    const savedEventSlugs = Array.from(this.tradeSubscriptionRefs.keys());

    // 主动拆掉旧连接:置空 onclose/onerror,避免旧 socket 触发 attemptReconnect 抢跑。
    // 不再依赖"close → onclose → attemptReconnect"链路 —— 旧 socket 若已 CLOSED 或为 null,
    // 那条链路根本不触发,正是"刷新没反应"的根因。这里无论什么状态都统一重连+重订阅。
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      // safeCloseWebSocket:CONNECTING 中的 ws 等握手完再关,避免警告
      safeCloseWebSocket(this.ws);
      this.ws = null;
    }
    this.stopIdleCheck();
    // 主动作废任何挂起的 connect 握手,让接下来的 connect() 起新一轮新连接,
    // 而不是返回那条旧的(其 onopen/onerror 已被置 null,本就不会 settle)
    this.connectingPromise = null;
    this.subscribedMarketIds.clear();
    this.subscribedEventSlug = null;
    this.subscriptionRefs.clear();
    this.tradeSubscriptionRefs.clear();

    void (async () => {
      try {
        await this.connect();
        for (const marketId of savedMarketIds) {
          await this.subscribeOrderBook(marketId);
        }
        for (const eventSlug of savedEventSlugs) {
          await this.subscribeTradeMessage(eventSlug);
        }
      } catch (err) {
        console.error('[OrderBookWS] forceReconnect failed:', err);
      } finally {
        this.forceReconnectInFlight = false;
      }
    })();
  }

  // 服务器清理订阅后的自动重订阅:防抖 + 次数上限(收到正常快照会清零计数)。
  // subscribeOrderBook 对相同 marketId 会 early-return,故必须先清掉 subscribedMarketIds 标记。
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
      const marketIds = Array.from(this.subscribedMarketIds);
      if (marketIds.length === 0) return;
      // 先清订阅标记,否则 subscribeOrderBook 认为"已订阅"直接 early-return,不会重发
      this.subscribedMarketIds.clear();
      marketIds.forEach(id => this.subscriptionRefs.delete(id));
      // 逐个 re-subscribe(每个会重建 refCount=1;原 refCount 信息已丢,但合理:
      // 上游已清理订阅,所有消费者本来就需要等服务端重新推数据)
      marketIds.forEach((id) => {
        this.subscribeOrderBook(id).catch((e) =>
          console.error('[OrderBookWS] auto resubscribe failed:', e)
        );
      });
    }, delay);
  }

  // 断开连接
  disconnect() {
    this.disposed = true;
    this.stopPingInterval();
    this.stopIdleCheck();
    this.stopVisibilityWatch();
    if (this.resubscribeTimer) {
      clearTimeout(this.resubscribeTimer);
      this.resubscribeTimer = null;
    }
    if (this.attemptReconnectTimer) {
      clearTimeout(this.attemptReconnectTimer);
      this.attemptReconnectTimer = null;
    }
    this.autoResubscribeCount = 0;
    // 作废任何挂起的握手,后续(被错误调用的)connect() 会直接 reject
    this.connectingPromise = null;
    if (this.ws) {
      // safeCloseWebSocket:防 CONNECTING 状态下 close 触发警告 + 订阅丢失
      safeCloseWebSocket(this.ws, 1000);
      this.ws = null;
    }
    this.messageHandlers.clear();
    this.subscribedMarketIds.clear();
    this.subscribedEventSlug = null;
    this.subscriptionRefs.clear();
    this.tradeSubscriptionRefs.clear();
  }

  // 启动静默检测:>30s 未收到任何消息 → 主动重连
  private startIdleCheck() {
    this.stopIdleCheck();
    this.lastMessageAt = Date.now();
    this.idleCheckTimer = setInterval(() => {
      const idleMs = Date.now() - this.lastMessageAt;
      if (idleMs > IDLE_TIMEOUT_MS) {
        console.warn('[OrderBookWS] idle >', IDLE_TIMEOUT_MS, 'ms — force reconnect', { wsId: this.currentWsId, idleMs });
        wsLog(this.currentWsId ?? 'orderBookWS:?', 'IDLE_FORCE_RECONNECT', { idleMs });
        this.stopIdleCheck();
        // 走 forceReconnect 完整流程(重连 + 重订阅)
        this.forceReconnect();
      }
    }, IDLE_CHECK_INTERVAL_MS);
  }

  private stopIdleCheck() {
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = null;
    }
  }

  // 页面回前台时立即自检:WS 不是 OPEN 就 forceReconnect。
  // 后台 tab 定时器被冻结,attemptReconnect / idleCheck 排队不执行,WS 被 LB idle 断后无法自愈;
  // 这里在 visibilitychange→visible 的瞬间主动救,不依赖被节流的定时器。
  private startVisibilityWatch() {
    if (typeof document === 'undefined' || this.visibilityHandler) return;
    this.visibilityHandler = () => {
      if (this.disposed) return;
      if (document.visibilityState !== 'visible') return;
      // notOpen:连接已断;stale:readyState 仍 OPEN 但 >30s 无消息(后台被断成僵尸连接,
      // 前端没收到 close)。两者都 forceReconnect 拿新 snapshot,无害。
      const notOpen = this.ws?.readyState !== WebSocket.OPEN;
      const stale = Date.now() - this.lastMessageAt > IDLE_TIMEOUT_MS;
      if (notOpen || stale) {
        wsLog(this.currentWsId ?? 'orderBookWS:?', 'VISIBILITY_RECONNECT', {
          readyState: this.ws?.readyState,
          stale,
        });
        this.forceReconnect();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private stopVisibilityWatch() {
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    this.visibilityHandler = null;
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

// =============================================================================
// activityWS:trade_message 专用单例
//
// 后端约束:订单簿 WS 必须"切市场就断开重开",所以 orderBook 不能挂在持久单例上。
// 但 trade_message 是按 eventSlug 订阅,跨市场不需要断,可以共享一条持久 WS。
// 一个 page 内的 useActivity / useSessionTradeVolume / LivePriceChart 成交流
// 全部通过 activityWS 复用同一条 WS,refCount 由 OrderBookWebSocket 类自管。
// =============================================================================
export const activityWS = new OrderBookWebSocket();

// =============================================================================
// 订单簿 WS:按 marketId 独立实例,满足"切市场断开新开"的后端约束
//
// orderbookRegistry: Map<marketId, { ws, refCount }>
//   - 同一个 marketId 第一次 acquire → new OrderBookWebSocket(),refCount=1
//   - 同一个 marketId 第二次 acquire(如 tradingStore + SpotOrderbook 都订)
//     → refCount++,复用同一实例(避免一个市场开两条 WS)
//   - release → refCount--,到 0 时 disconnect() 并从注册表删除
//
// 这样:
//   - 同一市场被多个消费者订阅:共享 1 条 WS(去重)
//   - 切市场:旧市场最后一个消费者 release → disconnect;
//             新市场首个 acquire → new WebSocket()(满足后端约束)
// =============================================================================
interface OrderbookEntry {
  ws: OrderBookWebSocket;
  refCount: number;
}
const orderbookRegistry: Map<string, OrderbookEntry> = new Map();

export function acquireOrderbookWS(marketId: string): OrderBookWebSocket {
  let entry = orderbookRegistry.get(marketId);
  if (entry) {
    entry.refCount++;
    return entry.ws;
  }
  const ws = new OrderBookWebSocket();
  entry = { ws, refCount: 1 };
  orderbookRegistry.set(marketId, entry);
  return ws;
}

export function releaseOrderbookWS(marketId: string): void {
  const entry = orderbookRegistry.get(marketId);
  if (!entry) return;
  entry.refCount--;
  if (entry.refCount <= 0) {
    entry.ws.disconnect();
    orderbookRegistry.delete(marketId);
  }
}

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
    // 归一交易哈希字段(后端字段名可能为 hash / transactionHash / transaction_hash / txHash)
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
