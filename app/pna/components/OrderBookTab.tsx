"use client";

/**
 * OrderBookTab - 用户订单 tab：列出用户的下注订单（含明细 + 分页）。
 * 大块逻辑已拆出：
 *   - OrderBookTab.transformer.ts  API → UI 数据转换
 *   - OrderBookTab.helpers.ts      formatDynamicAmount / pageSizeOptions / getPnlColor
 *   - OrderCard.tsx                单卡片（含明细行）
 */

import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import useSWR from "swr";
import { getUserOrders, getClaimingOrders } from "@/lib/api";
import { useI18n } from "@/components/hooks/useI18n";
import { ApiOrderBookRecord, OrderBookType } from "../types";
import { useAuthStore } from "@/lib/stores/authStore";
import { useToast } from "@/components/ui/Toast";
import Select from "@/components/ui/Select";
import { pageSizeOptions } from "./OrderBookTab.helpers";
import { transformApiOrderBookData } from "./OrderBookTab.transformer";
import OrderCard from "./OrderCard";

interface OrderBookTabProps {
  isActive: boolean;
}

const OrderBookTab: React.FC<OrderBookTabProps> = ({ isActive }) => {
  // 统一使用市场详情页同款自定义 toast，避免 antd message 多套提示风格并存
  const toast = useToast();

  const { t } = useI18n();
  const { accessToken, isAuthenticated } = useAuthStore();

  // 添加订单簿相关状态
  const [orderBookData, setOrderBookData] = useState<OrderBookType[]>([]);
  const [orderBookLoading, setOrderBookLoading] = useState(false);
  const [orderBookPagination, setOrderBookPagination] = useState({
    current: 1,
    pageSize: 5,
    total: 0,
  });

  // 领取状态管理
  const [claimingStatus, setClaimingStatus] = useState<{
    [key: string]: string;
  }>({});

  // 手风琴展开状态（允许同时展开多个卡片）
  // 返回时自动恢复上次展开的订单
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("orderbook_expanded");
      if (saved) {
        sessionStorage.removeItem("orderbook_expanded");
        try {
          return new Set(JSON.parse(saved));
        } catch (e) {
          console.error(
            "[OrderBookTab] Failed to parse expanded keys from sessionStorage",
            e
          );
        }
      }
    }
    return new Set();
  });

  // 返回后自动滚动到展开的订单
  useEffect(() => {
    if (expandedKeys.size > 0 && orderBookData.length > 0) {
      const firstKey = [...expandedKeys][0];
      const el = document.getElementById(`order-card-${firstKey}`);
      if (el) {
        setTimeout(
          () => el.scrollIntoView({ behavior: "smooth", block: "center" }),
          300
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderBookData.length > 0]);

  // 全局领取中的标记：防止同时发起多笔领取交易导致 nonce 冲突
  const [, setIsClaimingTx] = useState(false);
  // 全部领取状态
  const [, setIsClaimingAll] = useState(false);
  // 待领取数据（提前请求，控制按钮显隐 + 显示总额）
  const [, setClaimingData] = useState<{
    totalAmount: string;
    totalCount: number;
    records: Array<{ marketId: string; itemId: string }>;
  } | null>(null);

  // 待领取数据：SWR 自动轮询，tab 未激活或未登录时停止
  const claimingSwrKey =
    isAuthenticated && accessToken && isActive ? "user-claiming-orders" : null;

  const { data: claimingSwrData } = useSWR(
    claimingSwrKey,
    async () => {
      const res = await getClaimingOrders();
      return res.success ? res.data : null;
    },
    { refreshInterval: 10000, dedupingInterval: 5000 }
  );

  // 同步到 state（兼容 handleClaimAll 使用）
  useEffect(() => {
    if (claimingSwrData) setClaimingData(claimingSwrData);
  }, [claimingSwrData]);

  // 使用 SWR 自动刷新订单数据
  // 只有在已认证且有 token 且 Tab 激活时才发起请求（传 null 作为 key 禁用请求）
  const swrKey =
    isAuthenticated && accessToken && isActive
      ? `user-orders-${orderBookPagination.current}-${orderBookPagination.pageSize}`
      : null;

  const {
    data: swrOrderData,
    error: swrOrderError,
    mutate,
  } = useSWR(
    swrKey,
    () =>
      getUserOrders(orderBookPagination.current, orderBookPagination.pageSize),
    { refreshInterval: 5000, dedupingInterval: 3000 }
  );

  // 处理 SWR 订单数据
  useEffect(() => {
    if (swrOrderData && swrOrderData.success && swrOrderData.data) {
      const apiData = swrOrderData.data as any;
      const transformedData = transformApiOrderBookData(
        (apiData.records as ApiOrderBookRecord[]) || [],
        t
      );

      // 简单的数据变化检查，避免完全冲突的重渲染
      setOrderBookData((prev) => {
        if (JSON.stringify(prev) === JSON.stringify(transformedData))
          return prev;
        return transformedData;
      });

      setOrderBookPagination((prev) => {
        const nextTotal = apiData.total || 0;
        if (prev.total === nextTotal) return prev;
        return {
          ...prev,
          total: nextTotal,
        };
      });
    }
    if (swrOrderError) {
      console.error("SWR订单数据获取失败:", swrOrderError);
    }
  }, [swrOrderData, swrOrderError, t]);

  // 获取订单簿数据（手动刷新时使用）
  const fetchOrderBookData = async (page: number = 1, size: number = 5) => {
    if (!isAuthenticated || !accessToken) return;
    setOrderBookLoading(true);
    try {
      const response = await getUserOrders(page, size);
      if (response.success && response.data) {
        // Cast the response data to match the expected structure from the image
        const apiData = response.data as any;
        const transformedData = transformApiOrderBookData(
          (apiData.records as ApiOrderBookRecord[]) || [],
          t
        );
        setOrderBookData(transformedData);
        setOrderBookPagination({
          current: parseInt(String(apiData.current || apiData.page || page)),
          pageSize: parseInt(String(apiData.size || size)),
          total: parseInt(String(apiData.total || 0)),
        });
      } else {
        toast.error(
          (response as any).msg ||
            (response as any).message ||
            t("getOrderBookFailed")
        );
      }
    } catch (error) {
      console.error("获取订单簿失败:", error);
      toast.error(t("getOrderBookFailed"));
    } finally {
      setOrderBookLoading(false);
    }
  };

  // 当 Tab 激活时手动刷新一次
  useEffect(() => {
    if (isActive && isAuthenticated && accessToken) {
      mutate(); // 触发 SWR 重新验证
    }
  }, [isActive, isAuthenticated, accessToken, mutate]);

  // 处理订单簿分页变化
  const handleOrderBookPaginationChange = (
    page: number,
    pageSize?: number
  ) => {
    fetchOrderBookData(page, pageSize || orderBookPagination.pageSize);
  };

  // 卡片展开 / 收起
  const handleToggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // 跳转到详情前持久化展开状态，让用户返回后自动恢复
  const handleSaveExpandedSnapshot = () => {
    sessionStorage.setItem(
      "orderbook_expanded",
      JSON.stringify([...expandedKeys])
    );
  };

  return (
    <div>
      {/* 加载骨架 */}
      {orderBookLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl h-15 animate-pulse"
              style={{ background: "var(--bg-secondary)" }}
            />
          ))}
        </div>
      )}

      {/* 无数据 */}
      {!orderBookLoading && orderBookData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <span className="text-4xl">📋</span>
          <span
            className="text-[14px]"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("noOrders") || "暂无订单"}
          </span>
        </div>
      )}

      {/* 卡片列表 */}
      {!orderBookLoading && orderBookData.length > 0 && (
        <div>
          {orderBookData.map((record) => (
            <OrderCard
              key={record.key}
              record={record}
              isExpanded={expandedKeys.has(record.key)}
              onToggleExpand={handleToggleExpand}
              claimingStatus={claimingStatus}
              onSaveExpandedSnapshot={handleSaveExpandedSnapshot}
            />
          ))}
        </div>
      )}

      {/* 分页 */}
      {orderBookPagination.total > 0 && (
        <div
          className="flex flex-col gap-3 border-t border-[var(--border)] px-4 py-3 mt-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderTop: `1px solid var(--border)` }}
        >
          <div className="text-sm text-[var(--text-secondary)]">
            {t("totalRecords", {
              total: orderBookPagination.total.toString(),
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <span>Page size</span>
              <Select
                options={pageSizeOptions.map((size) => ({
                  value: size,
                  label: size.toString(),
                }))}
                value={orderBookPagination.pageSize}
                onChange={(nextPageSize) => {
                  if (nextPageSize !== orderBookPagination.pageSize) {
                    handleOrderBookPaginationChange(1, nextPageSize);
                  }
                }}
                className="min-w-[100px]"
                renderSelected={(option) => (
                  <span>{option.label} / page</span>
                )}
                renderOption={(option) => <span>{option.label} / page</span>}
              />
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  const nextPage = orderBookPagination.current - 1;
                  if (nextPage >= 1) {
                    handleOrderBookPaginationChange(
                      nextPage,
                      orderBookPagination.pageSize
                    );
                  }
                }}
                disabled={orderBookPagination.current <= 1}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[100px] text-center text-sm text-[var(--text-secondary)]">
                {orderBookPagination.current} /{" "}
                {Math.max(
                  1,
                  Math.ceil(
                    orderBookPagination.total / orderBookPagination.pageSize
                  )
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  const totalPages = Math.max(
                    1,
                    Math.ceil(
                      orderBookPagination.total / orderBookPagination.pageSize
                    )
                  );
                  const nextPage = orderBookPagination.current + 1;
                  if (nextPage <= totalPages) {
                    handleOrderBookPaginationChange(
                      nextPage,
                      orderBookPagination.pageSize
                    );
                  }
                }}
                disabled={
                  orderBookPagination.current >=
                  Math.max(
                    1,
                    Math.ceil(
                      orderBookPagination.total / orderBookPagination.pageSize
                    )
                  )
                }
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderBookTab;
