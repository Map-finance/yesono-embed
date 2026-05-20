/**
 * Live price + trade tape WebSocket manager.
 * 实现 docs/react-component-guide.md §6.1 的 Manager 模式：
 *   - 共享单条底层 WebSocket 连接
 *   - 暴露 subscribePrice / subscribeTrades 两个频道
 *   - 内置指数退避重连、心跳-style 由服务端主导（无需 ping）
 *   - 引用计数 + iframe visibility pause
 *
 * 协议（统一按 eventId 订阅，operation 固定 subscribe，type 区分行情类型）：
 *   - price 订阅：{ operation: "subscribe", type: "cryptoPrice" | "objectivePrice", eventId }
 *       · 加密货币用 cryptoPrice，金融（objective）用 objectivePrice
 *     收到：
 *       { type: "subscribe", topic: "crypto_prices",          payload: { data: [...] } } → snapshot（两类通用）
 *       { type: "update",    topic: "crypto_prices_chainlink", payload: { timestamp, value } } → crypto update
 *       { type: "update",    topic: "crypto_prices", price, timestamp }                       → finance update（顶层 price/timestamp）
 *     注：响应不回显 eventId，单组件单订阅场景按"广播给所有活跃 price 订阅"分发。
 *   - trade 订阅：{ operation: "subscribe", type: "trade_message", event_slug }
 *     收到：{ type: "trade_message", side, price, size, ... }
 */

import type { Time } from "lightweight-charts";

// §6.1 #6: WS URL 必须模块顶层校验，禁用非空断言
const RAW_WS_URL = process.env.NEXT_PUBLIC_ORDERBOOK_WS_URL;
if (!RAW_WS_URL) {
  throw new Error("NEXT_PUBLIC_ORDERBOOK_WS_URL is required");
}
const WS_URL: string = RAW_WS_URL;

// ============== 公共类型 ==============

export interface PricePoint {
  time: Time;
  value: number;
}

/** price 频道行情类型：crypto=cryptoPrice，finance=objectivePrice */
export type PriceKind = "crypto" | "finance";

/** 价格频道事件（discriminated union，§6.1 #4）。eventId 为订阅键 */
export type PriceMsg =
  | { type: "snapshot"; eventId: string; data: PricePoint[] }
  | { type: "update"; eventId: string; point: PricePoint }
  /** 服务端不支持该 eventId（>3s 无真实数据，或 close 时仍未收到数据） */
  | { type: "unsupported"; eventId: string };

export type PriceHandler = (msg: PriceMsg) => void;

/** 交易频道事件 */
export type TradeMsg = {
  type: "trade";
  eventSlug: string;
  side: "BUY" | "SELL";
  price: number;
  size: number;
};

export type TradeHandler = (msg: TradeMsg) => void;

// ============== 内部常量 ==============

const UNSUPPORTED_TIMEOUT_MS = 3000;
const RECONNECT_BASE_MS = 1500;
const RECONNECT_MAX_MS = 30_000;
const MAX_RECONNECT_ATTEMPTS = 10;

interface PriceSub {
  refs: number;
  handlers: Set<PriceHandler>;
  hasData: boolean;
  unsupportedTimer: ReturnType<typeof setTimeout> | null;
  unsupportedEmitted: boolean;
  /** crypto=cryptoPrice / finance=objectivePrice，重连时按此重发订阅 */
  kind: PriceKind;
}

interface TradeSub {
  refs: number;
  handlers: Set<TradeHandler>;
}

class LivePriceWebSocket {
  private ws: WebSocket | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private paused = false;

  private prices = new Map<string, PriceSub>();
  private trades = new Map<string, TradeSub>();

  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibility);
    }
  }

  // ============== 公共 API ==============

  subscribePrice(
    eventId: string,
    kind: PriceKind,
    handler: PriceHandler
  ): () => void {
    let sub = this.prices.get(eventId);
    if (!sub) {
      sub = {
        refs: 0,
        handlers: new Set(),
        hasData: false,
        unsupportedTimer: null,
        unsupportedEmitted: false,
        kind,
      };
      this.prices.set(eventId, sub);
    } else {
      sub.kind = kind;
    }
    sub.refs += 1;
    sub.handlers.add(handler);

    void this.ensureConnected().then(() => this.sendSubscribePrice(eventId));
    this.armUnsupportedTimer(eventId);

    return () => {
      const cur = this.prices.get(eventId);
      if (!cur) return;
      cur.handlers.delete(handler);
      cur.refs -= 1;
      if (cur.refs <= 0) {
        if (cur.unsupportedTimer) clearTimeout(cur.unsupportedTimer);
        this.prices.delete(eventId);
        // 服务端协议无显式 unsubscribe，最多重连后不再 re-subscribe 即可
      }
    };
  }

  subscribeTrades(eventSlug: string, handler: TradeHandler): () => void {
    let sub = this.trades.get(eventSlug);
    if (!sub) {
      sub = { refs: 0, handlers: new Set() };
      this.trades.set(eventSlug, sub);
    }
    sub.refs += 1;
    sub.handlers.add(handler);

    void this.ensureConnected().then(() => this.sendSubscribeTrades(eventSlug));

    return () => {
      const cur = this.trades.get(eventSlug);
      if (!cur) return;
      cur.handlers.delete(handler);
      cur.refs -= 1;
      if (cur.refs <= 0) this.trades.delete(eventSlug);
    };
  }

  forceReconnect(): void {
    this.reconnectAttempts = 0;
    this.closeSocket();
    void this.ensureConnected();
  }

  // ============== 连接管理 ==============

  private ensureConnected(): Promise<void> {
    if (this.paused) return Promise.resolve();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.isConnecting) {
      // 简单等待 open
      return new Promise((resolve) => {
        const check = () => {
          if (!this.isConnecting) resolve();
          else setTimeout(check, 50);
        };
        check();
      });
    }
    return this.connect();
  }

  private connect(): Promise<void> {
    return new Promise((resolve) => {
      this.isConnecting = true;
      try {
        const ws = new WebSocket(WS_URL);
        this.ws = ws;

        ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          // 重连后重新订阅所有活跃频道
          this.prices.forEach((_sub, eventId) =>
            this.sendSubscribePrice(eventId)
          );
          this.trades.forEach((_sub, eventSlug) =>
            this.sendSubscribeTrades(eventSlug)
          );
          resolve();
        };

        ws.onmessage = (event) => this.handleMessage(event);

        ws.onclose = () => {
          this.isConnecting = false;
          this.ws = null;
          if (!this.paused) this.scheduleReconnect();
        };

        ws.onerror = () => {
          // 让 onclose 兜底重连
          try {
            ws.close();
          } catch {
            // ignore
          }
        };
      } catch (err) {
        this.isConnecting = false;
        console.error("[live-price-ws] connect failed", err);
        this.scheduleReconnect();
        resolve();
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        "[live-price-ws] max reconnect attempts reached, giving up"
      );
      return;
    }
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.reconnectAttempts,
      RECONNECT_MAX_MS
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private closeSocket(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const ws = this.ws;
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.onopen = null;
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
    this.ws = null;
    this.isConnecting = false;
  }

  // ============== 订阅消息 ==============

  private sendSubscribePrice(eventId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const sub = this.prices.get(eventId);
    if (!sub) return;
    this.ws.send(
      JSON.stringify({
        operation: "subscribe",
        type: sub.kind === "finance" ? "objectivePrice" : "cryptoPrice",
        eventId: String(eventId),
      })
    );
  }

  private sendSubscribeTrades(eventSlug: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        operation: "subscribe",
        type: "trade_message",
        event_slug: eventSlug,
      })
    );
  }

  // ============== 消息分发 ==============

  private handleMessage(event: MessageEvent): void {
    if (!event.data || (event.data as string).length === 0) return;
    let data: unknown;
    try {
      data = JSON.parse(event.data as string);
    } catch (err) {
      console.error("[live-price-ws] parse error", err);
      return;
    }
    if (!data || typeof data !== "object") return;
    const msg = data as Record<string, unknown>;

    if (msg.type === "subscribe" && msg.topic === "crypto_prices") {
      this.dispatchPriceSnapshot(msg);
      return;
    }
    if (msg.type === "update" && msg.topic === "crypto_prices_chainlink") {
      // crypto 实时更新：payload.{timestamp,value}
      this.dispatchPriceUpdate(msg);
      return;
    }
    if (msg.type === "update" && msg.topic === "crypto_prices") {
      // finance（objectivePrice）实时更新：顶层 price/timestamp
      this.dispatchFinancePriceUpdate(msg);
      return;
    }
    if (msg.type === "trade_message") {
      this.dispatchTrade(msg);
      return;
    }
  }

  /** 广播一个 price 事件给所有活跃订阅（响应不回显 eventId，按订阅推断） */
  private broadcastPrice(make: (eventId: string) => PriceMsg): void {
    this.prices.forEach((sub, eventId) => {
      sub.hasData = true;
      if (sub.unsupportedTimer) {
        clearTimeout(sub.unsupportedTimer);
        sub.unsupportedTimer = null;
      }
      sub.handlers.forEach((h) => h(make(eventId)));
    });
  }

  private dispatchPriceSnapshot(msg: Record<string, unknown>): void {
    const payload = msg.payload as { data?: unknown } | undefined;
    const raw = Array.isArray(payload?.data) ? payload!.data : null;
    if (!raw) return;
    if (raw.length === 0) {
      // 空数组：保留 unsupported timer，让它兜底
      return;
    }

    const points: PricePoint[] = (raw as Array<Record<string, unknown>>)
      .map((item) => ({
        time: ((item.timestamp as number) / 1000) as Time,
        value: item.value as number,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number))
      .filter(
        (item, index, self) => index === 0 || item.time !== self[index - 1].time
      );

    this.broadcastPrice((eventId) => ({ type: "snapshot", eventId, data: points }));
  }

  private dispatchPriceUpdate(msg: Record<string, unknown>): void {
    const payload = msg.payload as
      | { timestamp?: unknown; value?: unknown }
      | undefined;
    if (!payload) return;
    const ts = Number(payload.timestamp);
    const value = Number(payload.value);
    if (!Number.isFinite(ts) || !Number.isFinite(value)) return;
    const point: PricePoint = { time: (ts / 1000) as Time, value };
    this.broadcastPrice((eventId) => ({ type: "update", eventId, point }));
  }

  /** finance objectivePrice 更新：{ type:"update", topic:"crypto_prices", price, timestamp } */
  private dispatchFinancePriceUpdate(msg: Record<string, unknown>): void {
    const ts = Number(msg.timestamp);
    const value = Number(msg.price);
    if (!Number.isFinite(ts) || !Number.isFinite(value)) return;
    const point: PricePoint = { time: (ts / 1000) as Time, value };
    this.broadcastPrice((eventId) => ({ type: "update", eventId, point }));
  }

  private dispatchTrade(msg: Record<string, unknown>): void {
    const side = msg.side;
    if (side !== "BUY" && side !== "SELL") return;
    const price = Number(msg.price);
    const size = Number(msg.size);
    if (!Number.isFinite(price) || !Number.isFinite(size)) return;

    // trade_message 协议未必带 event_slug 回显；与旧实现一致：广播给所有活跃 trade 订阅。
    this.trades.forEach((sub, eventSlug) => {
      sub.handlers.forEach((h) =>
        h({ type: "trade", eventSlug, side, price, size })
      );
    });
  }

  // ============== unsupported 检测 ==============

  private armUnsupportedTimer(eventId: string): void {
    const sub = this.prices.get(eventId);
    if (!sub || sub.unsupportedEmitted || sub.hasData) return;
    if (sub.unsupportedTimer) return;
    sub.unsupportedTimer = setTimeout(() => {
      sub.unsupportedTimer = null;
      if (sub.hasData || sub.unsupportedEmitted) return;
      sub.unsupportedEmitted = true;
      sub.handlers.forEach((h) => h({ type: "unsupported", eventId }));
    }, UNSUPPORTED_TIMEOUT_MS);
  }

  // ============== iframe visibility pause（§6.1 #7） ==============

  private handleVisibility = (): void => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "hidden") {
      this.paused = true;
      this.closeSocket();
    } else {
      this.paused = false;
      if (this.prices.size > 0 || this.trades.size > 0) {
        void this.ensureConnected();
      }
    }
  };
}

export const livePriceWS = new LivePriceWebSocket();
