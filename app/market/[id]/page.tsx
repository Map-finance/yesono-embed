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
import LiveCountdown from "@/components/detail/LiveCountdown";
import {
  getEventBySlug,
  formatEndTime,
  getNeedTimeTagTags,
  getFinanceNeedTimeTagTags,
} from "@/lib/services/homeService";
import { formatNumber, formatDate } from "@/utils/format";
import { setLongTimeout } from "@/utils/timers";

import { ArrowLeft, Share2, Bookmark, Calendar, X, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { useTranslation, useLocale } from "@/lib/i18n";
import { useTradingStore } from "@/lib/store/tradingStore";
import ProxyImage from "@/components/common/ProxyImage";
import { favoriteEvent } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { isSportsEvent, buildSportsEventUrl } from "@/lib/utils/sportsNav";
import { trackEvent } from "@/lib/sentryClient";
import { getOutcomesByMarket, getBinaryOutcomeLabels } from "@/lib/utils/outcomes";
import { useSettlementResults } from "@/lib/hooks/useSettlementResults";
import { getSettlementDisplay } from "@/lib/utils/settlementResult";
import { useEventVolume } from "@/lib/hooks/useEventVolume";
import {
  getShortTermFrequencySlug,
  isShortTermFrequencySlug,
} from "@/lib/utils/eventFrequency";
import TradingPanel from "@/components/tob/TradingPanel";

const MarketChart = dynamic(() => import("@/components/detail/MarketChart"), {
  ssr: false,
});
const ShortTermOutcomeGraph = dynamic(
  () => import("@/components/detail/ShortTermOutcomeGraph"),
  { ssr: false }
);
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
  // 事件 tags 含 "finance" → 走 finance 的 need-time-tag-tags + WS objectivePrice 订阅
  const [isFinanceEvent, setIsFinanceEvent] = useState(false);
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

  // 实时交易量(按 eventId 拉,SWR 轮询),用于头部"💰 xxx Volume"展示;
  // 未就绪时回退到 event.volume 静态值,见下面 displayVolume。
  const { data: eventVolumeData } = useEventVolume(eventData?.id);

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
  // 倒计时的每秒刷新已抽到 <LiveCountdown/> 自持 state,避免每秒重渲染整页。
  useEffect(() => {
    // endDate 后端可能是字符串（"1796054399999"），显式 Number() 兜住
    const end = eventData?.endDate != null ? Number(eventData.endDate) : NaN;
    if (!Number.isFinite(end) || end <= 0) {
      setIsMarketEnded(false);
      return;
    }
    if (Date.now() >= end) {
      setIsMarketEnded(true);
      return;
    }
    setIsMarketEnded(false);
    // 超长延迟（>24.8 天）用 setLongTimeout 兜住原生 setTimeout 的 32 位溢出，
    // 否则远期市场会被立即误判为"已截止，等待结算"。
    return setLongTimeout(() => setIsMarketEnded(true), end - Date.now());
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
  // 短期市场识别:优先用 frequencySlug(已命中 needTimeTagTags 的 slug);
  // 若 frequencySlug 不是 \d+[mh] 或为空,兜底独立扫 tags(防后端 needTimeTagTags
  // 列表未收录新增的 "3m" 等导致漏判)
  const shortTermFrequencySlug = useMemo(() => {
    if (isShortTermFrequencySlug(frequencySlug)) return frequencySlug;
    return getShortTermFrequencySlug(eventData?.tags);
  }, [frequencySlug, eventData?.tags]);
  const isShortTermEvent = !!shortTermFrequencySlug;
  // 短期市场图取 eventMarkets[0] 的 YES outcome。同时收两类匹配候选:
  // - assetCandidates: tokenId / tradingPair(WS 推送的 trade.assetId 可能是其一)
  // - outcomeNames: outcome / outcomeKey / name(后端 /trades1/all 当前 assetId 多为 null,
  //   需要靠 trade.outcome 字符串匹配,如 "up" / "yes")
  const shortTermYesAssetCandidates = useMemo(() => {
    const first = eventData?.markets?.[0];
    const mos = (first as any)?.marketOutcomes as any[] | undefined;
    if (!Array.isArray(mos) || mos.length === 0) return [] as string[];
    const yes = mos.find((o) => Number(o?.originalIndex) === 0);
    return [yes?.tokenId, yes?.tradingPair].filter(Boolean).map((v) => String(v));
  }, [eventData?.markets]);
  const shortTermYesOutcomeNames = useMemo(() => {
    const first = eventData?.markets?.[0];
    const mos = (first as any)?.marketOutcomes as any[] | undefined;
    if (!Array.isArray(mos) || mos.length === 0) return [] as string[];
    const yes = mos.find((o) => Number(o?.originalIndex) === 0);
    return [yes?.outcome, yes?.outcomeKey, yes?.name]
      .filter(Boolean)
      .map((v) => String(v));
  }, [eventData?.markets]);
  // 标题/ tooltip 用 YES outcome 短名(如 "Up"),不是整段市场问题
  const shortTermLabel = useMemo(() => {
    const raw = shortTermYesOutcomeNames[0];
    if (!raw) return undefined;
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }, [shortTermYesOutcomeNames]);
  // 仅派生「是否显示倒计时」(低频:仅 endDate / isMarketEnded 变化时变);
  // 每秒刷新交给 <LiveCountdown/> 内部,不在本页重渲染。
  const showMobileLiveCountdown = Boolean(eventData?.endDate) && !isMarketEnded;

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

  // 选中市场对象：取真实 yes/no outcome 文案 + 实时判断结算状态
  const selectedMarketObj = useMemo(
    () =>
      eventData?.markets?.find(
        (m) => String(m.id) === String(selectedMarketInfo?.marketId)
      ),
    [eventData?.markets, selectedMarketInfo?.marketId]
  );
  // 结算状态以最新 eventData 为准：onMarketSelect 只在"切换市场"时上报，不会在
  // "选中市场原地结算"时重新触发，故这里从 selectedMarketObj 派生，保证截止后轮询
  // 刷新 eventData 后右侧面板能自动从交易面板翻成结算面板。
  const selectedIsResolved = useMemo(() => {
    if (selectedMarketInfo?.isResolved) return true;
    const m = selectedMarketObj as any;
    return m?.umaResolutionStatus === "RESOLVED" || m?.status === "RESOLVED";
  }, [selectedMarketInfo?.isResolved, selectedMarketObj]);

  // 已截止但未结算：展示"等待结算"中间态、禁止下单。
  // 以后端权威信号为准（closed / 停止接单）。endDate 到点只触发轮询刷新 eventData（见下方
  // 轮询 effect），拉到后端 closed=true 才翻"等待结算" —— 对齐 Polymarket：endDate 过了但
  // 后端未 closed 时仍可下单，不再用客户端 endDate 直接禁单。
  const selectedTradingEnded = useMemo(() => {
    if (selectedIsResolved) return false;
    const m = selectedMarketObj as any;
    return m?.closed === true || m?.acceptingOrders === false;
  }, [selectedIsResolved, selectedMarketObj]);

  // 选中市场已结算时拉结算结果（YES 侧赔付比例），用于右侧面板五态展示（与 OutcomeList 共享缓存）
  const selectedSettlements = useSettlementResults(
    selectedIsResolved && selectedMarketInfo?.marketId
      ? [selectedMarketInfo.marketId]
      : []
  );
  const selectedSettlementDisplay = useMemo(() => {
    if (!selectedIsResolved || !selectedMarketInfo) return null;
    const [yesLabel, noLabel] = getBinaryOutcomeLabels(selectedMarketObj, {
      yes: t.common.yes,
      no: t.common.no,
      up: t.common.up,
      down: t.common.down,
    });
    return getSettlementDisplay(
      selectedSettlements[String(selectedMarketInfo.marketId)],
      {
        yes: yesLabel,
        no: noLabel,
        halfWin: t.market.settlement.halfWin,
        halfLose: t.market.settlement.halfLose,
        push: t.market.settlement.push,
      }
    );
  }, [
    selectedIsResolved,
    selectedMarketInfo,
    selectedMarketObj,
    selectedSettlements,
    t.common,
    t.market.settlement,
  ]);

  // 截止后有限轮询刷新结算状态：isMarketEnded 到点触发，封顶 ~15min，
  // 仅当某 market 结算状态确有变化时才 setEventData（不碰选中/WS），避免打断用户操作。
  const statusSigRef = useRef<string>("");
  useEffect(() => {
    if (!isMarketEnded || selectedIsResolved) return;
    const id = params.id as string;
    if (!id) return;

    const sigOf = (markets?: PolymarketMarketResp[]) =>
      (markets || [])
        .map((m) => `${m.id}:${m.umaResolutionStatus}:${(m as any).closed ? 1 : 0}`)
        .join("|");

    let stopped = false;
    let tries = 0;
    const MAX_TRIES = 180; // ~15 分钟封顶（5s × 180）
    const INTERVAL_MS = 5000;
    statusSigRef.current = sigOf(eventData?.markets);

    const refresh = async () => {
      try {
        const resp = await getEventBySlug(id);
        if (stopped || !resp) return;
        const sig = sigOf(resp.markets);
        if (sig !== statusSigRef.current) {
          statusSigRef.current = sig;
          setEventData(resp);
        }
      } catch (e) {
        console.warn("[MarketPage] 结算状态轮询刷新失败", e);
      }
    };

    refresh(); // 到点先立刻补拉一次
    const timer = setInterval(() => {
      // 隐藏标签页:不发请求、不计数(可见时再轮询),省无效网络。
      if (typeof document !== "undefined" && document.hidden) return;
      tries += 1;
      if (tries >= MAX_TRIES) {
        clearInterval(timer);
        return;
      }
      refresh();
    }, INTERVAL_MS);

    // 切回可见:立即补拉一次,不必等下一个 5s 周期。
    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden) refresh();
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisible);
    }

    return () => {
      stopped = true;
      clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisible);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMarketEnded, selectedIsResolved, params.id]);

  // 市场结算 / 截止后，自动关闭已打开的移动端交易弹窗
  useEffect(() => {
    if ((selectedIsResolved || selectedTradingEnded) && showMobileTrading) {
      setShowMobileTrading(false);
    }
  }, [selectedIsResolved, selectedTradingEnded, showMobileTrading]);

  // 移动端点击 Buy Yes/No 时打开底部弹窗
  const handleMobileTrade = (outcomeIndex: number, side: "yes" | "no") => {
    // 已结算 / 已截止待结算的市场禁止下单（双保险：行内 Buy 按钮此时已隐藏）
    if (selectedIsResolved || selectedTradingEnded) return;
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
  const loadMarketRef = useRef<((force?: boolean) => Promise<void>) | undefined>(undefined);
  loadMarketRef.current = async (force = false) => {
    const id = params.id as string;
    // 防止并发加载
    if (isLoadingRef.current) return;
    // 防止同一 slug 重复加载（React Strict Mode / hydration 导致的多次 effect）
    if (!force && loadedSlugRef.current === id) return;

    isLoadingRef.current = true;
    try {
      setLoading(true);
      // 并行发起:event 详情 + 两套 time-tag-tags(homeService 内部各自有 TTL 缓存 +
      // in-flight 去重,首次访问会多预热一个接口,后续命中缓存几乎零成本)。
      // 串行改并行可省 200-500ms 首屏。
      const [eventResp, defaultTimeTagTags, financeTimeTagTags] = await Promise.all([
        getEventBySlug(id),
        getNeedTimeTagTags(),
        getFinanceNeedTimeTagTags(),
      ]);
      // 根据事件 tags 是否包含 finance 选择不同的 need-time-tag-tags 接口
      const financeFlag = !!eventResp?.tags?.some(
        (tag) => tag.slug === "finance"
      );
      setIsFinanceEvent(financeFlag);
      const timeTagTags = financeFlag ? financeTimeTagTags : defaultTimeTagTags;
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
      <div className="max-w-[1400px] mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="text-center text-(--text-secondary)">
          {t.common.notFound}
        </div>
      </div>
    );
  }

  // 头部"💰 xxx Volume"展示:优先使用 SWR 轮询拉到的实时交易量;
  // 未就绪 / 失败时回退到 market.volume(由 event.volume 派生的静态值)。
  const displayVolume =
    eventVolumeData?.volume != null
      ? `$${formatNumber(eventVolumeData.volume)}`
      : market.volume;

  return (
    <div className="max-w-[1400px] mx-auto px-3 py-4 lg:px-4 lg:py-6">
      {/* 返回按钮 */}
      {/* <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-(--text-secondary) hover:text-(--text-primary) mb-3 lg:mb-4 transition-colors"
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
              className="w-10 h-10 lg:w-12 lg:h-12 rounded-lg object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h1 className="text-base lg:text-xl font-semibold text-(--text-primary) mb-1 lg:mb-2 line-clamp-2">
                {market.title}
              </h1>
              <div className="flex items-center gap-3 lg:gap-4 text-xs lg:text-sm text-(--text-secondary) flex-wrap">
                <span className="flex items-center gap-1">
                  💰 {displayVolume} {t.common.volume}
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
              {showMobileLiveCountdown && eventData?.endDate != null && (
                <LiveCountdown
                  endDate={Number(eventData.endDate)}
                  labels={mobileCountdownLabels}
                />
              )}
              <button
                aria-label={t.common.share}
                title={t.common.share}
                className={`p-2 rounded-lg hover:bg-(--bg-hover) text-(--text-secondary) hover:text-(--text-primary) transition-colors ${
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
                className={`p-2 rounded-lg hover:bg-(--bg-hover) transition-colors ${
                  market.isFavorite
                    ? "text-(--accent)"
                    : "text-(--text-secondary) hover:text-(--text-primary)"
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
              <button className="px-3 py-1.5 rounded-lg text-sm bg-(--bg-secondary) text-(--text-secondary) hover:text-(--text-primary) transition-colors">
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
                        ? "bg-(--accent) text-(--text-inverse)"
                        : "bg-(--bg-secondary) text-(--text-secondary) hover:text-(--text-primary)"
                    }`}
                  >
                    {display}
                  </button>
                );
              })}
            </div>
          )} */}

          {/* 图表区域：两种图表均按需条件渲染，避免 display:none 导致 Recharts ResizeObserver 循环 */}
          {activeChart === "probability" &&
            (isShortTermEvent ? (
              <ShortTermOutcomeGraph
                eventId={eventData?.id}
                eventSlug={eventData?.slug}
                yesAssetCandidates={shortTermYesAssetCandidates}
                yesOutcomeNames={shortTermYesOutcomeNames}
                frequencySlug={shortTermFrequencySlug}
                endDateMs={eventData?.endDate}
                label={shortTermLabel}
                isVisible={true}
                isLive={!isMarketEnded}
              />
            ) : (
              <MarketChart
                market={market}
                eventMarkets={eventData?.markets}
                tags={eventData?.tags}
                eventEndDate={eventData?.endDate}
                liveMarketSlug={liveMarketSlug}
                isLive={!isMarketEnded}
              />
            ))}
          {activeChart === "price" && (
            <div className="mb-2">
              <LivePriceChart
                symbol={liveChartSymbol}
                eventSlug={eventData?.slug}
                eventId={eventData?.id}
                isFinance={isFinanceEvent}
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
                isFinance={isFinanceEvent}
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
            eventSlug={eventData?.slug}
            eventEnded={isMarketEnded}
            frequencySlug={shortTermFrequencySlug ?? frequencySlug}
            onMarketSelect={setSelectedMarketInfo}
          />

          {/* Market Context */}
          {/* <div className="mt-6 p-4 rounded-xl border border-(--border) bg-(--bg-card)">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-(--text-primary)">
                {t.market.marketContext}
              </h3>
              <button className="text-sm text-(--accent) hover:underline">
                {t.common.generate}
              </button>
            </div>
          </div> */}

          {/* Rules - 无 description（规则数据）则整块隐藏，避免空"规则"框 */}
          {eventData?.description && (
          <div className="mt-3 lg:mt-4 p-3 lg:p-4 rounded-xl border border-(--border) bg-(--bg-card)">
            <h3 className="text-sm lg:text-base font-medium text-(--text-primary) mb-1.5 lg:mb-2">
              {t.market.rules}
            </h3>
            <p
              className={
                "text-sm text-(--text-secondary) leading-relaxed" +
                (showFullDescription ? "" : " line-clamp-2")
              }
            >
              {eventData?.description}
            </p>
            {!showFullDescription && (
              <button
                className="mt-2 text-sm text-(--text-secondary) hover:text-(--text-primary) flex items-center gap-1"
                onClick={() => setShowFullDescription(true)}
              >
                {t.common.showMore} <span>▾</span>
              </button>
            )}
          </div>
          )}

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
        <div className="w-80 shrink-0 space-y-4 hidden lg:block sticky top-[calc(120px+1.5rem)] max-h-[calc(100vh-120px)] scrollbar-hide overflow-y-auto">
          {/* 已结算 → 五态结算卡片；已截止待结算 → 等待结算卡片；否则交易面板 */}
          {selectedIsResolved ? (
            <div className="p-6 rounded-xl border border-(--border) bg-(--bg-card) flex flex-col items-center">
              {/* 勾选图标（颜色随结算五态变化） */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{
                  backgroundColor:
                    selectedSettlementDisplay?.accent || "#3b82f6",
                }}
              >
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
              {/* Outcome 文字（优先用 settlement-result 五态结果） */}
              <div
                className="text-xl font-semibold mb-2 text-center"
                style={{
                  color: selectedSettlementDisplay?.accent || "#3b82f6",
                }}
              >
                {t.market.common.outcome}{" "}
                {selectedSettlementDisplay?.label ||
                  selectedMarketInfo?.resolvedOutcome ||
                  t.market.common.yes}
              </div>
              {/* 标题 */}
              <div className="text-sm text-(--text-secondary) text-center">
                {selectedMarketInfo?.title || selectedMarketObj?.question}
              </div>
            </div>
          ) : selectedTradingEnded ? (
            <div className="p-6 rounded-xl border border-(--border) bg-(--bg-card) flex flex-col items-center">
              {/* 时钟图标：已截止，等待结算结果 */}
              <div className="w-16 h-16 rounded-full bg-[rgba(107,114,128,0.15)] flex items-center justify-center mb-4">
                <Clock size={32} className="text-(--text-secondary)" />
              </div>
              <div className="text-lg font-semibold text-(--text-primary) mb-2 text-center">
                {t.market.settlement.awaiting}
              </div>
              <div className="text-sm text-(--text-secondary) text-center">
                {selectedMarketInfo?.title || selectedMarketObj?.question}
              </div>
            </div>
          ) : (
            (() => {
              const polyMarket =
                eventData?.markets?.find(
                  (m) => String(m.id) === String(selectedMarketInfo?.marketId)
                ) || eventData?.markets?.[0];
              return polyMarket ? (
                <TradingPanel
                  market={polyMarket}
                  eventId={selectedMarketInfo?.eventId || eventData?.id}
                />
              ) : null;
            })()
          )}

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
