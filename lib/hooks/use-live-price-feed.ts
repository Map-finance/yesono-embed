import { useEffect, useRef } from "react";
import { livePriceWS } from "@/lib/services/live-price-ws";
import type { PriceMsg, PricePoint } from "@/lib/services/live-price-ws";

export interface LivePriceFeedHandlers {
  onSnapshot?: (points: PricePoint[]) => void;
  onUpdate?: (point: PricePoint) => void;
  onUnsupported?: () => void;
}

/**
 * 订阅 live price 流。组件不感知 WS 存在；具体怎么把数据推给 chart / state，
 * 由调用方在 handlers 里决定。
 *
 * handlers 用 ref 拿到最新值，所以 effect 依赖只有 symbol，避免每次 render 都重建订阅。
 */
export function useLivePriceFeed(
  symbol: string | undefined,
  handlers: LivePriceFeedHandlers
): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!symbol) return;
    const dispatch = (msg: PriceMsg) => {
      const h = handlersRef.current;
      switch (msg.type) {
        case "snapshot":
          h.onSnapshot?.(msg.data);
          break;
        case "update":
          h.onUpdate?.(msg.point);
          break;
        case "unsupported":
          h.onUnsupported?.();
          break;
      }
    };
    return livePriceWS.subscribePrice(symbol, dispatch);
  }, [symbol]);
}
