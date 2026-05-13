"use client";

/**
 * 桌面端右栏交易面板 —— 薄壳
 *
 * 端口后内部使用 h2-market 完整版 `components/common/TradingPanel`，
 * 把 `PolymarketMarketResp` 注入 `useTradingStore.setMarket()` 后即可。
 * 渲染交给共享面板，提交走 To-B 控制器。
 */

import { useEffect } from "react";
import type { PolymarketMarketResp } from "@/types/home";
import { useTradingStore } from "@/lib/store/tradingStore";
import SharedTradingPanel from "@/components/common/TradingPanel";

interface Props {
  market: PolymarketMarketResp;
  eventId?: string | number;
}

export default function TradingPanel({ market, eventId }: Props) {
  const setMarket = useTradingStore((s) => s.setMarket);
  const setEvent = useTradingStore((s) => s.setEvent);

  useEffect(() => {
    // 把当前市场 push 到 store，SharedTradingPanel 内部依赖它拉取 orderbook / 余额 / 下单
    setMarket(market as any);
    if (eventId) {
      // 简化：eventId 作为 PolymarketEventResp 占位
      setEvent({ id: eventId } as any);
    }
    return () => {
      // 组件卸载时清掉选中市场，避免 WS 订阅泄漏
      setMarket(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market?.id]);

  const questionID = String(
    (market as any).questionID || (market as any).questionId || market.id || ""
  );

  return (
    <div className="rounded-xl border border-(--border) bg-(--bg-card) overflow-hidden">
      <SharedTradingPanel questionID={questionID} />
    </div>
  );
}
