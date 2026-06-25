/**
 * Live price WebSocket manager.
 *
 * 连接模型（与 h2-market 对齐、按后端要求）：
 *   **每个 price 订阅一条专属 WebSocket 连接**，不多路复用、不跨订阅复用。
 *   原因：后端协议 (1) 无显式 unsubscribe —— 想停掉一个订阅只能关连接；
 *   (2) 推送响应不回显 eventId —— 连接本身就是路由标识，一条连接只能对应
 *   一个订阅。因此切市场 = 关旧连 + 开新连（即"每个都重连"）。
 *
 *   连接健壮性对齐 h2:共享握手/指数退避抖动重连(永不放弃)/30s 静默检测自愈/
 *   safeClose/20s ping 保活,见 Channel 基类。
 *
 * 管理器只负责 price：按 key 复用/创建/销毁 PriceChannel + 引用计数 + iframe 可见性暂停。
 *
 * 注:trade_message(成交流)不在这里 —— 已统一走 orderBookService 的 activityWS 单例
 * (useActivity / useSessionTradeVolume / useTradeTapeFeed 共享一条持久连接,对齐 h2)。
 *
 * 协议（price）：{ operation: "subscribe", type: "cryptoPrice" | "objectivePrice", eventId }
 *   收到：
 *     { type:"subscribe", topic:"crypto_prices"|"finance_prices", payload:{ data:[...] } } → snapshot
 *     { type:"update",    topic:"crypto_prices_chainlink",        payload:{ timestamp,value } } → crypto update
 *     { type:"update",    topic:"crypto_prices"|"finance_prices", payload:{ value,timestamp } } → finance update
 */

import type { Time } from "lightweight-charts";
import {
  safeCloseWebSocket,
  jitterDelay,
  nextWsId,
  wsLog,
} from "@/lib/utils/safeCloseWs";
import { syncServerTime } from "@/lib/utils/serverTime";

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

// ============== 内部常量 ==============

const UNSUPPORTED_TIMEOUT_MS = 3000;
const RECONNECT_BASE_MS = 1500;
const RECONNECT_MAX_MS = 30_000;
// 退避指数封顶:2^6 = 64 → 1500×64 已超 30s 上限,再大无意义。不再"放弃",
// 达到上限后按 RECONNECT_MAX_MS 持续重试(对齐 h2"永不放弃")。
const RECONNECT_BACKOFF_CAP = 6;
// 静默检测:连续 30s 没收到任何消息就视为连接哑掉,主动重连(LB idle 杀连接但
// onclose 不一定及时触发时自愈;与 20s ping 协同 —— ping 有响应即刷新 lastMessageAt)
const IDLE_TIMEOUT_MS = 30_000;
const IDLE_CHECK_INTERVAL_MS = 15_000;

// ============== Channel：一条订阅 = 一条连接 ==============

/**
 * 单订阅专属连接基类：管理一条 WS 的生命周期（连接 / 指数退避重连 / 关闭 /
 * 可见性暂停）。子类提供订阅消息体与消息解析。
 */
abstract class Channel {
  protected ws: WebSocket | null = null;
  private isConnecting = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  // 静默检测:>30s 无消息 → 主动重连(防 LB 静默掐连接而 onclose 不触发)
  private lastMessageAt = 0;
  private idleCheckTimer: ReturnType<typeof setInterval> | null = null;
  // wsDebug:为每条连接打一个递增 id,串起 CREATE→OPEN→CLOSE 全生命周期
  private currentWsId: string | null = null;
  private paused = false;
  /** 引用计数：同一 key 的多个订阅者共享同一条连接（仍是"一订阅一连接"语义） */
  refs = 0;

  /** 连接 open 后发送的订阅消息体 */
  protected abstract subscribePayload(): object;
  /** 解析并分发一条服务端消息 */
  protected abstract onMessage(msg: Record<string, unknown>): void;
  /** open 之后的额外动作（如 price 的 unsupported 计时） */
  protected onOpenExtra(): void {}

  open(): void {
    if (this.paused) return;
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.connect();
  }

  private connect(): void {
    this.isConnecting = true;
    try {
      const wsId = nextWsId("livePriceWS");
      this.currentWsId = wsId;
      wsLog(wsId, "CREATE", { url: WS_URL });
      const ws = new WebSocket(WS_URL);
      this.ws = ws;

      ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        wsLog(wsId, "OPEN");
        try {
          ws.send(JSON.stringify(this.subscribePayload()));
        } catch {
          // ignore
        }
        // 应用层心跳:20s 发一次 {type:'ping'} 保活长连接(协议层 ping/pong
        // 浏览器自动处理、JS 不可见)。服务端不识别会回错误消息,onMessage 不会因此
        // 中断订阅(各 Channel 的 onMessage 只认自己的 topic)。
        this.startPing();
        this.startIdleCheck();
        this.onOpenExtra();
      };

      ws.onmessage = (event) => {
        if (!event.data || (event.data as string).length === 0) return;
        // 任意消息(含 ping 错误响应)都刷新静默计时:真死连接才会触发 idle 重连
        this.lastMessageAt = Date.now();
        let data: unknown;
        try {
          data = JSON.parse(event.data as string);
        } catch (err) {
          console.error("[live-price-ws] parse error", err);
          return;
        }
        if (!data || typeof data !== "object") return;
        this.onMessage(data as Record<string, unknown>);
      };

      ws.onclose = (event) => {
        this.isConnecting = false;
        this.ws = null;
        this.stopPing();
        this.stopIdleCheck();
        wsLog(wsId, "CLOSE", { code: event.code, wasClean: event.wasClean });
        if (!this.paused) this.scheduleReconnect();
      };

      ws.onerror = () => {
        // 让 onclose 兜底重连;safeClose 防 CONNECTING 态裸 close 触发警告
        wsLog(wsId, "ERROR", { readyState: this.ws?.readyState });
        safeCloseWebSocket(ws);
      };
    } catch (err) {
      this.isConnecting = false;
      console.error("[live-price-ws] connect failed", err);
      this.scheduleReconnect();
    }
  }

  // 静默检测:>30s 没收到任何消息 → 视为连接哑掉,主动重连
  private startIdleCheck(): void {
    this.stopIdleCheck();
    this.lastMessageAt = Date.now();
    this.idleCheckTimer = setInterval(() => {
      if (this.paused) return;
      if (Date.now() - this.lastMessageAt > IDLE_TIMEOUT_MS) {
        wsLog(this.currentWsId ?? "livePriceWS:?", "IDLE_RECONNECT");
        this.stopIdleCheck();
        // 主动断开 → onclose 走 scheduleReconnect 重连+重订阅
        const ws = this.ws;
        this.ws = null;
        this.stopPing();
        safeCloseWebSocket(ws);
        if (!this.paused) this.scheduleReconnect();
      }
    }, IDLE_CHECK_INTERVAL_MS);
  }

  private stopIdleCheck(): void {
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = null;
    }
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: "ping" }));
        } catch {
          // ignore
        }
      }
    }, 20_000);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    // 指数退避 + 抖动,封顶后按上限持续重试(永不放弃,对齐 h2):
    // 多个 Channel 同时断线时抖动可错开重连,避免同一刻齐刷刷打服务端。
    const exp = Math.min(this.reconnectAttempts, RECONNECT_BACKOFF_CAP);
    const delay = jitterDelay(
      Math.min(RECONNECT_BASE_MS * 2 ** exp, RECONNECT_MAX_MS)
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  close(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopPing();
    this.stopIdleCheck();
    const ws = this.ws;
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.onopen = null;
      // safeClose:防 CONNECTING 态裸 close 触发 "closed before established" 警告
      safeCloseWebSocket(ws);
    }
    this.ws = null;
    this.isConnecting = false;
  }

  pause(): void {
    this.paused = true;
    this.close();
  }

  resume(): void {
    this.paused = false;
    this.reconnectAttempts = 0;
    this.open();
  }
}

/** price 专属连接：一条连接订阅一个 eventId（含 unsupported 检测） */
class PriceChannel extends Channel {
  readonly handlers = new Set<PriceHandler>();
  private hasData = false;
  private unsupportedTimer: ReturnType<typeof setTimeout> | null = null;
  private unsupportedEmitted = false;

  constructor(
    private readonly eventId: string,
    private readonly kind: PriceKind
  ) {
    super();
  }

  protected subscribePayload(): object {
    return {
      operation: "subscribe",
      type: this.kind === "finance" ? "objectivePrice" : "cryptoPrice",
      eventId: String(this.eventId),
    };
  }

  protected onOpenExtra(): void {
    this.armUnsupportedTimer();
  }

  private emit(msg: PriceMsg): void {
    this.handlers.forEach((h) => h(msg));
  }

  private markHasData(): void {
    this.hasData = true;
    if (this.unsupportedTimer) {
      clearTimeout(this.unsupportedTimer);
      this.unsupportedTimer = null;
    }
  }

  /** >3s 无真实数据 → 判定该 eventId 不支持（订阅时 + open 时各 arm 一次） */
  armUnsupportedTimer(): void {
    if (this.unsupportedEmitted || this.hasData || this.unsupportedTimer) return;
    this.unsupportedTimer = setTimeout(() => {
      this.unsupportedTimer = null;
      if (this.hasData || this.unsupportedEmitted) return;
      this.unsupportedEmitted = true;
      this.emit({ type: "unsupported", eventId: this.eventId });
    }, UNSUPPORTED_TIMEOUT_MS);
  }

  protected onMessage(msg: Record<string, unknown>): void {
    // 历史快照：加密 crypto_prices / 金融 finance_prices（后端改名，兼容两者）
    if (
      msg.type === "subscribe" &&
      (msg.topic === "crypto_prices" || msg.topic === "finance_prices")
    ) {
      const payload = msg.payload as { data?: unknown } | undefined;
      const raw = Array.isArray(payload?.data) ? payload!.data : null;
      if (!raw || raw.length === 0) return; // 空数组：保留 unsupported timer 兜底
      const points: PricePoint[] = (raw as Array<Record<string, unknown>>)
        .map((item) => ({
          time: ((item.timestamp as number) / 1000) as Time,
          value: item.value as number,
        }))
        .sort((a, b) => (a.time as number) - (b.time as number))
        .filter(
          (item, i, self) => i === 0 || item.time !== self[i - 1].time
        );
      this.markHasData();
      this.emit({ type: "snapshot", eventId: this.eventId, data: points });
      return;
    }

    // crypto 实时更新：payload.{timestamp,value}
    if (msg.type === "update" && msg.topic === "crypto_prices_chainlink") {
      const payload = msg.payload as
        | { timestamp?: unknown; value?: unknown }
        | undefined;
      if (!payload) return;
      const ts = Number(payload.timestamp);
      const value = Number(payload.value);
      if (!Number.isFinite(ts) || !Number.isFinite(value)) return;
      // 用服务端 tick 时间戳校准本地↔服务端时钟偏移(LivePriceHeader 倒计时/结算时点依赖 serverNow())
      syncServerTime(ts);
      this.markHasData();
      this.emit({
        type: "update",
        eventId: this.eventId,
        point: { time: (ts / 1000) as Time, value },
      });
      return;
    }

    // finance 实时更新：topic crypto_prices / finance_prices；价格字段 payload.value
    // （兼容旧顶层 price/timestamp）
    if (
      msg.type === "update" &&
      (msg.topic === "crypto_prices" || msg.topic === "finance_prices")
    ) {
      const payload = (msg.payload ?? {}) as {
        timestamp?: unknown;
        value?: unknown;
      };
      const ts = Number(
        typeof payload.timestamp === "number" ? payload.timestamp : msg.timestamp
      );
      const value = Number(
        typeof payload.value === "number" ? payload.value : msg.price
      );
      if (!Number.isFinite(ts) || !Number.isFinite(value)) return;
      // 用服务端 tick 时间戳校准本地↔服务端时钟偏移(同上)
      syncServerTime(ts);
      this.markHasData();
      this.emit({
        type: "update",
        eventId: this.eventId,
        point: { time: (ts / 1000) as Time, value },
      });
    }
  }
}

// ============== 管理器：按 key 复用 Channel + 可见性暂停 ==============
//
// 注:trade_message(成交流)已统一走 orderBookService 的 activityWS 单例
// (useActivity / useSessionTradeVolume / useTradeTapeFeed 共享一条,对齐 h2),
// 本管理器只负责 price 订阅(每 eventId 一条专属连接)。

class LivePriceWebSocket {
  // price key: `${kind}:${eventId}`
  private priceChannels = new Map<string, PriceChannel>();

  constructor() {
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.handleVisibility);
    }
  }

  subscribePrice(
    eventId: string,
    kind: PriceKind,
    handler: PriceHandler
  ): () => void {
    const key = `${kind}:${eventId}`;
    let ch = this.priceChannels.get(key);
    if (!ch) {
      ch = new PriceChannel(eventId, kind);
      this.priceChannels.set(key, ch);
    }
    ch.handlers.add(handler);
    ch.refs += 1;
    ch.open();
    ch.armUnsupportedTimer();

    return () => {
      const cur = this.priceChannels.get(key);
      if (!cur) return;
      cur.handlers.delete(handler);
      cur.refs -= 1;
      // 引用归零：关闭这条专属连接（切市场即"每个都重连"）
      if (cur.refs <= 0) {
        cur.close();
        this.priceChannels.delete(key);
      }
    };
  }

  // ============== iframe visibility pause（§6.1 #7） ==============

  private handleVisibility = (): void => {
    if (typeof document === "undefined") return;
    const hidden = document.visibilityState === "hidden";
    this.priceChannels.forEach((ch) => (hidden ? ch.pause() : ch.resume()));
  };
}

export const livePriceWS = new LivePriceWebSocket();
