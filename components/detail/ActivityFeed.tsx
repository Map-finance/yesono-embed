import React, { useState, useRef, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  getActivityFilterOptions,
  getMinAmountOptions,
  labelFor,
} from "@/components/common/filterOptions";
import { ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { useActivity } from "./hooks/useActivity";
import { formatTimestamp } from "@/lib/services/orderBookService";
import { PolymarketMarketResp } from "@/types/home";
import Avatar from "@/components/common/Avatar";

interface Activity {
  id: string;
  username: string;
  avatarColor: string;
  action: "bought" | "sold";
  amount: number;
  type: "Yes" | "No";
  option: string;
  price: number;
  total: number;
  timeAgo: string;
}

interface ActivityFeedProps {
  marketId: string;
  unionKey?: string; // 用于获取 Activity 数据
  eventSlug?: string; // 用于 WebSocket 订阅（event_slug）
  eventId?: string;   // 事件 ID，用于 trades API
  markets?: PolymarketMarketResp[]; // 用于根据 assetId 查找 market 名称
}

// 模拟活动数据
const mockActivities: Activity[] = [
  {
    id: "1",
    username: "Trivial-Loinclo...",
    avatarColor: "from-yellow-300 to-orange-400",
    action: "sold",
    amount: 24,
    type: "No",
    option: "25+ bps increase",
    price: 99.6,
    total: 24,
    timeAgo: "2m ago",
  },
  {
    id: "2",
    username: "shalley",
    avatarColor: "from-pink-300 to-purple-400",
    action: "bought",
    amount: 2,
    type: "Yes",
    option: "No change",
    price: 88.0,
    total: 2,
    timeAgo: "3m ago",
  },
  {
    id: "3",
    username: "5273853",
    avatarColor: "from-blue-300 to-indigo-400",
    action: "bought",
    amount: 10,
    type: "Yes",
    option: "25 bps decrease",
    price: 12.0,
    total: 1,
    timeAgo: "3m ago",
  },
  {
    id: "4",
    username: "shalley",
    avatarColor: "from-pink-300 to-purple-400",
    action: "sold",
    amount: 2,
    type: "Yes",
    option: "No change",
    price: 87.0,
    total: 2,
    timeAgo: "3m ago",
  },
  {
    id: "5",
    username: "Forked-Volcano",
    avatarColor: "from-orange-300 to-yellow-400",
    action: "bought",
    amount: 127,
    type: "No",
    option: "25+ bps increase",
    price: 99.7,
    total: 126,
    timeAgo: "3m ago",
  },
  {
    id: "6",
    username: "shalley",
    avatarColor: "from-pink-300 to-purple-400",
    action: "bought",
    amount: 2,
    type: "Yes",
    option: "No change",
    price: 88.0,
    total: 2,
    timeAgo: "3m ago",
  },
  {
    id: "7",
    username: "shalley",
    avatarColor: "from-pink-300 to-purple-400",
    action: "sold",
    amount: 2,
    type: "Yes",
    option: "No change",
    price: 87.0,
    total: 2,
    timeAgo: "4m ago",
  },
  {
    id: "8",
    username: "eee77",
    avatarColor: "from-green-300 to-teal-400",
    action: "bought",
    amount: 3,
    type: "No",
    option: "50+ bps decrease",
    price: 98.8,
    total: 3,
    timeAgo: "4m ago",
  },
  {
    id: "9",
    username: "15sol",
    avatarColor: "from-cyan-300 to-blue-400",
    action: "sold",
    amount: 429,
    type: "Yes",
    option: "50+ bps decrease",
    price: 1.2,
    total: 5,
    timeAgo: "5m ago",
  },
  {
    id: "10",
    username: "shalley",
    avatarColor: "from-pink-300 to-purple-400",
    action: "bought",
    amount: 2,
    type: "Yes",
    option: "No change",
    price: 88.0,
    total: 2,
    timeAgo: "5m ago",
  },
  {
    id: "11",
    username: "Gray-Dock",
    avatarColor: "from-green-300 to-emerald-400",
    action: "bought",
    amount: 23,
    type: "No",
    option: "50+ bps decrease",
    price: 98.8,
    total: 23,
    timeAgo: "5m ago",
  },
  {
    id: "12",
    username: "yujuan17",
    avatarColor: "from-purple-300 to-pink-400",
    action: "sold",
    amount: 100,
    type: "No",
    option: "50+ bps decrease",
    price: 98.7,
    total: 99,
    timeAgo: "6m ago",
  },
  {
    id: "13",
    username: "shalley",
    avatarColor: "from-pink-300 to-purple-400",
    action: "sold",
    amount: 2,
    type: "Yes",
    option: "No change",
    price: 87.0,
    total: 2,
    timeAgo: "6m ago",
  },
];

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  marketId,
  unionKey,
  eventSlug,
  eventId,
  markets = [],
}) => {
  const { t } = useTranslation();
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
    pageSize: 20,
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

  // 无限滚动加载（loadMore 内部通过 ref 自行判断 isLoadingMore/hasMore，避免依赖变化导致渲染循环）
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastActivityRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      });
      observerRef.current.observe(node);
    },
    [loadMore]
  );

  return (
    <>
      {/* 过滤器 */}
      <div className="flex items-center gap-3 mb-6">
        {/* Activity Filter */}
        <div className="relative">
          <button
            onClick={() => setActivityFilterOpen(!activityFilterOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] hover:border-[var(--border-light)]"
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
            <div className="absolute top-full left-0 mt-1 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-lg z-10 min-w-[100px]">
              {activityFilterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setActivityFilter(option.value);
                    setActivityFilterOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg-hover)] ${
                    activityFilter === option.value
                      ? "text-[var(--accent)]"
                      : "text-[var(--text-primary)]"
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] hover:border-[var(--border-light)]"
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
            <div className="absolute top-full left-0 mt-1 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-lg z-10 min-w-[120px]">
              {minAmountOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setMinAmount(option.value);
                    setMinAmountOpen(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg-hover)] ${
                    minAmount === option.value
                      ? "text-[var(--accent)]"
                      : "text-[var(--text-primary)]"
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
              className="animate-spin text-[var(--text-tertiary)]"
            />
          </div>
        ) : trades.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-[var(--text-tertiary)]">
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
              .map((trade, index, filteredTrades) => {
                const isLast = index === filteredTrades.length - 1;
                const isBuy = trade.side === "BUY";
                const displayPrice = (trade.price * 100).toFixed(1);

                return (
                  <div
                    key={`${trade.userId}-${trade.timestamp}-${index}`}
                    ref={isLast ? lastActivityRef : null}
                    className="flex items-center gap-3 py-3 hover:bg-[var(--bg-hover)] rounded-lg px-2 -mx-2"
                  >
                    {/* 头像 */}
                    <Avatar
                      src={trade.profileImage}
                      name={trade.name}
                      id={trade.userId}
                      size="sm"
                      className="w-10 h-10 text-sm"
                    />

                    {/* 活动内容 */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">
                        <span className="font-medium text-[var(--text-primary)]">
                          {trade.name ||
                            trade.userId?.slice(0, 12) ||
                            t.market.activityText.anonymous}
                        </span>
                        <span className="text-[var(--text-secondary)]">
                          {" "}
                          {isBuy
                            ? t.market.activityText.bought
                            : t.market.activityText.sold}{" "}
                        </span>
                        <span
                          className={
                            trade.outcome === "YES"
                              ? "text-[var(--green)] font-medium"
                              : "text-[var(--red)] font-medium"
                          }
                        >
                          {trade.size.toFixed(0)}{" "}
                          {trade.outcome || t.market.shares}
                        </span>
                        {trade.assetId &&
                          getMarketNameByAssetId(trade.assetId) && (
                            <span className="text-[var(--text-secondary)]">
                              {" "}
                              {t.market.activityText.for}{" "}
                            </span>
                          )}
                        {trade.assetId &&
                          getMarketNameByAssetId(trade.assetId) && (
                            <span className="text-[var(--text-primary)] font-medium">
                              {getMarketNameByAssetId(trade.assetId)}
                            </span>
                          )}
                        <span className="text-[var(--text-secondary)]">
                          {" "}
                          {t.market.activityText.at}{" "}
                        </span>
                        <span className="text-[var(--text-primary)]">
                          {displayPrice}¢
                        </span>
                        <span className="text-[var(--text-tertiary)]">
                          {" "}
                          (${(trade.size * trade.price).toFixed(0)})
                        </span>
                      </span>
                    </div>

                    {/* 时间和链接 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-[var(--text-tertiary)]">
                        {formatTimestamp(trade.timestamp)}
                      </span>
                      <ExternalLink
                        size={14}
                        className="text-[var(--text-tertiary)]"
                      />
                    </div>
                  </div>
                );
              })}

            {/* 加载更多指示器 */}
            {isLoadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2
                  size={20}
                  className="animate-spin text-[var(--text-tertiary)]"
                />
              </div>
            )}

            {/* 没有更多数据 */}
            {!hasMore && trades.length > 0 && (
              <div className="text-center py-4 text-[var(--text-tertiary)] text-xs">
                {t.market.activityText.noMoreActivity}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default ActivityFeed;
