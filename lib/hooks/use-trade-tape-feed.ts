import { useEffect, useRef } from "react";
import { activityWS, type TradeMessage } from "@/lib/services/orderBookService";

export interface TradeTapeHandlers {
  onTrade: (side: "BUY" | "SELL", price: number, size: number) => void;
}

/**
 * 订阅 trade_message 流。enabled=false 时不订阅（用于 mock 模式开关）。
 *
 * 走 activityWS 单例(与 useActivity / useSessionTradeVolume 共享同一条 trade 连接,
 * refCount 由 OrderBookWebSocket.tradeSubscriptionRefs 管理)—— 对齐 h2,避免同一 eventSlug
 * 同时开"成交流"和"活动列表"两条 trade WS。
 */
export function useTradeTapeFeed(
  eventSlug: string | undefined,
  handlers: TradeTapeHandlers,
  enabled: boolean = true
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !eventSlug) return;

    const handler = (msg: TradeMessage) => {
      const price = Number(msg?.price);
      const size = Number(msg?.size);
      if (!Number.isFinite(price) || !Number.isFinite(size)) return;
      handlersRef.current.onTrade(msg.side, price, size);
    };

    activityWS.addHandler("trade_message", handler);
    activityWS.subscribeTradeMessage(eventSlug).catch(() => {
      // 订阅失败(网络/WS 未连)忽略,handler 仍挂着,重连成功后会收到消息
    });

    return () => {
      activityWS.removeHandler("trade_message", handler);
      activityWS.unsubscribeTradeMessage(eventSlug);
    };
  }, [eventSlug, enabled]);
}
