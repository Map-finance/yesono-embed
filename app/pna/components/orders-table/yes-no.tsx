"use client";

/**
 * PNA yes/no 订单 tab —— 对齐 h2 OpenOrdersTab 的富 UX。
 *
 * 子 tab:当前委托 / 历史委托
 * 历史委托:全部 / 已成交 / 部分成交 / 已取消 状态筛选
 * 表格:复用详情页同款 MyOrdersTable(列含 Side / Outcome / Price / Filled / Total /
 *      Fee / Expiry + 行展开成交明细 + Cancel × 按钮)
 * 数据:useMarketOrders(marketId=null) 拉所有市场的订单,按 status 服务端过滤,
 *      分页 10 + LoadMoreButton 翻页
 *
 * Cancel 走 embed 已有 cancelOrder(/api/tob/order/{betId}/cancel) —— 旧 CancelOrderButton
 * 走的同一条,功能不丢。
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { cancelOrder } from "@/lib/api";
import { useMarketOrders } from "@/lib/hooks/useMarketOrders";
import MyOrdersTable from "@/components/detail/MyOrdersTable";
import LoadMoreButton from "@/components/common/LoadMoreButton";

type OrderSubTab = "current" | "historical";
type HistoryFilter = "all" | "filled" | "partial" | "canceled";

const CURRENT_STATUS = "pending";

/** 历史委托:子筛选 → 服务端 status 请求参数(逗号分隔多状态 IN 过滤) */
const STATUS_BY_HISTORY_FILTER: Record<HistoryFilter, string> = {
  all: "filled,partially_filled,canceled",
  filled: "filled",
  partial: "partially_filled",
  canceled: "canceled",
};

export function YesNoOrders({ targetUserId }: { targetUserId?: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [subTab, setSubTab] = useState<OrderSubTab>("current");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");

  // 当前委托固定 pending;历史委托按 filter 拉对应终态
  const status =
    subTab === "historical" ? STATUS_BY_HISTORY_FILTER[historyFilter] : CURRENT_STATUS;

  // marketId=null → 拉用户全量订单(useMarketOrders 内部 fetch 时 marketId 不传给后端)
  // targetUserId 为别人时,/order/list 接口暂未支持外部 userId 过滤,跨用户查看时拉空集
  const { orders, isLoading, isLoadingMore, hasMore, loadMore, refresh } =
    useMarketOrders(null, null, status, !targetUserId);

  // 切子 tab / 切筛选时主动刷一下首页(useMarketOrders 已自动响应 status 变化,这里兜底)
  useEffect(() => {
    refresh();
    // 故意只在 subTab/historyFilter 变化时触发,不在 refresh ref 变化时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTab, historyFilter]);

  // Cancel:走 embed 现有 cancelOrder(TOB);失败 → toast.error,成功 → 刷新
  const [isCancelingOrderId, setIsCancelingOrderId] = useState<string | null>(null);
  const handleCancelOrder = useCallback(
    async (orderId: string) => {
      if (!orderId) return;
      setIsCancelingOrderId(orderId);
      try {
        // embed cancelOrder 走 TOB,返 { ok, status?, raw };ok=false 明确失败,
        // 其它中间状态(canceled / refund_pending / refund_completed)都视为受理成功
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
        refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast.error(
          msg || (t.pna?.orders as any)?.cancelFailed || "Failed to cancel order"
        );
        refresh();
      } finally {
        setIsCancelingOrderId(null);
      }
    },
    [refresh, toast, t]
  );

  // 子 tab 与 filter pill 文案:fallback 到中文/英文,无 i18n 也不裸露 key
  const subTabs: { id: OrderSubTab; label: string }[] = [
    {
      id: "current",
      label: (t.pna?.orders as any)?.subTabCurrent || "当前委托",
    },
    {
      id: "historical",
      label: (t.pna?.orders as any)?.subTabHistorical || "历史委托",
    },
  ];

  const historyFilters: { id: HistoryFilter; label: string }[] = [
    { id: "all", label: (t.pna?.orders as any)?.filterAll || "全部" },
    { id: "filled", label: (t.pna?.orders as any)?.filterFilled || "已成交" },
    {
      id: "partial",
      label: (t.pna?.orders as any)?.partiallyFilled || "部分成交",
    },
    {
      id: "canceled",
      label: (t.pna?.orders as any)?.filterCanceled || "已取消",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* 子 tab(当前委托 / 历史委托)—— 分段按钮 */}
      <div className="inline-flex w-fit rounded-md border border-(--border) overflow-hidden">
        {subTabs.map((tab, idx) => {
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`px-6 py-2 text-sm font-bold transition-all ${
                idx !== subTabs.length - 1
                  ? "border-r border-solid border-(--border)"
                  : ""
              } ${
                active
                  ? "bg-(--accent) text-black"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 历史委托状态筛选(仅 historical 时显示)*/}
      {subTab === "historical" && (
        <div className="flex items-center gap-2 flex-wrap">
          {historyFilters.map((f) => {
            const active = historyFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setHistoryFilter(f.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  active
                    ? "bg-(--accent) text-black"
                    : "border border-(--border) text-(--text-secondary) hover:text-(--text-primary)"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 订单表格 —— 复用详情页同款 MyOrdersTable;Cancel 仅 current 子 tab 透传 */}
      {isLoading && orders.length === 0 ? (
        <div className="py-8 text-center text-sm text-(--text-secondary)">
          {t.common.loading}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-8 text-center text-sm text-(--text-tertiary)">
          {subTab === "historical"
            ? (t.pna?.orders as any)?.noHistoricalOrders || "暂无历史委托"
            : (t.pna?.orders as any)?.noOrders || "暂无未完成订单"}
        </div>
      ) : (
        <MyOrdersTable
          orders={orders}
          market={null}
          onCancel={subTab === "current" ? handleCancelOrder : undefined}
          hasMore={hasMore}
          isLoadingMore={isLoadingMore}
          onLoadMore={loadMore}
        />
      )}

      {/* 兜底:当 MyOrdersTable 没渲染 LoadMore 时(orders=0),不需要补 —— 已 above ⟸ empty 处理 */}
      {orders.length > 0 && !hasMore && (
        <div className="text-center text-xs text-(--text-tertiary) py-2">
          {(t.pna as any)?.noMore || "没有更多"}
        </div>
      )}

      {/* 防 unused-vars lint warning:isCancelingOrderId 仅用于 row-level cancel state,
          MyOrdersTable 内部各 row 自管 loader,这里保留以备需要时透传 */}
      {isCancelingOrderId === "__never__" && null}
    </div>
  );
}
