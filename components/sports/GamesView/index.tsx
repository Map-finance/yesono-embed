"use client";

/**
 * SportsGamesView - 体育赛事 Games 视图主容器
 * - Games: 按日期分组 + MONEYLINE/SPREAD/TOTAL 列头 + 赛事卡片 + 右侧交易面板 + 底部评论区
 * - Props: 无右侧交易面板，复用 MarketGrid 卡片（自带 YES/NO 交易）
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Search, Loader2, Settings, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { useSportsEvents } from "@/lib/hooks/useSportsEvents";
import { useTagTree } from "@/lib/hooks/useTagTree";
import { SportsEventDetail, SportsMarketItem } from "@/types/sports";
import { sortOutcomesByOriginalIndex } from "@/lib/utils/outcomes";
import { clampOutcomeProbabilityPercent } from "@/utils/format";
import SportsEventCard from "./SportsEventCard";
import SportsEventDetailView from "./SportsEventDetailView";
import CommentSection from "@/components/common/CommentSection";
import MarketGrid from "@/components/MarketGrid";
import { Market } from "@/types/types";
import { useTradingStore } from "@/lib/store/tradingStore";
import ProxyImage from "@/components/common/ProxyImage";
import SharedTradingPanel from "@/components/common/TradingPanel";
import {
  getMoneylineSettlementLabel,
  getSpreadSettlementLabel,
  getTotalSettlementLabel,
} from "./settlement";

/** 已结算市场替代交易面板：右栏蓝色"已结算"展示 */
function SportsResolvedPanel({
  market,
  allMoneylineMarkets,
  t,
}: {
  market: SportsMarketItem;
  allMoneylineMarkets?: SportsMarketItem[];
  t: any;
}) {
  const s = t.sports.settlement;
  const subType = market.subType?.toLowerCase();
  const label = (() => {
    if (subType === "moneyline" && allMoneylineMarkets?.length) {
      return getMoneylineSettlementLabel(allMoneylineMarkets, s);
    }
    if (subType === "spreads") return getSpreadSettlementLabel(market, s);
    if (subType === "totals") return getTotalSettlementLabel(market, s);
    return market.result != null
      ? `${s.resolved}: ${market.marketTitle}`
      : s.resolved;
  })();

  return (
    <div className="p-6 flex flex-col items-center">
      <div className="w-16 h-16 rounded-full bg-[#3b82f6] flex items-center justify-center mb-4">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="text-lg font-semibold text-[#3b82f6] mb-2 text-center">
        {label}
      </div>
      <div className="text-sm text-(--text-secondary) text-center">
        {market.marketTitle}
      </div>
    </div>
  );
}

interface SportsGamesViewProps {
  tagSlug: string;
  tagsChain: string;
  tagName?: string;
  /** 从 URL 参数传入的 event slug，用于直接打开比赛详情视图 */
  initialEventSlug?: string | null;
}

const SportsGamesView: React.FC<SportsGamesViewProps> = ({
  tagSlug,
  tagsChain,
  tagName,
  initialEventSlug,
}) => {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<"games" | "props">("games");
  const [selectedMarket, setSelectedMarket] = useState<SportsMarketItem | null>(
    null
  );
  const [selectedEvent, setSelectedEvent] = useState<SportsEventDetail | null>(
    null
  );
  const [selectedOutcomeIdx, setSelectedOutcomeIdx] = useState<number>(0);
  // 详情视图：当 detailSlug 有值时，显示详情替换列表
  const [detailSlug, setDetailSlug] = useState<string | null>(
    initialEventSlug ?? null
  );
  // 同一时间只允许一个卡片展开（控制 WS 连接数）
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  // 防止重复更新 URL
  const tagsUpdatedRef = useRef(false);

  // 当 tagsChain 变化时（左侧菜单切换），退出详情视图回到列表，并收起所有卡片
  // 但如果有 initialEventSlug（从 URL 直接打开比赛详情），不清除 detailSlug
  useEffect(() => {
    if (!initialEventSlug) {
      setDetailSlug(null);
    }
    setSelectedMarket(null);
    setSelectedEvent(null);
    setExpandedEventId(null);
  }, [tagsChain]);

  // 当 initialEventSlug 变化时（URL event 参数变化），同步到 detailSlug
  useEffect(() => {
    if (initialEventSlug) {
      setDetailSlug(initialEventSlug);
      tagsUpdatedRef.current = false;
    }
  }, [initialEventSlug]);

  // 当事件加载完成后，如果 URL 缺少 tag/tags 参数，用事件的 tagsSlug 补全 URL，使左侧菜单正确选中
  const handleEventLoaded = useCallback((eventTagsSlugs: string[]) => {
    if (tagsUpdatedRef.current) return;
    const currentTag = searchParams.get("tag");
    // 过滤掉 "games" 标记 tag，保留体育分类链（与 buildSportsEventUrl 逻辑一致）
    const sportsTags = eventTagsSlugs.filter((s) => s !== "games");
    // 仅在 URL 缺少 tag 参数或 tag 为 "games" 时补全
    if ((!currentTag || currentTag === "games") && sportsTags.length > 0) {
      tagsUpdatedRef.current = true;
      const tagsChainStr = sportsTags.join(",");
      const leafTag = sportsTags[sportsTags.length - 1];
      const params = new URLSearchParams(searchParams.toString());
      params.set("tag", leafTag);
      params.set("tags", tagsChainStr);
      router.replace(`/sports?${params.toString()}`);
    }
  }, [searchParams, router]);

  // tradingStore 用于交易面板
  const {
    setMarket: setStoreMarket,
    setEvent: setStoreEvent,
    setSelectOutcomeId,
    selectOutcomeId: storeOutcomeId,
  } = useTradingStore();

  // Games 数据
  const {
    events: gamesEvents,
    isLoading: gamesLoading,
    hasMore: gamesHasMore,
    isLoadingMore: gamesLoadingMore,
    loadMore: gamesLoadMore,
  } = useSportsEvents({
    tags: tagsChain,
    tab: "games",
    enabled: activeTab === "games",
  });

  // 是否用户手动切换过 tab（同一联赛内）。一旦用户手动点过任一 tab，就不再自动跳转
  const userManuallySwitchedRef = useRef(false);

  // Props 数据：并行预取，让用户可以在 games 空时快速看到 props 内容
  const {
    events: propsEvents,
    isLoading: propsLoading,
    hasMore: propsHasMore,
    isLoadingMore: propsLoadingMore,
    loadMore: propsLoadMore,
    refresh: propsRefresh,
  } = useSportsEvents({
    tags: tagsChain,
    tab: "props",
    enabled: true,
  });

  // 两边都加载完毕后，若用户未手动切换、且 games 空 props 有，则自动切到 props（games 优先）
  useEffect(() => {
    if (userManuallySwitchedRef.current) return;
    if (activeTab !== "games") return;
    if (gamesLoading || propsLoading) return;
    if (gamesEvents.length > 0) return;
    if (propsEvents.length === 0) return;
    setActiveTab("props");
  }, [activeTab, gamesLoading, propsLoading, gamesEvents.length, propsEvents.length]);

  // 切换联赛 / tagsChain 变化时，重置手动标记并回到默认 games
  useEffect(() => {
    userManuallySwitchedRef.current = false;
    setActiveTab("games");
  }, [tagsChain]);

  const handleTabClick = (tab: "games" | "props") => {
    userManuallySwitchedRef.current = true;
    setActiveTab(tab);
  };

  // 当选中 market/event 变化时，同步到 tradingStore（不包含 outcomeIdx，避免 setStoreMarket 重置 selectOutcomeId）
  useEffect(() => {
    if (selectedMarket && selectedEvent) {
      const outcomes = selectedMarket.outcomes || [];
      const getTokenId = (o: (typeof outcomes)[0]) => String(o.tokenId || o.id);
      const marketResp = {
        id: selectedMarket.marketId,
        eventId: selectedEvent.id,
        question: selectedMarket.marketTitle,
        conditionId: selectedMarket.conditionId,
        slug: selectedEvent.slug,
        outcomes: JSON.stringify(outcomes.map((o) => o.outcome)),
        outcomePrices: JSON.stringify(outcomes.map((o) => o.price)),
        clobTokenIds: JSON.stringify(outcomes.map((o) => getTokenId(o))),
        marketOutcomes: outcomes.map((o) => ({
          id: o.id,
          tokenId: getTokenId(o),
          name: String(o.outcome ?? ""),
          outcomeKey: o.originalIndex === 0 ? "YES" : "NO",
          originalIndex: o.originalIndex,
          tradingPair: (o as any).tradingPair || getTokenId(o),
          clobPairId: (o as any).clobPairId || getTokenId(o),
          unionKey: (o as any).unionKey || "",
        })),
        active: true,
        closed: false,
        volume: 0,
        startDate: Number(selectedEvent.startDate),
        endDate: Number(selectedEvent.endDate),
        image: selectedEvent.image || "",
        icon: selectedEvent.icon || "",
      } as any;

      const eventResp = {
        id: selectedEvent.id,
        slug: selectedEvent.slug,
        title: selectedEvent.title,
        markets: [marketResp],
        image: selectedEvent.image || "",
        icon: selectedEvent.icon || "",
      } as any;

      setStoreEvent(eventResp);
      setStoreMarket(marketResp);

      // market 变化时，用当前 outcomeIdx 设置初始 outcome
      const selectedOutcome = outcomes[selectedOutcomeIdx] || outcomes[0];
      if (selectedOutcome) {
        setSelectOutcomeId(getTokenId(selectedOutcome));
      }
    }
  }, [selectedMarket, selectedEvent, setStoreMarket, setStoreEvent, setSelectOutcomeId]);

  // 当 selectedOutcomeIdx 变化时（卡片按钮点击），只更新 selectOutcomeId，不重设 market
  useEffect(() => {
    if (!selectedMarket) return;
    const outcomes = selectedMarket.outcomes || [];
    const getTokenId = (o: (typeof outcomes)[0]) => String(o.tokenId || o.id);
    const selectedOutcome = outcomes[selectedOutcomeIdx] || outcomes[0];
    if (selectedOutcome) {
      setSelectOutcomeId(getTokenId(selectedOutcome));
    }
  }, [selectedOutcomeIdx]);

  // 当交易面板内部切换 Yes/No 时，将 storeOutcomeId 回同步到 selectedOutcomeIdx
  useEffect(() => {
    if (!storeOutcomeId || !selectedMarket) return;
    const outcomes = selectedMarket.outcomes || [];
    const idx = outcomes.findIndex(
      (o) => String(o.tokenId || o.id) === storeOutcomeId
    );
    if (idx !== -1 && idx !== selectedOutcomeIdx) {
      setSelectedOutcomeIdx(idx);
    }
  }, [storeOutcomeId]);

  // Props 转换为 Market 卡片（复用现有 MarketGrid，含 YES/NO 交易按钮）
  const propsMarkets: Market[] = useMemo(() => {
    if (activeTab !== "props" || !propsEvents.length) return [];
    return propsEvents.map((ev) => {
      const firstProp = ev.props?.[0];
      const yesPrice = sortOutcomesByOriginalIndex(firstProp?.outcomes || [])[0]
        ?.price;
      const percentage = clampOutcomeProbabilityPercent(yesPrice ?? null);

      return {
        id: ev.id,
        slug: ev.slug,
        icon: ev.icon || ev.image || "",
        title: ev.title,
        options: [{ label: ev.title, percentage }],
        volume: "",
        cardType: "image" as const,
        isLive: false,
        isResolved: false,
        isFavorite: false,
      };
    });
  }, [activeTab, propsEvents]);

  function getAbbr(title: string): string {
    const clean = title.replace(/\s*\(.*\)/, "").trim();
    const words = clean.split(/\s+/);
    const word = words.find((w) => w.length > 2) || words[0] || "";
    return word.slice(0, 4).toUpperCase();
  }

  // 按日期分组赛事（保持插入顺序）
  const groupedEvents = useMemo(() => {
    const groups: { date: string; events: SportsEventDetail[] }[] = [];
    const dateMap = new Map<string, SportsEventDetail[]>();
    const formatter = new Intl.DateTimeFormat(locale || "en-US", {
      weekday: "short",
      month: "long",
      day: "numeric",
    });

    gamesEvents.forEach((ev) => {
      const d = new Date(Number(ev.endDate));
      const dateKey = formatter.format(d);
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(ev);
    });

    dateMap.forEach((events, date) => {
      groups.push({ date, events });
    });

    return groups;
  }, [gamesEvents, locale]);

  // 默认选中第一个赛事的第一个 moneyline market
  // 当 gamesEvents 变化时，如果当前 selectedEvent 不在新列表中则重新选
  useEffect(() => {
    if (activeTab !== "games" || gamesEvents.length === 0) return;
    // 当前选中的 event 仍在列表中，保持不变
    if (selectedEvent && gamesEvents.some((ev) => ev.id === selectedEvent.id)) return;
    const firstEvent = gamesEvents[0];
    const firstMarket = firstEvent.market?.moneyline?.[0];
    if (firstMarket) {
      setSelectedMarket(firstMarket);
      setSelectedEvent(firstEvent);
      setSelectedOutcomeIdx(0);
    }
  }, [gamesEvents, activeTab]);

  // 移动端底部弹出交易面板状态
  const [showMobileTrading, setShowMobileTrading] = useState(false);

  // 移动端点击 outcome 时同时弹出交易面板
  const handleOutcomeMobile = useCallback(
    (
      marketItem: SportsMarketItem,
      outcomeIndex: number,
      event: SportsEventDetail
    ) => {
      setSelectedMarket(marketItem);
      setSelectedEvent(event);
      setSelectedOutcomeIdx(outcomeIndex);
      // 移动端自动弹出交易面板
      if (window.innerWidth < 1024) {
        setShowMobileTrading(true);
      }
    },
    []
  );

  const handleOutcomeClick = useCallback(
    (
      marketItem: SportsMarketItem,
      outcomeIndex: number,
      event: SportsEventDetail
    ) => {
      setSelectedMarket(marketItem);
      setSelectedEvent(event);
      setSelectedOutcomeIdx(outcomeIndex);
      // 移动端自动弹出交易面板
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setShowMobileTrading(true);
      }
    },
    []
  );

  // Game View 点击：切换到详情视图
  const handleGameView = useCallback((eventSlug: string) => {
    setDetailSlug(eventSlug);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // 从详情返回列表
  const handleBackFromDetail = useCallback(() => {
    setDetailSlug(null);
  }, []);

  // 详情视图中选中市场
  const handleDetailMarketSelect = useCallback(
    (item: SportsMarketItem, event: SportsEventDetail, outcomeIdx?: number) => {
      setSelectedMarket(item);
      setSelectedEvent(event);
      setSelectedOutcomeIdx(outcomeIdx ?? 0);
      // 移动端自动弹出交易面板
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        setShowMobileTrading(true);
      }
    },
    []
  );

  // 显示名称：取 tagsChain 最后一段，首字母大写
  const chainSlugs = useMemo(
    () =>
      tagsChain
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [tagsChain]
  );

  const selectedChainSlug = useMemo(() => {
    if (chainSlugs.length > 0) return chainSlugs[chainSlugs.length - 1];
    return tagSlug || "";
  }, [chainSlugs, tagSlug]);

  const parentChainSlug = useMemo(() => {
    if (chainSlugs.length >= 2) return chainSlugs[chainSlugs.length - 2];
    return undefined;
  }, [chainSlugs]);

  // Re-resolve localized label from tag APIs so title updates when locale changes.
  const { tags: sportsRootTags } = useTagTree({
    slug: "sports",
    withCount: true,
    enabled:
      !!selectedChainSlug &&
      selectedChainSlug !== "__asian__" &&
      selectedChainSlug !== "__live__",
  });

  const { tags: parentChildTags } = useTagTree({
    slug: parentChainSlug,
    withCount: true,
    enabled:
      !!parentChainSlug &&
      parentChainSlug !== "sports" &&
      selectedChainSlug !== "__asian__" &&
      selectedChainSlug !== "__live__",
  });

  const localizedDisplayName = useMemo(() => {
    if (selectedChainSlug === "__asian__" || selectedChainSlug === "asian") {
      return t.sports.nav.asian;
    }
    if (selectedChainSlug === "__live__" || selectedChainSlug === "live") {
      return t.sports.nav.live;
    }
    if (selectedChainSlug === "sports") {
      return t.common.nav.sports;
    }

    const fromParent = parentChildTags.find(
      (item) => item.slug === selectedChainSlug
    );
    if (fromParent?.name) return fromParent.name;

    const fromRoot = sportsRootTags.find(
      (item) => item.slug === selectedChainSlug
    );
    if (fromRoot?.name) return fromRoot.name;

    return undefined;
  }, [selectedChainSlug, parentChildTags, sportsRootTags, t]);

  const displayName = useMemo(() => {
    if (localizedDisplayName) return localizedDisplayName;
    if (tagName) return tagName;
    const last = chainSlugs[chainSlugs.length - 1] || tagSlug;
    if (!last) return "";
    return last.charAt(0).toUpperCase() + last.slice(1);
  }, [localizedDisplayName, tagName, chainSlugs, tagSlug]);

  // ==================== 交易区渲染（flag-on 时显示 To-B 下单面板，否则保留占位）====================
  const renderTradingArea = () => {
    if (selectedMarket && selectedEvent) {
      // 已结算：替换为蓝色 已结算 面板，不渲染交易表单
      if (selectedMarket.status === "RESOLVED") {
        return (
          <SportsResolvedPanel
            market={selectedMarket}
            allMoneylineMarkets={selectedEvent.market?.moneyline}
            t={t}
          />
        );
      }
      // 复用 market 详情页同款共享 TradingPanel —— 配套的 adapter useEffect
      // 已把 SportsMarketItem 转成 PolymarketMarketResp 形态推到 tradingStore，
      // SharedTradingPanel 仅靠 questionID 从 store 里读完整 market / event / outcome
      return (
        <div className="rounded-xl border border-(--border) bg-(--bg-card) overflow-hidden">
          <SharedTradingPanel questionID={selectedMarket.marketId} hideHeader />
        </div>
      );
    }
    return (
      <div className="text-xs text-(--text-tertiary) py-4 text-center">
        Trading disabled in embedded view
      </div>
    );
  };

  // ==================== 详情视图模式 ====================
  if (detailSlug) {
    return (
      <div className="flex gap-4">
        <div className="flex-1 min-w-0">
          <SportsEventDetailView
            eventSlug={detailSlug}
            onBack={handleBackFromDetail}
            tagName={displayName}
            onMarketSelect={handleDetailMarketSelect}
            selectedMarketId={selectedMarket?.marketId}
            selectedOutcomeIdx={selectedOutcomeIdx}
            onEventLoaded={handleEventLoaded}
          />
        </div>
        {/* 右侧交易面板 - 桌面端 */}
        <div className="w-80 shrink-0 hidden lg:block sticky top-[calc(120px+0.5rem)] self-start max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-hide">
          {selectedMarket && selectedEvent ? (
            <div className="rounded-lg border border-(--border) w-full shadow-sm">
              {/* 交易面板头部 */}
              <div className="p-4 border-b border-(--border)">
                <div className="flex items-center gap-2">
                  <ProxyImage
                    src={selectedEvent.icon || selectedEvent.image || ""}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                    fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSIxNiIgZmlsbD0iIzNhM2EzYSIvPjwvc3ZnPg=="
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-(--text-primary)">
                      {selectedEvent.title}
                    </div>
                    <div className="mt-1 flex items-center">
                      <div className="text-xs text-(--text-secondary) bg-(--bg-secondary) rounded-md px-2 py-0.5 truncate">
                        {selectedMarket.marketTitle}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {renderTradingArea()}
            </div>
          ) : (
            <div className="rounded-lg border border-(--border) p-8 text-center text-(--text-tertiary) text-sm">
              {t.sports.market.moneyline}
            </div>
          )}
        </div>

        {/* 移动端底部弹出交易面板 - 详情模式 */}
        {showMobileTrading && selectedMarket && selectedEvent && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowMobileTrading(false)}
            />
            <div className="absolute pb-14 bottom-0 left-0 right-0 bg-(--bg-card) rounded-t-2xl overflow-y-auto animate-slide-up max-h-[85vh]">
              <div className="flex justify-center py-3">
                <div className="w-10 h-1 bg-(--border) rounded-full" />
              </div>
              <button
                onClick={() => setShowMobileTrading(false)}
                className="absolute top-3 right-3 p-2 rounded-full hover:bg-(--bg-hover)"
              >
                <X size={20} className="text-(--text-secondary)" />
              </button>
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2 mb-2">
                  <ProxyImage
                    src={selectedEvent.icon || selectedEvent.image || ""}
                    alt=""
                    className="w-6 h-6 rounded-full object-cover"
                    fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSIxNiIgZmlsbD0iIzNhM2EzYSIvPjwvc3ZnPg=="
                  />
                  <div className="flex-1 min-w-0">
                    <div className="mt-1 flex items-center">
                      <div className="text-xs text-(--text-secondary) bg-(--bg-secondary) rounded-md px-2 py-0.5 truncate">
                        {selectedMarket.marketTitle}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {renderTradingArea()}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== 列表视图模式 ====================
  return (
    <div className={`flex gap-4 ${activeTab === "props" ? "" : ""}`}>
      {/* 左侧：主内容区 */}
      <div className="flex-1 min-w-0">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-(--text-primary)">
            {displayName}
          </h1>
          {/* <button className="p-2 rounded-lg hover:bg-(--bg-secondary) text-(--text-secondary)">
            <Settings className="w-5 h-5" />
          </button> */}
        </div>

        {/* Games / Props 标签 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-1 bg-(--bg-secondary) rounded-lg p-0.5">
            <button
              onClick={() => handleTabClick("games")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "games"
                  ? "bg-(--accent) text-black"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              {t.sports.tabs.games}
            </button>
            <button
              onClick={() => handleTabClick("props")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === "props"
                  ? "bg-(--accent) text-black"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              {t.sports.tabs.props}
            </button>
          </div>

          {/* <button className="p-2 rounded-lg hover:bg-(--bg-secondary) text-(--text-secondary)">
            <Search className="w-4 h-4" />
          </button> */}
        </div>

        {/* ==================== Games 视图 ==================== */}
        {activeTab === "games" && (
          <>
            {gamesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-(--accent)" />
              </div>
            ) : gamesEvents.length === 0 ? (
              <div className="text-center py-12 text-(--text-tertiary)">
                {t.sports.game.noEvents}
              </div>
            ) : (
              <div className="space-y-6">
                {groupedEvents.map((group) => (
                  <div key={group.date}>
                    {/* 日期分组标题 + 每组的 MONEYLINE/SPREAD/TOTAL 列头 */}
                    <div className="flex items-baseline justify-between mb-3">
                      <h3 className="text-base font-bold text-(--text-primary)">
                        {group.date}
                      </h3>
                      <div className="hidden md:flex items-center text-[10px] font-medium text-(--text-tertiary) uppercase tracking-wider">
                        <span className="w-28 text-center">
                          {t.sports.market.moneyline}
                        </span>
                        <span className="w-32 text-center ml-4">
                          {t.sports.market.spread}
                        </span>
                        <span className="w-28 text-center ml-4">
                          {t.sports.market.total}
                        </span>
                      </div>
                    </div>

                    {/* 赛事卡片列表 */}
                    <div className="space-y-3">
                      {group.events.map((ev) => (
                        <SportsEventCard
                          key={ev.id}
                          event={ev}
                          onOutcomeClick={(item, idx) =>
                            handleOutcomeClick(item, idx, ev)
                          }
                          onGameView={handleGameView}
                          selectedMarketId={selectedMarket?.marketId}
                          selectedOutcomeIdx={selectedOutcomeIdx}
                          isExpanded={expandedEventId === ev.id}
                          onToggle={() =>
                            setExpandedEventId((prev) =>
                              prev === ev.id ? null : ev.id
                            )
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* 加载更多 */}
                {gamesHasMore && (
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={gamesLoadMore}
                      disabled={gamesLoadingMore}
                      className="px-6 py-2 rounded-lg bg-(--bg-secondary) text-(--text-primary) hover:bg-(--bg-tertiary) transition-colors disabled:opacity-50 text-sm"
                    >
                      {gamesLoadingMore ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        t.market.common.loadMore
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 评论区：使用 event 级别的稳定 marketId，避免切换 market 时重新加载 */}
            {gamesEvents.length > 0 && (
              <div className="mt-8 border-t border-(--border) pt-6">
                <CommentSection
                  entityId={
                    selectedEvent?.market?.moneyline?.[0]?.marketId ||
                    selectedEvent?.id ||
                    gamesEvents[0]?.market?.moneyline?.[0]?.marketId ||
                    gamesEvents[0]?.id ||
                    tagSlug
                  }
                />
              </div>
            )}
          </>
        )}

        {/* ==================== Props 视图（无右侧交易面板） ==================== */}
        {activeTab === "props" && (
          <>
            {propsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-(--accent)" />
              </div>
            ) : (
              <>
                <MarketGrid
                  markets={propsMarkets}
                  columns={3}
                  loading={false}
                  emptyMessage={t.sports.game.noEvents}
                  onFavoriteChange={propsRefresh}
                />
                {propsHasMore && (
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={propsLoadMore}
                      disabled={propsLoadingMore}
                      className="px-6 py-2 rounded-lg bg-(--bg-secondary) text-(--text-primary) hover:bg-(--bg-tertiary) transition-colors disabled:opacity-50 text-sm"
                    >
                      {propsLoadingMore ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        t.market.common.loadMore
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* 右侧交易面板 - 仅 Games 视图桌面端显示 */}
      {activeTab === "games" && (
        <div className="w-80 shrink-0 hidden lg:block sticky top-[calc(120px+0.5rem)] self-start max-h-[calc(100vh-120px)] overflow-y-auto scrollbar-hide">
          {selectedMarket && selectedEvent ? (
            <div className="rounded-lg border border-(--border) w-full shadow-sm">
              {/* 交易面板头部 */}
              <div className="p-4 border-b border-(--border)">
                <div className="flex items-center gap-2">
                  <ProxyImage
                    src={selectedEvent.icon || selectedEvent.image || ""}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                    fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSIxNiIgZmlsbD0iIzNhM2EzYSIvPjwvc3ZnPg=="
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-(--text-primary)">
                      {selectedEvent.title}
                    </div>
                    <div className="mt-1 flex items-center">
                      <div className="text-xs text-(--text-secondary) bg-(--bg-secondary) rounded-md px-2 py-0.5 truncate">
                        {selectedMarket.marketTitle}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {renderTradingArea()}
            </div>
          ) : (
            <div className="rounded-lg border border-(--border) p-8 text-center text-(--text-tertiary) text-sm">
              {t.sports.market.moneyline}
            </div>
          )}
        </div>
      )}

      {/* 移动端底部弹出交易面板 */}
      {showMobileTrading && selectedMarket && selectedEvent && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileTrading(false)}
          />
          <div className="absolute pb-14 bottom-0 left-0 right-0 bg-(--bg-card) rounded-t-2xl overflow-y-auto animate-slide-up max-h-[85vh]">
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-(--border) rounded-full" />
            </div>
            <button
              onClick={() => setShowMobileTrading(false)}
              className="absolute top-3 right-3 p-2 rounded-full hover:bg-(--bg-hover)"
            >
              <X size={20} className="text-(--text-secondary)" />
            </button>
            <div className="px-4 pb-2">
              <div className="flex items-center gap-2 mb-2">
                <ProxyImage
                  src={selectedEvent.icon || selectedEvent.image || ""}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover"
                  fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSIxNiIgZmlsbD0iIzNhM2EzYSIvPjwvc3ZnPg=="
                />
                <div className="flex-1 min-w-0">
                  <div className="mt-1 flex items-center">
                    <div className="text-xs text-(--text-secondary) bg-(--bg-secondary) rounded-md px-2 py-0.5 truncate">
                      {selectedMarket.marketTitle}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {renderTradingArea()}
          </div>
        </div>
      )}
    </div>
  );
};

export default SportsGamesView;
