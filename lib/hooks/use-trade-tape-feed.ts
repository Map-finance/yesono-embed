import { useEffect, useRef } from "react";
import { livePriceWS } from "@/lib/services/live-price-ws";

export interface TradeTapeHandlers {
  onTrade: (side: "BUY" | "SELL", price: number, size: number) => void;
}

/**
 * 订阅 trade_message 流。enabled=false 时不订阅（用于 mock 模式开关）。
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
    return livePriceWS.subscribeTrades(eventSlug, (msg) => {
      handlersRef.current.onTrade(msg.side, msg.price, msg.size);
    });
  }, [eventSlug, enabled]);
}
