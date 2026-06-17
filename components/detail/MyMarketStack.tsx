"use client";

/**
 * MyMarketStack - 详情页"我的持仓 / 未完成订单 / 成交历史"堆叠区
 *
 * 对应 h2 OutcomeList.tsx:1314-1347 的「单市场布局」主区段:
 *   有持仓     → MyPositionsTable
 *   有当前委托 → MyOrdersTable(开放,带 onCancel)
 *   有成交历史 → MyOrdersTable(终态,title="Order History",无 cancel)
 *
 * 位置:由 page.tsx 渲染在 OutcomeList 与 MarketDetailTabs 之间(不是详情页底部
 * tab 区!那里只有 评论 / 持有人 / 活动 三档)。
 *
 * 数据各自 hook:
 *   - useMyMarketPosition(marketId) - 5s 静默轮询
 *   - useMarketOrders(marketId, ..., 'pending') - 当前委托
 *   - useMarketOrders(marketId, ..., 'filled,partially_filled,canceled') - 历史委托
 *
 * 没有任何数据时整块不渲染(包括 0 持仓 + 0 当前 + 0 历史 → return null,
 * 不留空白容器)。
 */

import React, { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { useAuthStore } from "@/lib/stores/authStore";
import { useMyMarketPosition } from "@/lib/hooks/useMyMarketPosition";
import { useMarketOrders, triggerMarketOrdersRefresh } from "@/lib/hooks/useMarketOrders";
import { cancelOrder } from "@/lib/api";
import type { PolymarketMarketResp } from "@/types/home";

const MyPositionsTable = dynamic(() => import("./MyPositionsTable"), { ssr: false });
const MyOrdersTable = dynamic(() => import("./MyOrdersTable"), { ssr: false });

interface MyMarketStackProps {
  market: PolymarketMarketResp | null;
  isResolved?: boolean;
  /** YES 侧赔付比例 0-1;null 时输入兜底 0.5(push) */
  resolvedYesPayout?: number | null;
}

const MyMarketStack: React.FC<MyMarketStackProps> = ({
  market,
  isResolved = false,
  resolvedYesPayout = null,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { isAuthenticated } = useAuthStore();
  const marketId = market?.id ? String(market.id) : undefined;

  // 顶层 lift 一次持仓数据 → 作 preset 透给 MyPositionsTable,避免它内部再 fetch
  const positionResult = useMyMarketPosition(marketId);

  // 当前委托 + 历史委托:两套 useMarketOrders 实例,status 不同
  const {
    orders: openOrders,
    isLoading: isOpenLoading,
    isLoadingMore: isOpenLoadingMore,
    hasMore: openHasMore,
    loadMore: openLoadMore,
    refresh: refreshOpen,
  } = useMarketOrders(marketId, null, "pending", isAuthenticated && !!marketId);

  const {
    orders: historicalOrders,
    isLoading: isHistLoading,
    isLoadingMore: isHistLoadingMore,
    hasMore: histHasMore,
    loadMore: histLoadMore,
  } = useMarketOrders(
    marketId,
    null,
    "filled,partially_filled,canceled",
    isAuthenticated && !!marketId
  );

  // Cancel:走 embed cancelOrder(TOB);成功后两套 useMarketOrders 实例都通过
  // triggerMarketOrdersRefresh() 一次性刷新,避免历史委托 tab 数据滞后
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const handleCancel = useCallback(
    async (orderId: string) => {
      if (!orderId) return;
      setCancellingId(orderId);
      try {
        const r = await cancelOrder(orderId);
        if (!r.ok) {
          toast.error(
            (t.pna?.orders as any)?.cancelFailed || "Failed to cancel order"
          );
        } else {
          toast.success(
            (t.pna?.orders as any)?.cancelSuccess || "Order canceled"
          );
        }
        triggerMarketOrdersRefresh();
        refreshOpen();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(msg || (t.pna?.orders as any)?.cancelFailed || "Failed to cancel order");
        refreshOpen();
      } finally {
        setCancellingId(null);
      }
    },
    [refreshOpen, toast, t]
  );

  if (!isAuthenticated || !market) return null;

  const hasPosition = positionResult.hasPosition;
  const hasOpenOrders = openOrders.length > 0;
  const hasHistorical = historicalOrders.length > 0;

  // 三块都为空(且非首次 loading)→ 整段不渲染,避免空容器留白
  const stillLoading =
    positionResult.isLoading || isOpenLoading || isHistLoading;
  if (!hasPosition && !hasOpenOrders && !hasHistorical && !stillLoading) {
    return null;
  }
  // 关闭 unused-vars 警告:cancellingId 是给后续每行细化 loader 用的占位
  void cancellingId;

  return (
    <div className="mt-3 lg:mt-4 flex flex-col gap-3">
      {hasPosition && (
        <MyPositionsTable
          market={market}
          isResolved={isResolved}
          resolvedYesPayout={resolvedYesPayout}
          preset={positionResult}
        />
      )}
      {hasOpenOrders && (
        <MyOrdersTable
          orders={openOrders}
          market={market}
          onCancel={handleCancel}
          hasMore={openHasMore}
          isLoadingMore={isOpenLoadingMore}
          onLoadMore={openLoadMore}
        />
      )}
      {hasHistorical && (
        <MyOrdersTable
          orders={historicalOrders}
          market={market}
          title={(t.market as any).historicalOrders || "Order History"}
          hasMore={histHasMore}
          isLoadingMore={isHistLoadingMore}
          onLoadMore={histLoadMore}
          /* 历史委托是终态,不渲染 cancel 按钮 */
        />
      )}
    </div>
  );
};

export default React.memo(MyMarketStack);
