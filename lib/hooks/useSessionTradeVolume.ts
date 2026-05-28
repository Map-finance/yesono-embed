"use client";

import { useEffect, useState } from "react";
import {
  activityWS,
  type TradeMessage,
} from "@/lib/services/orderBookService";

/**
 * 会话级累计交易量(USD)— 对齐 Polymarket
 *
 * 行为:
 *   - 页面打开瞬间 counter = 0
 *   - 订阅 activityWS 的 trade_message 事件,每条成交累加 price × size
 *   - 组件卸载 / 页面刷新 → 归零(纯组件 state,不持久化)
 *   - eventSlug 为空则不订阅,返回 0
 *
 * 与 useEventVolume 的区别:
 *   - useEventVolume: 后端历史累计,SWR 30s 轮询,跨会话保留
 *   - useSessionTradeVolume: 仅本次会话 WS 看到的成交,刷新归零
 *
 * 复用 activityWS(refCount),不会与 useActivity 重复建连接。
 */
export function useSessionTradeVolume(eventSlug?: string) {
  const [usd, setUsd] = useState(0);

  useEffect(() => {
    // eventSlug 变化时归零,避免上一个市场的累计继承到下一个市场。
    // Next.js App Router 在 /market/A → /market/B 这类同 segment 切换时
    // 会复用 page.tsx 组件实例,SpotOrderbook 不会卸载,useState 也不会自然销毁,
    // 这里显式 reset 保证"换市场 = 计数器清零"。
    setUsd(0);
    if (!eventSlug) return;
    let cancelled = false;

    const handler = (msg: TradeMessage) => {
      if (cancelled) return;
      const price = Number(msg?.price);
      const size = Number(msg?.size);
      const inc = price * size;
      if (Number.isFinite(inc) && inc > 0) {
        setUsd((v) => v + inc);
      }
    };

    activityWS.addHandler("trade_message", handler);
    // subscribe 内部带引用计数,与 useActivity 共用同一条订阅
    activityWS.subscribeTradeMessage(eventSlug).catch(() => {
      // 订阅失败(网络/WS 未连)忽略,handler 仍挂着,后续重连成功后会收到消息
    });

    return () => {
      cancelled = true;
      activityWS.removeHandler("trade_message", handler);
      activityWS.unsubscribeTradeMessage(eventSlug);
    };
  }, [eventSlug]);

  return usd;
}
