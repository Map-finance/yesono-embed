"use client";

/**
 * ActivityList - 交易活动列表组件
 * 基于 docs/API_TRADES_ALL.md 和 docs/API_Order_book_ws.md 实现
 *
 * 功能:
 * - 显示交易活动列表
 * - 支持滚动加载更多
 * - 实时接收 WebSocket 推送的新交易
 */

import React, { useRef, useCallback, useMemo } from "react";
import { Loader2, User, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useActivity } from "./hooks/useActivity";
import { formatTimestamp, formatSize } from "@/lib/services/orderBookService";
import { PolymarketMarketResp } from "@/types/home";
import { useTranslation } from "@/lib/i18n";
import Avatar from "@/components/common/Avatar";

interface ActivityListProps {
  unionKey: string;
  eventSlug: string;
  label?: string;
  markets?: PolymarketMarketResp[]; // 用于根据 assetId 查找 market 名称
}

const ActivityList: React.FC<ActivityListProps> = ({
  unionKey,
  eventSlug,
  label,
  markets = [],
}) => {
  const { t } = useTranslation();
  const { trades, isLoading, isLoadingMore, hasMore, error, loadMore } =
    useActivity({
      eventId: unionKey,
      unionKey,
      eventSlug,
      enabled: true,
      pageSize: 20,
    });

  const observerRef = useRef<IntersectionObserver | null>(null);

  // 无限滚动加载
  const lastTradeRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoadingMore) return;

      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore();
        }
      });

      if (node) {
        observerRef.current.observe(node);
      }
    },
    [isLoadingMore, hasMore, loadMore]
  );

  // 格式化价格显示
  const formatPrice = (price: number) => {
    return (price * 100).toFixed(1) + "¢";
  };

  // 根据 assetId 查找对应的 market 名称
  const getMarketNameByAssetId = useCallback(
    (assetId?: string): string | null => {
      if (!assetId || markets.length === 0) return null;

      for (const market of markets) {
        try {
          // clobTokenIds 可能是 JSON 数组字符串，也可能直接是逗号分隔的字符串
          let tokenIds: string[] = [];
          if (market.clobTokenIds) {
            if (market.clobTokenIds.startsWith("[")) {
              tokenIds = JSON.parse(market.clobTokenIds);
            } else {
              tokenIds = market.clobTokenIds.split(",").map((s) => s.trim());
            }
          }

          if (tokenIds.includes(assetId)) {
            return market.groupItemTitle || market.question;
          }
        } catch (e) {
          console.error(
            "[Activity] Error parsing clobTokenIds:",
            market.clobTokenIds,
            e
          );
        }
      }
      return null;
    },
    [markets]
  );

  // 渲染单个交易记录
  const renderTradeItem = (
    trade: (typeof trades)[0],
    index: number,
    isLast: boolean
  ) => {
    const isBuy = trade.side === "BUY";

    return (
      <div
        key={`${trade.userId}-${trade.timestamp}-${index}`}
        ref={isLast ? lastTradeRef : null}
        className="flex items-center gap-3 py-3 px-2 hover:bg-[#1a1a1a] transition-colors border-b border-[#1a1a1a] last:border-b-0"
      >
        {/* 用户头像 */}
        <Avatar
          src={trade.profileImage}
          name={trade.name}
          id={trade.userId}
          size="sm"
          className="w-8 h-8 text-xs border-[#2a2a2a]"
        />

        {/* 交易信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white font-medium truncate">
              {trade.name ||
                trade.userId?.slice(0, 8) ||
                t.market.activityText.anonymous}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                isBuy
                  ? "bg-[rgba(34,197,94,0.15)] text-[#22c55e]"
                  : "bg-[rgba(239,68,68,0.15)] text-[#ef4444]"
              }`}
            >
              {isBuy
                ? t.market.activityText.bought
                : t.market.activityText.sold}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span
              className={`text-xs font-medium ${
                trade.outcome === "YES" ? "text-[#22c55e]" : "text-[#ef4444]"
              }`}
            >
              {trade.outcome || "N/A"}
            </span>
            {/* 显示 market 名称 (通过 assetId 匹配) */}
            {trade.assetId && getMarketNameByAssetId(trade.assetId) && (
              <span className="text-xs text-[#a1a1aa]">
                {t.market.activityText.for}{" "}
                {getMarketNameByAssetId(trade.assetId)}
              </span>
            )}
            <span className="text-xs text-[#6b7280]">
              @ {formatPrice(trade.price)}
            </span>
          </div>
        </div>

        {/* 数量和时间 */}
        <div className="text-right shrink-0">
          <div className="flex items-center gap-1 justify-end">
            {isBuy ? (
              <ArrowUpRight size={12} className="text-[#22c55e]" />
            ) : (
              <ArrowDownRight size={12} className="text-[#ef4444]" />
            )}
            <span className="text-sm text-white font-mono">
              {formatSize(trade.size)}
            </span>
          </div>
          <div className="text-xs text-[#6b7280] mt-0.5">
            {formatTimestamp(trade.timestamp)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#0d0d0d] rounded-lg">
      {/* 头部 */}
      <div className="flex items-center justify-between p-3 border-b border-[#1a1a1a]">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm">
            {t.market.activity}
          </span>
          {label && <span className="text-[#6b7280] text-xs">{label}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#6b7280] text-xs">
            {trades.length} {t.market.trades}
          </span>
          <div
            className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse"
            title="Live"
          />
        </div>
      </div>

      {/* 列表内容 */}
      <div className="max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[#6b7280]" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12 text-[#ef4444] text-sm">
            {error}
          </div>
        ) : trades.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#6b7280]">
            <User size={32} className="mb-2 opacity-50" />
            <span className="text-sm">No trades yet</span>
          </div>
        ) : (
          <>
            {trades.map((trade, index) =>
              renderTradeItem(trade, index, index === trades.length - 1)
            )}

            {/* 加载更多指示器 */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 size={20} className="animate-spin text-[#6b7280]" />
              </div>
            )}

            {/* 没有更多数据 */}
            {!hasMore && trades.length > 0 && (
              <div className="text-center py-4 text-[#6b7280] text-xs">
                No more trades
              </div>
            )}
          </>
        )}
      </div>

      {/* 底部统计 */}
      {trades.length > 0 && (
        <div className="flex items-center justify-between p-3 border-t border-[#1a1a1a] text-xs text-[#6b7280]">
          <span>
            <span className="text-[#22c55e]">●</span> Buy:{" "}
            {trades.filter((t) => t.side === "BUY").length}
          </span>
          <span>
            <span className="text-[#ef4444]">●</span> Sell:{" "}
            {trades.filter((t) => t.side === "SELL").length}
          </span>
        </div>
      )}
    </div>
  );
};

export default ActivityList;
