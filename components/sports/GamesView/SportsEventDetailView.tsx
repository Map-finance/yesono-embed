"use client";

/**
 * SportsEventDetailView - 体育赛事详情视图
 * 当点击 Game View 时，替换列表显示
 * 包含：面包屑、标题、图表、Game Lines tabs、各市场分类卡片、底部评论区
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Bookmark, Share2, Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { getSportsEventBySlug } from "@/lib/services/sportsEventService";
import { favoriteEvent } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { SportsEventDetail, SportsMarketItem } from "@/types/sports";
import ProxyImage from "@/components/common/ProxyImage";
import MarketSection from "./MarketSection";
import MarketChart from "@/components/detail/MarketChart";
import { trackEvent } from "@/lib/sentryClient";
import { toChartData, toPolymarketMarkets } from "./SportsEventDetailView.helpers";
import ExactScorePanel from "./ExactScorePanel";
import HalftimeResultPanel from "./HalftimeResultPanel";
import EventBottomTabs from "./EventBottomTabs";

interface SportsEventDetailViewProps {
  /** 赛事 slug，用于调用 /api/sports/events/{slug} */
  eventSlug: string;
  /** 返回列表的回调 */
  onBack: () => void;
  /** 面包屑显示的标签名 */
  tagName?: string;
  /** 当选中市场时的回调（同步到右侧交易面板） */
  onMarketSelect?: (item: SportsMarketItem, event: SportsEventDetail, outcomeIdx?: number) => void;
  /** 当前选中的 marketId */
  selectedMarketId?: string;
  /** 当前选中的 outcome 索引 */
  selectedOutcomeIdx?: number;
  /** 加载事件数据后回调，通知父组件事件的 tagsSlug */
  onEventLoaded?: (tagsSlug: string[]) => void;
}

const SportsEventDetailView: React.FC<SportsEventDetailViewProps> = ({
  eventSlug,
  onBack,
  tagName,
  onMarketSelect,
  selectedMarketId,
  selectedOutcomeIdx,
  onEventLoaded,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [eventData, setEventData] = useState<SportsEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [activeGameLineTab, setActiveGameLineTab] = useState(0);

  // 加载赛事详情
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await getSportsEventBySlug(eventSlug);
      setEventData(data);
      setLoading(false);
      // 默认选中第一个 moneyline market
      if (data && onMarketSelect) {
        const firstMarket = data.market?.moneyline?.[0];
        if (firstMarket) {
          onMarketSelect(firstMarket, data);
        }
      }
      // 通知父组件事件的 tagsSlug，用于同步左侧菜单选中状态
      if (data && data.tagsSlug && data.tagsSlug.length > 0 && onEventLoaded) {
        onEventLoaded(data.tagsSlug);
      }
    };
    load();
  }, [eventSlug]);

  // 从 title 提取队伍
  const teams = useMemo(() => {
    if (!eventData) return { home: "", away: "" };
    const parts = eventData.title.split(/\s+vs\.?\s+/i);
    if (parts.length >= 2) {
      return { home: parts[0].trim(), away: parts[1].trim() };
    }
    return { home: eventData.title, away: "" };
  }, [eventData]);

  // 缩写
  const getAbbr = (name: string) => {
    const clean = name.replace(/\s*\(.*?\)/, "").trim();
    const words = clean.split(/\s+/);
    const word = words.find((w) => w.length > 2) || words[0] || "";
    return word.slice(0, 3).toUpperCase();
  };

  const homeAbbr = getAbbr(teams.home);
  const awayAbbr = getAbbr(teams.away);

  // 时间（使用 endDate）
  const endInfo = useMemo(() => {
    if (!eventData) return { time: "", date: "" };
    const d = new Date(Number(eventData.endDate));
    return {
      time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
      date: d.toLocaleDateString("en-US", { month: "long", day: "numeric" }),
    };
  }, [eventData]);

  // 从 market map 获取各分类，并分离特殊标签页内容
  const { gameLineCategories, exactScoreMarkets, halftimeResultMarkets } = useMemo(() => {
    if (!eventData?.market) return { gameLineCategories: [], exactScoreMarkets: [] as SportsMarketItem[], halftimeResultMarkets: [] as SportsMarketItem[] };
    const gameLine: { key: string; title: string; markets: SportsMarketItem[]; hasLineValues: boolean }[] = [];
    let exactScore: SportsMarketItem[] = [];
    let halftimeResult: SportsMarketItem[] = [];

    const marketMap = eventData.market;
    for (const [key, items] of Object.entries(marketMap)) {
      if (!items || !Array.isArray(items) || items.length === 0) continue;

      // 分离到对应标签页
      if (key === "soccer_exact_score") {
        exactScore = items;
        continue;
      }
      if (key === "soccer_halftime_result") {
        halftimeResult = items;
        continue;
      }

      let title = key;
      let hasLineValues = false;

      switch (key) {
        case "moneyline":
          title = t.sports.market.moneyline;
          break;
        case "spreads":
          title = t.sports.market.spreads;
          hasLineValues = true;
          break;
        case "totals":
          title = t.sports.market.totals;
          hasLineValues = true;
          break;
        case "both_teams_to_score":
          title = t.sports.detail.bothTeamsToScore;
          break;
        default:
          title = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      }

      gameLine.push({ key, title, markets: items, hasLineValues });
    }

    return { gameLineCategories: gameLine, exactScoreMarkets: exactScore, halftimeResultMarkets: halftimeResult };
  }, [eventData, t]);

  // 构造 MarketChart 所需数据 + 下游组件的 PolymarketMarketResp[]
  const chartData = useMemo(() => toChartData(eventData), [eventData]);
  const polymarketMarkets = useMemo(
    () => toPolymarketMarkets(eventData),
    [eventData]
  );

  const handleOutcomeClick = useCallback(
    (item: SportsMarketItem, idx: number) => {
      if (eventData && onMarketSelect) {
        onMarketSelect(item, eventData, idx);
      }
    },
    [eventData, onMarketSelect]
  );

  // Game Lines 子标签（动态生成，根据接口返回的数据决定显示哪些 tab）
  const gameLineTabs = useMemo(() => {
    const tabs: { label: string; key: string }[] = [
      { label: t.sports.detail.gameLines, key: "game_lines" },
    ];
    if (exactScoreMarkets.length > 0) {
      tabs.push({ label: t.sports.detail.exactScore, key: "exact_score" });
    }
    if (halftimeResultMarkets.length > 0) {
      tabs.push({ label: t.sports.detail.halftimeResult, key: "halftime_result" });
    }
    return tabs;
  }, [exactScoreMarkets, halftimeResultMarkets, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-(--accent)" />
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="text-center py-12 text-(--text-tertiary)">
        {t.sports.game.noEvents}
      </div>
    );
  }

  return (
    <div>
      {/* 面包屑 */}
      <div className="flex items-center gap-1.5 text-xs text-(--text-tertiary) mb-2">
        <button onClick={onBack} className="hover:text-(--text-primary) transition-colors">
          {t.common.nav.sports || "Sports"}
        </button>
        <span>›</span>
        {tagName && (
          <>
            <button onClick={onBack} className="hover:text-(--text-primary) transition-colors">
              {tagName}
            </button>
            <span>›</span>
          </>
        )}
      </div>

      {/* 标题 + 图标 */}
      <div className="flex items-start justify-between mb-3 gap-2">
        <h1 className="text-base sm:text-lg font-bold text-(--text-primary) min-w-0">
          {teams.home} vs {teams.away || ""}
        </h1>
        <div className="flex items-center gap-1 shrink-0">
          {/* <button className="p-1.5 rounded hover:bg-(--bg-secondary) text-(--text-secondary) hidden sm:block">
            <Settings size={16} />
          </button> */}
          {/* <button className="p-1.5 rounded hover:bg-(--bg-secondary) text-(--text-secondary) hidden sm:block">
            <Code size={16} />
          </button> */}
          <button
            className={`p-1.5 rounded hover:bg-(--bg-secondary) transition-colors ${
              isFavorite ? "text-(--accent)" : "text-(--text-secondary)"
            }`}
            onClick={async () => {
              if (!eventData) return;
              const newStatus = !isFavorite;
              setIsFavorite(newStatus);
              try {
                const res = await favoriteEvent({ slug: eventSlug, isFavorite: newStatus });
                if (res.success) {
                  toast.success(newStatus ? t.common.addedToFavorites : t.common.removedFromFavorites);
                } else {
                  setIsFavorite(!newStatus);
                  toast.error(t.common.operationFailed);
                }
              } catch (e) {
                console.error('[SportsEventDetailView] Failed to toggle favorite', e);
                setIsFavorite(!newStatus);
                toast.error(t.common.operationFailed);
              }
            }}
          >
            <Bookmark size={16} fill={isFavorite ? "currentColor" : "none"} />
          </button>
          <button
            className="p-1.5 rounded hover:bg-(--bg-secondary) text-(--text-secondary)"
            onClick={() => {
              trackEvent("market_share_click", { event_id: eventData.id, event_title: eventData.title, channel: "copy_link" });
              navigator.clipboard.writeText(window.location.href).then(() => {
                toast.success(t.common.linkCopied);
              }).catch(() => {
                toast.error(t.common.operationFailed);
              });
            }}
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>

      {/* 赛事头部信息：队伍图标 + 时间 + 交易量 */}
      <div className="flex items-center justify-center gap-4 sm:gap-8 mb-4 py-3 sm:py-4 border border-(--border) rounded-lg bg-(--bg-card)">
        {/* 主队 */}
        <div className="flex flex-col items-center gap-1">
          <ProxyImage
            src={eventData.icon}
            alt=""
            className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
            fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIyNCIgZmlsbD0iIzNhM2EzYSIvPjwvc3ZnPg=="
          />
          <span className="text-xs sm:text-sm font-medium">{homeAbbr}</span>
        </div>

        {/* 中间信息 */}
        <div className="text-center">
          <div className="text-sm font-semibold">{endInfo.time}</div>
          <div className="text-xs text-(--text-secondary)">{endInfo.date}</div>
        </div>

        {/* 客队 */}
        <div className="flex flex-col items-center gap-1">
          <ProxyImage
            src={eventData.image}
            alt=""
            className="w-10 h-10 sm:w-12 sm:h-12 object-contain"
            fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHJ4PSIyNCIgZmlsbD0iIzNhM2EzYSIvPjwvc3ZnPg=="
          />
          <span className="text-xs sm:text-sm font-medium">{awayAbbr}</span>
        </div>
      </div>

      {/* 交易量 */}
      <div className="flex items-center gap-2 text-xs text-(--text-secondary) mb-4">
        <span>
          {eventData.volume != null
            ? `$${eventData.volume} ${t.sports.game.vol}.`
            : `— ${t.sports.game.vol}.`}
        </span>
      </div>

      {/* 价格图表：取 moneyline 三个 market */}
      {chartData && (
        <div className="mb-6">
          <MarketChart
            market={chartData.market}
            eventMarkets={chartData.eventMarkets}
            isSports
          />
        </div>
      )}

      {/* Game Lines 标签 */}
      <div className="flex items-center gap-2 sm:gap-4 border-b border-(--border) mb-4 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {gameLineTabs.map((tab, idx) => (
          <button
            key={tab.key}
            onClick={() => setActiveGameLineTab(idx)}
            className={`pb-2 text-sm font-medium whitespace-nowrap transition-colors relative ${
              activeGameLineTab === idx
                ? "text-(--text-primary)"
                : "text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            {tab.label}
            {activeGameLineTab === idx && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-(--accent)" />
            )}
          </button>
        ))}
      </div>

      {/* Game Lines 内容 */}
      {gameLineTabs[activeGameLineTab]?.key === "game_lines" && (
        <div className="space-y-4">
          {gameLineCategories.map((cat) => (
            <MarketSection
              key={cat.key}
              title={cat.title}
              markets={cat.markets}
              hasLineValues={cat.hasLineValues}
              sectionKey={cat.key}
              homeAbbr={homeAbbr}
              awayAbbr={awayAbbr}
              onOutcomeClick={handleOutcomeClick}
              selectedMarketId={selectedMarketId}
              selectedOutcomeIdx={selectedOutcomeIdx}
              {...(cat.key === "moneyline" && chartData
                ? { chartMarket: chartData.market, chartEventMarkets: chartData.eventMarkets }
                : {})}
            />
          ))}
        </div>
      )}

      {/* Exact Score 标签页 */}
      {gameLineTabs[activeGameLineTab]?.key === "exact_score" && (
        <ExactScorePanel
          markets={exactScoreMarkets}
          selectedMarketId={selectedMarketId}
          selectedOutcomeIdx={selectedOutcomeIdx}
          onOutcomeClick={handleOutcomeClick}
        />
      )}

      {/* Halftime Result 标签页 */}
      {gameLineTabs[activeGameLineTab]?.key === "halftime_result" && (
        <HalftimeResultPanel
          markets={halftimeResultMarkets}
          selectedMarketId={selectedMarketId}
          onOutcomeClick={handleOutcomeClick}
        />
      )}

      <EventBottomTabs
        eventData={eventData}
        polymarketMarkets={polymarketMarkets}
      />
    </div>
  );
};

export default SportsEventDetailView;
