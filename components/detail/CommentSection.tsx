"use client";

/**
 * CommentSection - 评论区组件
 * Activity Tab 基于 docs/API_TRADES_ALL.md 和 docs/API_Order_book_ws.md 实现
 */

import React, { useState, useRef, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  Heart,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { useActivity } from "./hooks/useActivity";
import { formatTimestamp } from "@/lib/services/orderBookService";
import {
  getHolderFilterOptions,
  getActivityFilterOptions,
  getMinAmountOptions,
  labelFor,
} from "@/components/common/filterOptions";
import { PolymarketMarketResp } from "@/types/home";
import ProxyImage from "@/components/common/ProxyImage";

interface Comment {
  id: string;
  username: string;
  avatar: string;
  position?: {
    amount: string;
    outcome: string;
  };
  timestamp: string;
  content: string;
  likes: number;
  isLiked?: boolean;
}

interface Holder {
  username: string;
  shares: number;
  avatarColor: string;
}

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

interface CommentSectionProps {
  marketId: string;
  unionKey?: string; // 用于获取 Activity 数据
  eventSlug?: string; // 用于 WebSocket 订阅（event_slug）
  markets?: PolymarketMarketResp[]; // 用于根据 assetId 查找 market 名称
}

// 模拟评论数据
const mockComments: Comment[] = [
  {
    id: "1",
    username: "labudakjporeec",
    avatar: "",
    position: { amount: "$ 50+", outcome: "bps decrease" },
    timestamp: "7h ago",
    content: "sure?",
    likes: 0,
  },
  {
    id: "2",
    username: "Galucucu",
    avatar: "",
    position: { amount: "2 25+", outcome: "bps increase" },
    timestamp: "23h ago",
    content: "I cant buy nothing :/",
    likes: 1,
  },
  {
    id: "3",
    username: "Galucucu",
    avatar: "",
    position: { amount: "2 25+", outcome: "bps increase" },
    timestamp: "23h ago",
    content: "bug?",
    likes: 1,
  },
  {
    id: "4",
    username: "CryptoVadikOne-t...",
    avatar: "",
    position: { amount: "302.9K 50+", outcome: "bps decrease" },
    timestamp: "23h ago",
    content: "Thanks for the discounts)",
    likes: 2,
  },
  {
    id: "5",
    username: "Lupin2",
    avatar: "",
    position: { amount: "231 50+", outcome: "bps decrease" },
    timestamp: "1d ago",
    content:
      "the US economy needs liquidity and cutting rates helps provide exactly that. Moreover job data is f***ed and some other data wasn't released due to the shut down. EZ 25bps, 50bps If Jerome pulls his finger out",
    likes: 2,
  },
  {
    id: "6",
    username: "frauden",
    avatar: "",
    position: { amount: "105", outcome: "No change" },
    timestamp: "1d ago",
    content: "there is absolutely changes",
    likes: 0,
  },
];

// 模拟 Yes 持有者数据
const mockYesHolders: Holder[] = [
  {
    username: "G.V",
    shares: 400000,
    avatarColor: "from-purple-400 to-blue-500",
  },
  {
    username: "Hersheys",
    shares: 384614,
    avatarColor: "from-pink-400 to-purple-500",
  },
  {
    username: "Slippery-Modernist",
    shares: 313847,
    avatarColor: "from-green-400 to-teal-500",
  },
  {
    username: "CryptoVadikOne-tg",
    shares: 304414,
    avatarColor: "from-blue-400 to-cyan-500",
  },
  {
    username: "sbfftx",
    shares: 275800,
    avatarColor: "from-orange-400 to-red-500",
  },
  {
    username: "WAGMI-369",
    shares: 267964,
    avatarColor: "from-indigo-400 to-purple-500",
  },
  {
    username: "risk-manager",
    shares: 144874,
    avatarColor: "from-gray-400 to-gray-600",
  },
  {
    username: "denkata",
    shares: 100000,
    avatarColor: "from-blue-400 to-indigo-500",
  },
  {
    username: "bigboi69",
    shares: 84400,
    avatarColor: "from-purple-400 to-pink-500",
  },
  {
    username: "bbpro1",
    shares: 76586,
    avatarColor: "from-teal-400 to-green-500",
  },
  {
    username: "big6big8",
    shares: 63606,
    avatarColor: "from-yellow-400 to-orange-500",
  },
  { username: "m8i", shares: 62155, avatarColor: "from-red-400 to-pink-500" },
  {
    username: "BobbyBlanco",
    shares: 61875,
    avatarColor: "from-purple-400 to-indigo-500",
  },
  {
    username: "lmgg",
    shares: 56992,
    avatarColor: "from-blue-400 to-purple-500",
  },
  {
    username: "Tender-Pita",
    shares: 55000,
    avatarColor: "from-green-400 to-emerald-500",
  },
];

// 模拟 No 持有者数据
const mockNoHolders: Holder[] = [
  {
    username: "Raven4006",
    shares: 132828,
    avatarColor: "from-yellow-300 to-orange-400",
  },
  {
    username: "luciousleft",
    shares: 100000,
    avatarColor: "from-pink-300 to-purple-400",
  },
  {
    username: "Hawk-1",
    shares: 40185,
    avatarColor: "from-green-300 to-teal-400",
  },
  {
    username: "pmcb",
    shares: 40000,
    avatarColor: "from-blue-300 to-indigo-400",
  },
  {
    username: "onlyCandle",
    shares: 30833,
    avatarColor: "from-orange-300 to-red-400",
  },
  {
    username: "A018981",
    shares: 20900,
    avatarColor: "from-purple-300 to-pink-400",
  },
  {
    username: "0xdamocles",
    shares: 20000,
    avatarColor: "from-teal-300 to-cyan-400",
  },
  {
    username: "megafom",
    shares: 20000,
    avatarColor: "from-indigo-300 to-blue-400",
  },
  {
    username: "peegeeleeks",
    shares: 18300,
    avatarColor: "from-red-300 to-orange-400",
  },
  {
    username: "pigswallet",
    shares: 14699,
    avatarColor: "from-pink-300 to-rose-400",
  },
  {
    username: "chriszyy",
    shares: 10333,
    avatarColor: "from-yellow-300 to-amber-400",
  },
  {
    username: "QMG-SCALAR",
    shares: 10000,
    avatarColor: "from-cyan-300 to-blue-400",
  },
  {
    username: "Cigarettes",
    shares: 10000,
    avatarColor: "from-purple-300 to-violet-400",
  },
  {
    username: "huatimus",
    shares: 10000,
    avatarColor: "from-green-300 to-lime-400",
  },
  { username: "d1k21", shares: 5192, avatarColor: "from-gray-400 to-gray-600" },
];


const CommentSection: React.FC<CommentSectionProps> = ({
  marketId,
  unionKey,
  eventSlug,
  markets = [],
}) => {
  const { t } = useTranslation();

  // 调试日志
  console.log("[CommentSection] markets:", markets.length, "eventSlug:", eventSlug);

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
          console.error('[CommentSection] Failed to parse market clobTokenIds', e);
        }
      }
      return null;
    },
    [markets]
  );

  const [activeTab, setActiveTab] = useState(0);
  const tabs = [t.market.comments, t.market.topHolders, t.market.activity];
  const [sortBy, setSortBy] = useState("Newest");
  const [holdersOnly, setHoldersOnly] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>(mockComments);
  const holderFilterOptions = getHolderFilterOptions(t);
  const activityFilterOptions = getActivityFilterOptions(t);
  const minAmountOptions = getMinAmountOptions(t);

  const [holderFilter, setHolderFilter] = useState<string>("decrease50");
  const [holderFilterOpen, setHolderFilterOpen] = useState(false);
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [activityFilterOpen, setActivityFilterOpen] = useState(false);
  const [minAmount, setMinAmount] = useState<string>("min");
  const [minAmountOpen, setMinAmountOpen] = useState(false);

  // 使用 useActivity hook 获取真实交易数据
  const {
    trades,
    isLoading: isActivityLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useActivity({
    eventId: unionKey || marketId,
    unionKey: unionKey || marketId,
    eventSlug: eventSlug || marketId,
    enabled: activeTab === 2, // 只在 Activity tab 激活时加载
    pageSize: 20,
  });

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

  const handleLike = (commentId: string) => {
    setComments(
      comments.map((c) =>
        c.id === commentId
          ? {
              ...c,
              likes: c.isLiked ? c.likes - 1 : c.likes + 1,
              isLiked: !c.isLiked,
            }
          : c
      )
    );
  };

  // 生成随机渐变色头像
  const getAvatarGradient = (username: string) => {
    const colors = [
      "from-orange-500 to-yellow-500",
      "from-purple-500 to-pink-500",
      "from-blue-500 to-cyan-500",
      "from-green-500 to-emerald-500",
      "from-red-500 to-orange-500",
    ];
    const index = username.charCodeAt(0) % colors.length;
    return colors[index];
  };

  return (
    <div className="mt-6">
      {/* 标签页 */}
      <div className="flex items-center gap-6 border-b border-[var(--border)] mb-4">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            onClick={() => setActiveTab(index)}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeTab === index
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tab}
            {activeTab === index && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
            )}
          </button>
        ))}
      </div>

      {/* Comments Tab Content */}
      {activeTab === 0 && (
        <>
          {/* 评论输入框 */}
          <div className="flex items-center gap-3 mb-4 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder={t.market.addComment}
              className="flex-1 bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none text-sm"
            />
            <button
              disabled={!commentText.trim()}
              className={`text-sm font-medium transition-colors ${
                commentText.trim()
                  ? "text-[var(--accent)] hover:underline"
                  : "text-[var(--text-tertiary)]"
              }`}
            >
              {t.market.post}
            </button>
          </div>

          {/* 过滤器 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                {sortBy} <span>▾</span>
              </button>
              <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={holdersOnly}
                  onChange={(e) => setHoldersOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-secondary)] accent-[var(--accent)]"
                />
                {t.market.holdersOnly}
              </label>
            </div>
            <button className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              {t.market.bewareLinks}
            </button>
          </div>

          {/* 评论列表 */}
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                {/* 头像 */}
                <div
                  className={`w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br ${getAvatarGradient(
                    comment.username
                  )}`}
                />

                {/* 评论内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-[var(--text-primary)]">
                      {comment.username}
                    </span>
                    {comment.position && (
                      <span className="px-2 py-0.5 rounded text-xs bg-[var(--bg-hover)] text-[var(--accent)]">
                        {comment.position.amount} {comment.position.outcome} ▾
                      </span>
                    )}
                    <span className="text-xs text-[var(--text-tertiary)]">
                      {comment.timestamp}
                    </span>
                    <button className="ml-auto text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                    {comment.content}
                  </p>
                  <button
                    onClick={() => handleLike(comment.id)}
                    className={`flex items-center gap-1 mt-2 text-sm transition-colors ${
                      comment.isLiked
                        ? "text-[var(--red)]"
                        : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Heart
                      size={14}
                      fill={comment.isLiked ? "currentColor" : "none"}
                    />
                    <span>{comment.likes}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Top Holders Tab Content */}
      {activeTab === 1 && (
        <>
          {/* 过滤器 */}
          <div className="mb-6 relative">
            <button
              onClick={() => setHolderFilterOpen(!holderFilterOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text-primary)] hover:border-[var(--border-light)]"
            >
              {labelFor(holderFilterOptions, holderFilter)}
              <ChevronDown
                size={16}
                className={`transition-transform ${
                  holderFilterOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {holderFilterOpen && (
              <div className="absolute top-full left-0 mt-1 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] shadow-lg z-10 min-w-[180px]">
                {holderFilterOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setHolderFilter(option.value);
                      setHolderFilterOpen(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm hover:bg-[var(--bg-hover)] ${
                      holderFilter === option.value
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

          {/* 持有者列表 */}
          <div className="grid grid-cols-2 gap-8">
            {/* Yes Holders */}
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border)]">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {t.market.yesHolders}
                </span>
                <span className="text-xs text-[var(--text-secondary)] uppercase">
                  {t.market.shares}
                </span>
              </div>
              <div className="space-y-2">
                {mockYesHolders.map((holder, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 py-1.5 hover:bg-[var(--bg-hover)] rounded-lg px-2 -mx-2 cursor-pointer"
                  >
                    <div
                      className={`w-8 h-8 rounded-full bg-gradient-to-br ${holder.avatarColor}`}
                    />
                    <span className="flex-1 text-sm text-[var(--text-primary)] truncate">
                      {holder.username}
                    </span>
                    <span className="text-sm text-[var(--green)] font-medium">
                      {holder.shares.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* No Holders */}
            <div>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border)]">
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {t.market.noHolders}
                </span>
                <span className="text-xs text-[var(--text-secondary)] uppercase">
                  {t.market.shares}
                </span>
              </div>
              <div className="space-y-2">
                {mockNoHolders.map((holder, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 py-1.5 hover:bg-[var(--bg-hover)] rounded-lg px-2 -mx-2 cursor-pointer"
                  >
                    <div
                      className={`w-8 h-8 rounded-full bg-gradient-to-br ${holder.avatarColor}`}
                    />
                    <span className="flex-1 text-sm text-[var(--text-primary)] truncate">
                      {holder.username}
                    </span>
                    <span className="text-sm text-[var(--red)] font-medium">
                      {holder.shares.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Activity Tab Content */}
      {activeTab === 2 && (
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
            {isActivityLoading ? (
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
                    if (activityFilter === "sells")
                      return trade.side === "SELL";
                    return true;
                  })
                  .map((trade, index, filteredTrades) => {
                    const isLast = index === filteredTrades.length - 1;
                    const isBuy = trade.side === "BUY";
                    const displayPrice = (trade.price * 100).toFixed(1); // price * 100

                    return (
                      <div
                        key={`${trade.userId}-${trade.timestamp}-${index}`}
                        ref={isLast ? lastActivityRef : null}
                        className="flex items-center gap-3 py-3 hover:bg-[var(--bg-hover)] rounded-lg px-2 -mx-2"
                      >
                        {/* 头像 */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0 overflow-hidden">
                          {trade.profileImage && (
                            <ProxyImage
                              src={trade.profileImage}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) =>
                                ((e.target as HTMLImageElement).style.display =
                                  "none")
                              }
                            />
                          )}
                        </div>

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
      )}

      {/* 返回顶部 */}
      <div className="flex justify-center mt-6">
        <button className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[var(--bg-hover)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          {t.common.backToTop} <ChevronUp size={16} />
        </button>
      </div>
    </div>
  );
};

export default CommentSection;
