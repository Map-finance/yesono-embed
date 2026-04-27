"use client";

/**
 * Market Detail Page - 市场详情页
 * 展示市场的详细信息、图表、选项和评论
 *
 * 注意：
 * - 该页面依赖多个仅浏览器可用的图表/交互模块。
 * - 在本地 dev 的 edge runtime 下会触发兼容性报错（例如 HTMLElement 未定义）。
 * - 开发阶段默认不显式声明 runtime；部署阶段由脚本临时注入 edge runtime。
 */

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Market } from "@/types/types";
import { PolymarketEventResp, PolymarketMarketResp } from "@/types/home";
import {
  getEventBySlug,
  formatEndTime,
  getNeedTimeTagTags,
} from "@/lib/services/homeService";
import { formatNumber, formatDate } from "@/utils/format";

import { ArrowLeft, Share2, Bookmark, Calendar, X } from "lucide-react";
import { useTranslation, useLocale } from "@/lib/i18n";
import { useTradingStore } from "@/lib/store/tradingStore";
import ProxyImage from "@/components/common/ProxyImage";
import { favoriteEvent } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { isSportsEvent, buildSportsEventUrl } from "@/lib/utils/sportsNav";
import { trackEvent } from "@/lib/sentryClient";
import { getOutcomesByMarket } from "@/lib/utils/outcomes";

const MarketChart = dynamic(() => import("@/components/detail/MarketChart"), {
  ssr: false,
});
const ChartToggleSwitch = dynamic(
  () => import("@/components/detail/ChartToggleSwitch"),
  { ssr: false }
);
const TimeCapsule = dynamic(() => import("@/components/detail/TimeCapsule"), {
  ssr: false,
});
const OutcomeList = dynamic(() => import("@/components/detail/OutcomeList"), {
  ssr: false,
});
const RelatedMarkets = dynamic(
  () => import("@/components/detail/RelatedMarkets"),
  { ssr: false }
);
const MarketDetailTabs = dynamic(
  () =>
    import("@/components/detail").then((mod) => ({
      default: mod.MarketDetailTabs,
    })),
  { ssr: false }
);
const LivePriceChart = dynamic(
  () => import("@/components/detail/LivePriceChart"),
  {
    ssr: false,
  }
);

const DATE_FILTERS = ["2026-01-28", "2026-03-18", "2026-04-29"];
const COIN_ALIAS: Record<string, string> = {
  bitcoin: "btc",
  ethereum: "eth",
  solana: "sol",
  ripple: "xrp",
};

const DEFAULT_LIVE_COUNTDOWN_LABELS = {
  days: "Days",
  hours: "Hours",
  minutes: "Mins",
  seconds: "Secs",
};

export default function MarketDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  // 控制 description 显示更多
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [market, setMarket] = useState<Market | null>(null);
  const [eventData, setEventData] = useState<PolymarketEventResp | null>(null);
  const [needTimeTagTags, setNeedTimeTagTags] = useState<string[]>([]);
  // 使用精准 selector 订阅 tradingStore，避免 orderBookRaw 高频更新时整个详情页重渲染
  const selectedMarket = useTradingStore((s) => s.market);
  const setSelectedMarket = useTradingStore((s) => s.setMarket);
  const setSelectedEvent = useTradingStore((s) => s.setEvent);
  const [loading, setLoading] = useState(true);
  const [selectedDateFilter, setSelectedDateFilter] =
    useState<string>("2026-01-28");
  const [showMobileTrading, setShowMobileTrading] = useState(false);
  const [mobileTradeType, setMobileTradeType] = useState<"yes" | "no">("yes");
  const [activeChartState, setActiveChartState] = useState<
    "probability" | "price"
  >("price");

  // 切换市场时重置用户选择，确保下一个市场默认仍然优先尝试展示 Price Chart
  // 同时重置 isPriceChartSupported，允许新市场重新向 WS 发起探测
  const [isPriceChartSupported, setIsPriceChartSupported] = useState(true);
  useEffect(() => {
    setActiveChartState("price");
    setIsPriceChartSupported(true);
  }, [params.id]);

  // isMarketEnded 是只变化一次的布尔值，用精确 setTimeout 触发，避免每秒 setInterval 导致整页重渲染
  const [isMarketEnded, setIsMarketEnded] = useState(false);
  // TimeCapsule 中计算出的当前 LIVE 市场 slug，用于 LivePriceHeader 的"Go to live market"跳转
  const [liveMarketSlug, setLiveMarketSlug] = useState("");
  const [mobileLiveCountdown, setMobileLiveCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  useEffect(() => {
    const end = eventData?.endDate;
    if (!end) {
      setIsMarketEnded(false);
      return;
    }
    if (Date.now() >= end) {
      setIsMarketEnded(true);
      return;
    }
    setIsMarketEnded(false);
    const delay = end - Date.now();
    const timer = setTimeout(() => setIsMarketEnded(true), delay);
    return () => clearTimeout(timer);
  }, [eventData?.endDate]);

  // 判断是否应该显示“Live Price Chart”选项 (只对包含了特定时间周期的事件开放)
  const showPriceChartOption = useMemo(() => {
    if (!isPriceChartSupported) return false;
    if (!eventData?.tags || needTimeTagTags.length === 0) return false;
    return eventData.tags.some((tag) => needTimeTagTags.includes(tag.slug));
  }, [eventData?.tags, isPriceChartSupported, needTimeTagTags]);

  // 当前市场的频率标签（如 "5m"、"1h"），用于计算 Price to beat 时间偏移
  const frequencySlug = useMemo(() => {
    if (!eventData?.tags || needTimeTagTags.length === 0) return undefined;
    return eventData?.tags?.find((tag) => needTimeTagTags.includes(tag.slug))
      ?.slug;
  }, [eventData?.tags, needTimeTagTags]);
  const showMobileLiveCountdown = Boolean(eventData?.endDate) && !isMarketEnded;

  useEffect(() => {
    const end = eventData?.endDate;
    if (!showMobileLiveCountdown || !end) {
      setMobileLiveCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const updateCountdown = () => {
      const diff = end - Date.now();
      if (diff <= 0) {
        setMobileLiveCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setMobileLiveCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [eventData?.endDate, showMobileLiveCountdown]);

  // 派生状态：如果用户（或默认）选择了 price，但不具备显示条件，则强制使用 probability
  const activeChart =
    activeChartState === "price" && !showPriceChartOption
      ? "probability"
      : activeChartState;

  // slug 前缀别名修正表：仅处理与标准 ticker 不一致的前缀
  // 新增币种时若 slug 前缀与 ticker 一致（如 doge、link、matic）则无需修改此处
  const liveChartSymbol = useMemo(() => {
    const slug = market?.slug?.toLowerCase() || "";
    const prefix = slug.split("-")[0]; // 取 slug 第一段作为币种标识
    const coin = COIN_ALIAS[prefix] ?? prefix;
    return `${coin}/usd`;
  }, [market?.slug]);

  // 当前选中 market 的状态
  const [selectedMarketInfo, setSelectedMarketInfo] = useState<{
    isResolved: boolean;
    resolvedOutcome?: string;
    title: string;
    percentage?: number;
    icon?: string;
    marketId: string;
    questionID: string;
    eventId?: string;
  } | null>(null);

  const { locale } = useLocale();
  const mobileCountdownLabels =
    (t.market as any).livePriceHeader?.countdown ??
    DEFAULT_LIVE_COUNTDOWN_LABELS;

  // 移动端点击 Buy Yes/No 时打开底部弹窗
  const handleMobileTrade = (outcomeIndex: number, side: "yes" | "no") => {
    setMobileTradeType(side);
    setShowMobileTrading(true);
  };

  // 解析市场的 outcomes 和 outcomePrices
  const parseMarketOutcomes = (market: PolymarketMarketResp) => {
    try {
      const outcomes = getOutcomesByMarket(market);
      const prices = JSON.parse(market.outcomePrices || "[]") as number[];
      return outcomes.map((name, idx) => ({
        name,
        price: prices[idx] || 0,
      }));
    } catch (e) {
      console.warn("[MarketPage] Failed to parse market outcomes", e);
      return [];
    }
  };

  // 将 PolymarketEventResp 转换为 Market 类型
  const convertEventToMarket = (event: PolymarketEventResp): Market => {
    const firstMarket = event.markets?.[0];
    const outcomes = firstMarket ? parseMarketOutcomes(firstMarket) : [];

    return {
      id: event.id,
      slug: event.slug,
      icon: event.icon || event.image || "",
      title: event.title,
      options: outcomes.map((o) => ({
        label: o.name,
        percentage: o.price * 100,
        change: 0,
      })),
      date: event.endDate ? formatEndTime(event.endDate) : undefined,
      volume: `$${formatNumber(event.volume || 0)}`,
      isLive: event.active && !event.closed,
      isFavorite: event.favorite,
    };
  };

  // 加载市场数据（使用多重 guard 防止重复加载）
  const isLoadingRef = useRef(false); // 防止并发加载
  const loadedSlugRef = useRef<string | null>(null); // 记录已成功加载的 slug
  const loadMarketRef = useRef<(force?: boolean) => Promise<void>>();
  loadMarketRef.current = async (force = false) => {
    const id = params.id as string;
    // 防止并发加载
    if (isLoadingRef.current) return;
    // 防止同一 slug 重复加载（React Strict Mode / hydration 导致的多次 effect）
    if (!force && loadedSlugRef.current === id) return;

    isLoadingRef.current = true;
    try {
      setLoading(true);
      const [eventResp, timeTagTags] = await Promise.all([
        getEventBySlug(id),
        getNeedTimeTagTags(),
      ]);
      setNeedTimeTagTags(timeTagTags);

      if (eventResp) {
        // 体育市场自动跳转到比赛视图页面
        if (isSportsEvent(eventResp.tags)) {
          router.replace(
            buildSportsEventUrl(eventResp.slug || id, eventResp.tags)
          );
          return;
        }
        setEventData(eventResp);
        setSelectedEvent(eventResp);
        // 选中第一个市场
        if (eventResp.markets?.length > 0) {
          setSelectedMarket(eventResp.markets[0]);
        }
        // 转换为 Market 类型给现有组件使用
        const convertedMarket = convertEventToMarket(eventResp);
        setMarket(convertedMarket);
        loadedSlugRef.current = id; // 标记已成功加载
      }
    } catch (error) {
      console.error("Error loading market:", error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  // 页面首次加载 & params.id 或 locale 变化时加载数据（不依赖 isAuthenticated）
  useEffect(() => {
    loadMarketRef.current?.(true);
  }, [params.id, locale]);

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!market) return;

    try {
      const newFavoriteStatus = !market.isFavorite;

      // 乐观更新 UI
      setMarket((prev) =>
        prev ? { ...prev, isFavorite: newFavoriteStatus } : null
      );

      const res = await favoriteEvent({
        slug: market.slug || market.id,
        isFavorite: newFavoriteStatus,
      });
      if (res.success) {
        toast.success(
          newFavoriteStatus
            ? t.common.addedToFavorites
            : t.common.removedFromFavorites
        );
      } else {
        // 回滚 UI
        setMarket((prev) =>
          prev ? { ...prev, isFavorite: !newFavoriteStatus } : null
        );
        toast.error(res.msg || t.common.operationFailed);
      }
    } catch (error) {
      console.error("Favorite action failed:", error);
      // 回滚 UI
      setMarket((prev) =>
        prev ? { ...prev, isFavorite: !market.isFavorite } : null
      );
      toast.error(t.common.operationFailed);
    }
  };

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-[var(--bg-secondary)] rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-[var(--bg-secondary)] rounded mb-4"></div>
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="text-center text-[var(--text-secondary)]">
          {t.common.notFound}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-3 py-4 lg:px-4 lg:py-6">
      {/* 返回按钮 */}
      {/* <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-3 lg:mb-4 transition-colors"
      >
        <ArrowLeft size={18} className="lg:w-5 lg:h-5" />
        <span className="text-sm lg:text-base">{t.common.back}</span>
      </button> */}

      <div className="flex gap-6 items-start">
        {/* 左侧主内容 */}
        <div className="flex-1 min-w-0">
          {/* 标题区域 */}
          <div className="flex items-start gap-3 lg:gap-4 mb-4 lg:mb-6">
            <ProxyImage
              src={market.icon}
              fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIGZpbGw9IiMyYTJhMmEiLz48L3N2Zz4="
              alt=""
              className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-base lg:text-xl font-semibold text-[var(--text-primary)] mb-1 lg:mb-2 line-clamp-2">
                {market.title}
              </h1>
              <div className="flex items-center gap-3 lg:gap-4 text-xs lg:text-sm text-[var(--text-secondary)] flex-wrap">
                <span className="flex items-center gap-1">
                  💰 {market.volume} {t.common.volume}
                </span>
                {market.endDate && (
                  <span className="flex items-center gap-1">
                    <Calendar size={14} />
                    {new Date(market.endDate * 1000).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {showMobileLiveCountdown && (
                <div className="sm:hidden flex items-center gap-2">
                  {mobileLiveCountdown.days > 0 && (
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-bold text-[#FF453A] leading-none mb-1 tabular-nums">
                        {String(mobileLiveCountdown.days).padStart(2, "0")}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">
                        {mobileCountdownLabels.days}
                      </span>
                    </div>
                  )}
                  {mobileLiveCountdown.hours > 0 && (
                    <div className="flex flex-col items-center">
                      <span className="text-3xl font-bold text-[#FF453A] leading-none mb-1 tabular-nums">
                        {String(mobileLiveCountdown.hours).padStart(2, "0")}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">
                        {mobileCountdownLabels.hours}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-bold text-[#FF453A] leading-none mb-1 tabular-nums">
                      {String(mobileLiveCountdown.minutes).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">
                      {mobileCountdownLabels.minutes}
                    </span>
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-3xl font-bold text-[#FF453A] leading-none mb-1 tabular-nums">
                      {String(mobileLiveCountdown.seconds).padStart(2, "0")}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">
                      {mobileCountdownLabels.seconds}
                    </span>
                  </div>
                </div>
              )}
              <button
                aria-label={t.common.share}
                title={t.common.share}
                className={`p-2 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ${
                  showMobileLiveCountdown ? "hidden sm:inline-flex" : ""
                }`}
                onClick={() => {
                  trackEvent("market_share_click", {
                    event_id: market.id,
                    event_title: market.title,
                    channel: "copy_link",
                  });
                  navigator.clipboard
                    .writeText(window.location.href)
                    .then(() => {
                      toast.success(t.common.linkCopied);
                    })
                    .catch(() => {
                      toast.error(t.common.operationFailed);
                    });
                }}
              >
                <Share2 size={20} />
              </button>
              <button
                aria-label={t.common.bookmark}
                title={t.common.bookmark}
                onClick={handleFavoriteClick}
                className={`p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors ${
                  market.isFavorite
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                } ${showMobileLiveCountdown ? "hidden sm:inline-flex" : ""}`}
              >
                <Bookmark
                  size={20}
                  fill={market.isFavorite ? "currentColor" : "none"}
                />
              </button>
            </div>
          </div>

          {/* 日期过滤器（仅 probability 模式下展示） */}
          {/* {activeChart === "probability" && (
            <div className="flex items-center gap-2 mb-4">
              <button className="px-3 py-1.5 rounded-lg text-sm bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                {t.market.past} ▾
              </button>
              {DATE_FILTERS.map((date) => {
                const display = formatDate(
                  date,
                  locale === "zh-CN" || locale === "zh-TW" ? "zh-CN" : "en-US",
                  { month: "short", day: "numeric", year: "numeric" }
                );
                const longDisplay = formatDate(
                  date,
                  locale === "zh-CN" || locale === "zh-TW" ? "zh-CN" : "en-US",
                  { year: "numeric", month: "long", day: "numeric" }
                );
                return (
                  <button
                    key={date}
                    onClick={() => setSelectedDateFilter(date)}
                    aria-pressed={selectedDateFilter === date}
                    title={longDisplay}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      selectedDateFilter === date
                        ? "bg-[var(--accent)] text-[var(--text-inverse)]"
                        : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {display}
                  </button>
                );
              })}
            </div>
          )} */}

          {/* 图表区域：两种图表均按需条件渲染，避免 display:none 导致 Recharts ResizeObserver 循环 */}
          {activeChart === "probability" && (
            <MarketChart
              market={market}
              eventMarkets={eventData?.markets}
              tags={eventData?.tags}
              eventEndDate={eventData?.endDate}
            />
          )}
          {activeChart === "price" && (
            <div className="mb-2">
              <LivePriceChart
                symbol={liveChartSymbol}
                eventSlug={eventData?.slug}
                height={350}
                isLive={!isMarketEnded}
                endDate={eventData?.endDate}
                frequencySlug={frequencySlug}
                liveMarketSlug={liveMarketSlug}
                onUnsupported={() => {
                  setIsPriceChartSupported(false);
                  setActiveChartState("probability");
                }}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between mt-3 mb-4 lg:mt-4 lg:mb-6 relative z-10">
            <div className="w-full sm:w-auto min-w-0 relative z-10">
              <TimeCapsule
                tags={eventData?.tags}
                eventEndDate={eventData?.endDate}
                needTimeTagTags={needTimeTagTags}
                onLiveSlugChange={setLiveMarketSlug}
              />
            </div>
            {showPriceChartOption && (
              <div className="absolute left-0 bottom-[calc(100%+8px)] sm:bottom-auto sm:left-auto sm:relative z-20">
                <ChartToggleSwitch
                  activeChart={activeChart}
                  onChange={setActiveChartState}
                  symbol={liveChartSymbol}
                />
              </div>
            )}
          </div>

          {/* 选项列表 - 使用 event 的 markets 数据 */}
          <OutcomeList
            market={market}
            onMobileTrade={handleMobileTrade}
            eventMarkets={eventData?.markets}
            onMarketSelect={setSelectedMarketInfo}
          />

          {/* Market Context */}
          {/* <div className="mt-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-[var(--text-primary)]">
                {t.market.marketContext}
              </h3>
              <button className="text-sm text-[var(--accent)] hover:underline">
                {t.common.generate}
              </button>
            </div>
          </div> */}

          {/* Rules */}
          <div className="mt-3 lg:mt-4 p-3 lg:p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
            <h3 className="text-sm lg:text-base font-medium text-[var(--text-primary)] mb-1.5 lg:mb-2">
              {t.market.rules}
            </h3>
            <p
              className={
                "text-sm text-[var(--text-secondary)] leading-relaxed" +
                (showFullDescription ? "" : " line-clamp-2")
              }
            >
              {eventData?.description}
            </p>
            {!showFullDescription && (
              <button
                className="mt-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
                onClick={() => setShowFullDescription(true)}
              >
                {t.common.showMore} <span>▾</span>
              </button>
            )}
          </div>

          {/* 评论区 */}
          <MarketDetailTabs
            marketId={market.id}
            unionKey={eventData?.slug || market.id}
            eventSlug={eventData?.slug || market.id}
            eventId={selectedMarketInfo?.eventId || eventData?.id}
            markets={eventData?.markets || []}
            selectedMarketId={selectedMarketInfo?.marketId}
          />
        </div>

        {/* 右侧面板 - 移动端隐藏 */}
        <div className="w-80 flex-shrink-0 space-y-4 hidden lg:block sticky top-[calc(120px+1.5rem)] max-h-[calc(100vh-120px)] scrollbar-hide overflow-y-auto">
          {/* 已解决市场显示 Outcome 卡片，未解决显示交易面板 */}
          {selectedMarketInfo?.isResolved ? (
            <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex flex-col items-center">
              {/* 勾选图标 */}
              <div className="w-16 h-16 rounded-full bg-[#3b82f6] flex items-center justify-center mb-4">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              {/* Outcome 文字 */}
              <div className="text-xl font-semibold text-[#3b82f6] mb-2">
                {t.market.common.outcome}{" "}
                {selectedMarketInfo.resolvedOutcome || t.market.common.yes}
              </div>
              {/* 标题 */}
              <div className="text-sm text-[var(--text-secondary)] text-center">
                {selectedMarketInfo.title}
              </div>
            </div>
          ) : null}

          {/* 相关市场 */}
          <RelatedMarkets
            currentMarketId={market.id}
            marketTitle={market.title}
          />
        </div>
      </div>
    </div>
  );
}
