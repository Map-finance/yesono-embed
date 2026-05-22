import { useEffect, useState } from "react";
import { getEventSettlementPrices } from "@/lib/api";

const CLOSE_PRICE_POLL_INTERVAL_MS = 5000;

export interface EventSettlementPricesState {
  /** 开盘价(Price to beat) */
  openPrice: number | null;
  /** 收盘价(Final price);结算后才有值 */
  closePrice: number | null;
}

/**
 * 拉取事件结算价(开盘价 / 收盘价),用于加密 / 金融市场详情页的
 * "Price to beat" 与 "Final price",以及结束后折线图末点的锚定。
 *
 * - eventId 变化时拉一次。
 * - pollUntilClose 为真(市场已结束)且 closePrice 仍为 null 时,轮询直到拿到收盘价
 *   (后端结算价可能晚于结束时刻)。
 */
export function useEventSettlementPrices(
  eventId: string | number | undefined | null,
  pollUntilClose = false
): EventSettlementPricesState {
  const [state, setState] = useState<EventSettlementPricesState>({
    openPrice: null,
    closePrice: null,
  });

  // 初次 / eventId 变化:拉一次
  useEffect(() => {
    if (!eventId) {
      setState({ openPrice: null, closePrice: null });
      return;
    }
    let cancelled = false;
    setState({ openPrice: null, closePrice: null });
    getEventSettlementPrices(eventId)
      .then((resp) => {
        if (cancelled) return;
        const open = resp?.data?.openPrice;
        const close = resp?.data?.closePrice;
        setState({
          openPrice: typeof open === "number" ? open : null,
          closePrice: typeof close === "number" ? close : null,
        });
      })
      .catch((e) =>
        console.warn("[useEventSettlementPrices] 拉取 settlement-prices 失败", e)
      );
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  // 已结束但 closePrice 仍为 null(结算延迟):轮询直到拿到收盘价
  useEffect(() => {
    if (!pollUntilClose || !eventId || state.closePrice !== null) return;
    let cancelled = false;
    const poll = () => {
      getEventSettlementPrices(eventId)
        .then((resp) => {
          if (cancelled) return;
          const open = resp?.data?.openPrice;
          const close = resp?.data?.closePrice;
          if (typeof open === "number" || typeof close === "number") {
            setState((prev) => ({
              openPrice: typeof open === "number" ? open : prev.openPrice,
              closePrice: typeof close === "number" ? close : prev.closePrice,
            }));
          }
        })
        .catch((e) =>
          console.warn("[useEventSettlementPrices] 轮询 settlement-prices 失败", e)
        );
    };
    const timer = setInterval(poll, CLOSE_PRICE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [eventId, pollUntilClose, state.closePrice]);

  return state;
}
