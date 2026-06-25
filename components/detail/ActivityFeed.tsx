import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import {
  getActivityFilterOptions,
  getMinAmountOptions,
  labelFor,
} from "@/components/common/filterOptions";
import { ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { useActivity } from "./hooks/useActivity";
import { formatTimestamp } from "@/lib/services/orderBookService";
import { getBasescanUrl } from "@/lib/config";
import { PolymarketMarketResp } from "@/types/home";
import Avatar from "@/components/common/Avatar";
import LoadMoreButton from "@/components/common/LoadMoreButton";

interface ActivityFeedProps {
  marketId: string;
  unionKey?: string; // 用于获取 Activity 数据
  eventSlug?: string; // 用于 WebSocket 订阅（event_slug）
  eventId?: string;   // 事件 ID，用于 trades API
  markets?: PolymarketMarketResp[]; // 用于根据 assetId 查找 market 名称
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  marketId,
  unionKey,
  eventSlug,
  eventId,
  markets = [],
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const goToUserPna = useCallback(
    (userId?: string) => {
      if (!userId) return;
      router.push(`/pna?userId=${encodeURIComponent(String(userId))}`);
    },
    [router]
  );
  const activityFilterOptions = getActivityFilterOptions(t);
  const minAmountOptions = getMinAmountOptions(t);

  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [activityFilterOpen, setActivityFilterOpen] = useState(false);
  const [minAmount, setMinAmount] = useState<string>("min");
  const [minAmountOpen, setMinAmountOpen] = useState(false);

  // 使用 useActivity hook 获取真实交易数据
  const { trades, isLoading, isLoadingMore, hasMore, loadMore } = useActivity({
    eventId: eventId || marketId,
    unionKey: unionKey || marketId,
    eventSlug: eventSlug || marketId,
    enabled: true,
    pageSize: 10,
  });

  // 根据 assetId 查找对应的 market 名称
  const getMarketNameByAssetId = useCallback(
    (assetId?: string): string | null => {
      if (!assetId || markets.length === 0) return null;

      for (const market of markets) {
        try {
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
          console.error('[ActivityFeed] Failed to parse market clobTokenIds', e);
        }
      }
      return null;
    },
    [markets]
  );

  return (
    <>
      {/* 过滤器 */}
      <div className="flex items-center gap-3 mb-6">
        {/* Activity Filter */}
        <div className="relative">
          <button
            onClick={() => setActivityFilterOpen(!activityFilterOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-(--border) bg-(--bg-card) text-sm text-(--text-primary) hover:border-(--border-light)"
          >
            {labelFor(activityFilterOptions, activityFilter)}
            <ChevronDown
              size={16}
              className={`transition-transform ${
                activityFilterOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {activityFilterOpen && (
            <div className="absolute top-full left-0 mt-1 py-1 rounded-lg border border-(--border) bg-(--bg-card) shadow-lg z-10 min-w-[100px]">
              {activityFilterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setActivityFilter(option.value);
                    setActivityFilterOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-(--bg-hover) ${
                    activityFilter === option.value
                      ? "text-(--accent)"
                      : "text-(--text-primary)"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Min Amount Filter */}
        <div className="relative">
          <button
            onClick={() => setMinAmountOpen(!minAmountOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-(--border) bg-(--bg-card) text-sm text-(--text-primary) hover:border-(--border-light)"
          >
            {labelFor(minAmountOptions, minAmount)}
            <ChevronDown
              size={16}
              className={`transition-transform ${
                minAmountOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {minAmountOpen && (
            <div className="absolute top-full left-0 mt-1 py-1 rounded-lg border border-(--border) bg-(--bg-card) shadow-lg z-10 min-w-[120px]">
              {minAmountOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setMinAmount(option.value);
                    setMinAmountOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-(--bg-hover) ${
                    minAmount === option.value
                      ? "text-(--accent)"
                      : "text-(--text-primary)"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 活动列表 - 使用真实 API 数据 */}
      <div className="space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2
              size={24}
              className="animate-spin text-(--text-tertiary)"
            />
          </div>
        ) : trades.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-(--text-tertiary)">
            {t.market.activityText.noActivity}
          </div>
        ) : (
          <>
            {trades
              .filter((trade) => {
                if (activityFilter === "buys") return trade.side === "BUY";
                if (activityFilter === "sells") return trade.side === "SELL";
                return true;
              })
              .map((trade, index) => {
                const isBuy = trade.side === "BUY";
                const displayPrice = (trade.price * 100).toFixed(1);

                return (
                  <div
                    key={`${trade.userId}-${trade.timestamp}-${index}`}
                    className="flex items-center gap-3 py-3 hover:bg-(--bg-hover) rounded-lg px-2 -mx-2"
                  >
                    {/* 头像（点击跳转 pna 页面） */}
                    <button
                      type="button"
                      onClick={() => goToUserPna(trade.userId)}
                      disabled={!trade.userId}
                      className="shrink-0 rounded-full disabled:cursor-default"
                    >
                      <Avatar
                        src={trade.profileImage}
                        name={trade.name}
                        className="w-10 h-10 text-sm"
                      />
                    </button>

                    {/* 活动内容 */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">
                        <span
                          onClick={() => goToUserPna(trade.userId)}
                          className={`font-medium text-(--text-primary) ${
                            trade.userId ? "cursor-pointer hover:underline" : ""
                          }`}
                        >
                          {trade.name ||
                            trade.userId?.slice(0, 12) ||
                            t.market.activityText.anonymous}
                        </span>
                        <span className="text-(--text-secondary)">
                          {" "}
                          {isBuy
                            ? t.market.activityText.bought
                            : t.market.activityText.sold}{" "}
                        </span>
                        <span
                          className={
                            trade.outcome === "YES"
                              ? "text-(--green) font-medium"
                              : "text-(--red) font-medium"
                          }
                        >
                          {trade.size.toFixed(0)}{" "}
                          {trade.outcome || t.market.shares}
                        </span>
                        {trade.assetId &&
                          getMarketNameByAssetId(trade.assetId) && (
                            <span className="text-(--text-secondary)">
                              {" "}
                              {t.market.activityText.for}{" "}
                            </span>
                          )}
                        {trade.assetId &&
                          getMarketNameByAssetId(trade.assetId) && (
                            <span className="text-(--text-primary) font-medium">
                              {getMarketNameByAssetId(trade.assetId)}
                            </span>
                          )}
                        <span className="text-(--text-secondary)">
                          {" "}
                          {t.market.activityText.at}{" "}
                        </span>
                        <span className="text-(--text-primary)">
                          {displayPrice}¢
                        </span>
                        <span className="text-(--text-tertiary)">
                          {" "}
                          (${(trade.size * trade.price).toFixed(0)})
                        </span>
                      </span>
                    </div>

                    {/* 时间和链接 */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-(--text-tertiary)">
                        {formatTimestamp(trade.timestamp)}
                      </span>
                      {/* 仅当有链上交易哈希时才显示跳转图标（无 hash 不显示） */}
                      {trade.hash && (
                        <a
                          href={getBasescanUrl.transaction(trade.hash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-(--text-tertiary) hover:text-(--text-primary) transition-colors"
                          title={
                            (t.market.activityText as any)?.viewOnExplorer ||
                            "View on explorer"
                          }
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}

            {/* 统一的「加载更多」按钮 */}
            <LoadMoreButton
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              onLoadMore={loadMore}
              itemCount={trades.length}
            />
          </>
        )}
      </div>
    </>
  );
};

export default ActivityFeed;
