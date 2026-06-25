import { useEffect, useState } from "react";
import { getEventSettlementPrices } from "@/lib/api";

const CLOSE_PRICE_POLL_INTERVAL_MS = 5000;
// 最大轮询次数(仅计实际发出的请求):~180 次 ≈ 15 分钟可见轮询。
// 防止后端长期返回 null 时无限轮询;隐藏标签页不计数、不发请求。
const MAX_POLLS = 180;

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
 * - openPrice 仍为 null 时轮询:停留在"未来市场"上,首拉拿到的是 null(窗口未开始),
 *   到点开盘后后端才捕获开盘价,需轮询补上,否则初始价格一直显示「—」不更新。
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

  // 轮询补缺:
  //  - openPrice 仍为 null → 未来市场到点开盘后才捕获,轮询补上(否则初始价格永远「—」)。
  //  - 已结束(pollUntilClose)但 closePrice 仍为 null → 结算延迟,轮询等收盘价。
  // 两者都满足后停止轮询。
  useEffect(() => {
    if (!eventId) return;
    const needOpen = state.openPrice === null;
    const needClose = pollUntilClose && state.closePrice === null;
    if (!needOpen && !needClose) return;
    let cancelled = false;
    let count = 0;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const poll = () => {
      // 隐藏标签页:不发请求、不计数(可见时再轮询),省无效网络与电量。
      if (typeof document !== "undefined" && document.hidden) return;
      count += 1;
      if (count >= MAX_POLLS) stop(); // 达上限后本次仍发一次,随后停止
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

    // 标签页从隐藏切回可见:立即补一次(否则要等下一个 5s 周期)。
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) poll();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }

    timer = setInterval(poll, CLOSE_PRICE_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      stop();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
  }, [eventId, pollUntilClose, state.openPrice, state.closePrice]);

  return state;
}
