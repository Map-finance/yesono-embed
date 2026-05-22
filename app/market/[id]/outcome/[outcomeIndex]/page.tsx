"use client";

/**
 * Outcome Detail Page - 移动端 Outcome 详情页。
 * 对齐 /market/{slug} 页面功能：真实 Rules、Comments/Holders/Activity、ChartToggleSwitch、底部 buy 按钮。
 *
 * 大块逻辑已拆出：
 *   - OutcomeProbabilityChart.tsx  概率折线图（含 tooltip / cursor / 时间范围选择器）
 *   - OutcomeMobileCountdown.tsx   移动端 live 倒计时
 *   - OutcomeBottomBuyBar.tsx      底部固定 Buy 按钮
 *   - outcomePage.helpers.ts       UITimeRange / mapToApiRange / COIN_ALIAS / 倒计时默认文案
 */

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Market } from "@/types/types";

import {
  getEventBySlug,
  getNeedTimeTagTags,
  getFinanceNeedTimeTagTags,
} from "@/lib/services/homeService";
import { polymarketEventToMarket } from "@/lib/utils/eventToMarket";
import { PolymarketEventResp, PolymarketMarketResp } from "@/types/home";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import SpotOrderbook from "@/components/detail/SpotOrderbook";
import MarketDetailTabs from "@/components/detail/MarketDetailTabs";
import ProxyImage from "@/components/common/ProxyImage";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { useSingleMarketPriceHistory } from "@/lib/hooks/usePriceHistory";
import { formatNumber, fillEvenSplitWhenAllZero } from "@/utils/format";
import { useTranslation } from "@/lib/i18n";
import {
  getOutcomeLabel,
  getOutcomesByMarket,
  normalizeBinaryOutcomeLabel,
  sortOutcomesByOriginalIndex,
} from "@/lib/utils/outcomes";
import dynamic from "next/dynamic";
import { useToast } from "@/components/ui/Toast";
import { useSettlementResults } from "@/lib/hooks/useSettlementResults";
import { getSettlementDisplay } from "@/lib/utils/settlementResult";
import {
  COIN_ALIAS,
  DEFAULT_LIVE_COUNTDOWN_LABELS,
  mapToApiRange,
  type UITimeRange,
} from "./outcomePage.helpers";
import OutcomeProbabilityChart from "./OutcomeProbabilityChart";
import OutcomeMobileCountdown from "./OutcomeMobileCountdown";
import OutcomeBottomBuyBar from "./OutcomeBottomBuyBar";

const ChartToggleSwitch = dynamic(
  () => import("@/components/detail/ChartToggleSwitch"),
  { ssr: false }
);
const LivePriceChart = dynamic(
  () => import("@/components/detail/LivePriceChart"),
  { ssr: false }
);
const TimeCapsule = dynamic(() => import("@/components/detail/TimeCapsule"), {
  ssr: false,
});

export default function OutcomeDetailPage() {
  const { t } = useTranslation();
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const [market, setMarket] = useState<Market | null>(null);
  const [eventData, setEventData] = useState<PolymarketEventResp | null>(null);
  const [eventMarket, setEventMarket] = useState<PolymarketMarketResp | null>(
    null
  );
  const [allMarkets, setAllMarkets] = useState<PolymarketMarketResp[]>([]);
  const [realEventSlug, setRealEventSlug] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<UITimeRange>("1D");
  const [orderBookExpanded, setOrderBookExpanded] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showMobileTrading, setShowMobileTrading] = useState(false);
  const [needTimeTagTags, setNeedTimeTagTags] = useState<string[]>([]);
  // 事件 tags 含 "finance" → 走 finance need-time-tag-tags + WS objectivePrice 订阅
  const [isFinanceEvent, setIsFinanceEvent] = useState(false);
  const [isMarketEnded, setIsMarketEnded] = useState(false);
  const [liveMarketSlug, setLiveMarketSlug] = useState("");
  const [mobileLiveCountdown, setMobileLiveCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  // Chart toggle state (对齐 market page)
  const [activeChartState, setActiveChartState] = useState<
    "probability" | "price"
  >("price");
  const [isPriceChartSupported, setIsPriceChartSupported] = useState(true);

  const marketId = params.id as string;
  const outcomeIndex = parseInt(params.outcomeIndex as string, 10);

  const mobileCountdownLabels =
    (t.market as any).livePriceHeader?.countdown ??
    DEFAULT_LIVE_COUNTDOWN_LABELS;

  useEffect(() => {
    const loadMarket = async () => {
      try {
        setLoading(true);
        const data = await getEventBySlug(marketId);
        const financeFlag = !!data?.tags?.some(
          (tag) => tag.slug === "finance"
        );
        setIsFinanceEvent(financeFlag);
        const timeTagTags = await (financeFlag
          ? getFinanceNeedTimeTagTags()
          : getNeedTimeTagTags());
        setNeedTimeTagTags(timeTagTags);
        if (data) {
          const convertedMarket = polymarketEventToMarket(data);
          setMarket(convertedMarket);
          setEventData(data);
          if (data.slug) setRealEventSlug(String(data.slug));
          if (data.markets) setAllMarkets(data.markets);
          if (data.markets && data.markets.length > outcomeIndex) {
            const em = data.markets[outcomeIndex];
            setEventMarket(em);
          }
        } else {
          // API 返回 null - 接受失败的䮤丛，正常情况下 market 会保持 null，最后指不到改渲查提示
        }
      } catch (error) {
        console.error("Error loading market:", error);
      } finally {
        setLoading(false);
      }
    };
    loadMarket();
  }, [marketId, outcomeIndex]);

  useEffect(() => {
    setActiveChartState("price");
    setIsPriceChartSupported(true);
    setOrderBookExpanded(false);
    setShowMobileTrading(false);
    setLiveMarketSlug("");
  }, [marketId, outcomeIndex]);

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

  const option = market?.options[outcomeIndex];
  const percentage = option?.percentage || 50;

  // Chart data
  const effectiveMarketId = eventMarket ? String(eventMarket.id) : "";
  const {
    data: apiData,
    loading: chartLoading,
  } = useSingleMarketPriceHistory(
    effectiveMarketId,
    mapToApiRange(selectedRange),
    !!eventMarket
  );

  const chartData = useMemo(() => {
    if (!apiData || apiData.length === 0) return [];
    return apiData.map((point) => ({
      date: point.date,
      timestamp: point.timestamp,
      value: (point[effectiveMarketId] as number) || 0,
    }));
  }, [apiData, effectiveMarketId]);

  const realVolume = eventMarket?.volume || 0;

  // 判断当前 outcome/market 是否已解决（与外层 app/market/[id]/page.tsx 保持一致：只用 umaResolutionStatus/status 判断）
  const { isResolved, resolvedOutcome } = useMemo(() => {
    const m = eventMarket as any;
    const resolved =
      m?.umaResolutionStatus === "RESOLVED" || m?.status === "RESOLVED";
    let winner: string | undefined;
    if (resolved) {
      try {
        const outcomes = getOutcomesByMarket(m);
        const prices = JSON.parse(m?.outcomePrices || "[]") as number[];
        const winnerIndex = prices.findIndex((p) => Number(p) >= 0.99);
        if (winnerIndex >= 0) {
          winner = outcomes[winnerIndex];
        } else if (outcomes.length > 0) {
          // 价格未更新为 1/0 时，取价格最高的 outcome 作为 fallback
          let maxIdx = 0;
          for (let i = 1; i < prices.length; i++) {
            if (Number(prices[i]) > Number(prices[maxIdx])) maxIdx = i;
          }
          winner = outcomes[maxIdx];
        }
      } catch {}
    }
    return { isResolved: resolved, resolvedOutcome: winner };
  }, [eventMarket]);

  // 使用 outcomePrices 获取真实价格，而不是 percentage (默认 50)
  const [yesPrice, noPrice] = useMemo(() => {
    try {
      const prices = JSON.parse(
        (eventMarket as any)?.outcomePrices || "[]"
      ) as number[];
      // 无盘口/价格全 0 时按 50/50 均分展示（与 TradingPanel/OutcomeList 一致），
      // 否则 buy 按钮会显示成误导性的 0¢
      const [yesFilled, noFilled] = fillEvenSplitWhenAllZero([
        prices[0],
        prices[1],
      ]);
      const yes = yesFilled != null ? Math.round(yesFilled * 100) : 0;
      const no =
        noFilled != null
          ? Math.round(noFilled * 100)
          : yes > 0
            ? 100 - yes
            : 0;
      return [`${yes}¢`, `${no}¢`];
    } catch (e) {
      console.error("[OutcomeDetailPage] Failed to parse outcome prices", e);
      return ["0¢", "0¢"];
    }
  }, [eventMarket]);

  const [yesLabel, noLabel] = useMemo(() => {
    const outcomesRaw: any = (eventMarket as any)?.marketOutcomes;
    const outcomes = Array.isArray(outcomesRaw)
      ? outcomesRaw
      : typeof outcomesRaw === "string"
        ? (() => {
            try {
              return JSON.parse(outcomesRaw);
            } catch (e) {
              console.error(
                "[OutcomeDetailPage] Failed to parse marketOutcomes",
                e
              );
              return [];
            }
          })()
        : [];
    const sorted = sortOutcomesByOriginalIndex(outcomes);
    if (sorted.length >= 2) {
      const label0 = getOutcomeLabel(sorted[0]);
      const label1 = getOutcomeLabel(sorted[1]);
      return [
        normalizeBinaryOutcomeLabel(label0, t.common.yes, {
          yes: t.common.yes,
          no: t.common.no,
          up: t.common.up,
          down: t.common.down,
        }),
        normalizeBinaryOutcomeLabel(label1, t.common.no, {
          yes: t.common.yes,
          no: t.common.no,
          up: t.common.up,
          down: t.common.down,
        }),
      ];
    }
    return [t.common.yes, t.common.no];
  }, [eventMarket, t.common.yes, t.common.no, t.common.up, t.common.down]);

  // Price chart support (对齐 market page 逻辑)
  const showPriceChartOption = useMemo(() => {
    if (!isPriceChartSupported) return false;
    if (!eventData?.tags || needTimeTagTags.length === 0) return false;
    return eventData.tags.some((tag) => needTimeTagTags.includes(tag.slug));
  }, [eventData?.tags, isPriceChartSupported, needTimeTagTags]);

  const activeChart =
    activeChartState === "price" && !showPriceChartOption
      ? "probability"
      : activeChartState;
  const frequencySlug = useMemo(() => {
    if (!eventData?.tags || needTimeTagTags.length === 0) return undefined;
    return eventData.tags.find((tag) => needTimeTagTags.includes(tag.slug))
      ?.slug;
  }, [eventData?.tags, needTimeTagTags]);

  const liveChartSymbol = useMemo(() => {
    const slug = market?.slug?.toLowerCase() || "";
    const prefix = slug.split("-")[0];
    const coin = COIN_ALIAS[prefix] ?? prefix;
    return `${coin}/usd`;
  }, [market?.slug]);

  // Bottom buy button handlers
  // 已结算时拉结算结果（YES 侧赔付比例），用于底部五态徽标（与列表页共享缓存）
  const settlementResults = useSettlementResults(
    isResolved ? [(eventMarket as any)?.id] : []
  );
  const settlementDisplay = useMemo(() => {
    if (!isResolved) return null;
    return getSettlementDisplay(
      settlementResults[String((eventMarket as any)?.id)],
      {
        yes: yesLabel,
        no: noLabel,
        halfWin: t.market.settlement.halfWin,
        halfLose: t.market.settlement.halfLose,
        push: t.market.settlement.push,
      }
    );
  }, [isResolved, settlementResults, eventMarket, yesLabel, noLabel, t.market.settlement]);

  // 已截止但未结算：展示"等待结算"中间态、禁止下单
  const tradingEnded = useMemo(() => {
    if (isResolved) return false;
    if (isMarketEnded) return true;
    const m = eventMarket as any;
    return m?.closed === true || m?.acceptingOrders === false;
  }, [isResolved, isMarketEnded, eventMarket]);

  // 截止后有限轮询刷新结算状态（与主详情页同款）：到点触发，封顶 ~15min，
  // 仅当本 market 结算状态确有变化时才更新。
  const statusSigRef = useRef<string>("");
  useEffect(() => {
    if (!isMarketEnded || isResolved || !marketId) return;

    const sigOf = (m?: PolymarketMarketResp | null) =>
      m ? `${m.id}:${m.umaResolutionStatus}:${(m as any).closed ? 1 : 0}` : "";

    let stopped = false;
    let tries = 0;
    const MAX_TRIES = 45; // ~15 分钟封顶
    const INTERVAL_MS = 20000;
    statusSigRef.current = sigOf(eventMarket);

    const refresh = async () => {
      try {
        const data = await getEventBySlug(marketId);
        if (stopped || !data) return;
        const em = data.markets?.[outcomeIndex] ?? null;
        const sig = sigOf(em);
        if (sig !== statusSigRef.current) {
          statusSigRef.current = sig;
          setEventData(data);
          if (data.markets) setAllMarkets(data.markets);
          if (em) setEventMarket(em);
        }
      } catch (e) {
        console.warn("[OutcomeDetailPage] 结算状态轮询刷新失败", e);
      }
    };

    refresh();
    const timer = setInterval(() => {
      tries += 1;
      if (tries >= MAX_TRIES) {
        clearInterval(timer);
        return;
      }
      refresh();
    }, INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMarketEnded, isResolved, marketId, outcomeIndex]);

  // 市场结算 / 截止后，自动关闭已打开的移动端交易弹窗
  useEffect(() => {
    if ((isResolved || tradingEnded) && showMobileTrading) {
      setShowMobileTrading(false);
    }
  }, [isResolved, tradingEnded, showMobileTrading]);

  const handleBuyClick = (_side: "yes" | "no") => {
    // 已结算 / 已截止待结算的市场禁止下单
    if (isResolved || tradingEnded) return;
    setShowMobileTrading(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-(--bg-primary) px-4 py-6 space-y-4">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (!market || !option) {
    return (
      <div className="min-h-screen bg-(--bg-primary) px-4 py-6">
        <div className="text-center text-(--text-secondary)">
          {t.common.notFound}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--bg-primary)">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <button
          onClick={() => router.back()}
          className="p-1.5 -ml-1.5 rounded-full hover:bg-(--bg-hover)"
        >
          <ArrowLeft size={18} className="text-(--text-primary)" />
        </button>
        <div className="text-xs text-(--text-secondary)">
          ${formatNumber(realVolume)} Vol.
        </div>
        <div className="flex items-center gap-0.5">
          <button
            className="p-1.5 rounded-full hover:bg-(--bg-hover)"
            onClick={() => {
              navigator.clipboard
                .writeText(window.location.href)
                .then(() => toast.success(t.common.linkCopied))
                .catch(() => toast.error(t.common.operationFailed));
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-(--text-secondary)"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
        </div>
      </div>

      {/* 主内容 */}
      <div className="px-3">
        {/* Outcome 信息 */}
        <div className="flex items-start gap-2.5 mb-2">
          <ProxyImage
            src={market.icon}
            fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiMyYTJhMmEiLz48L3N2Zz4="
            alt=""
            className="w-9 h-9 rounded-lg object-cover"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-(--text-primary) line-clamp-2">
              {option.label}
            </h1>
          </div>
          {showMobileLiveCountdown && (
            <OutcomeMobileCountdown
              countdown={mobileLiveCountdown}
              labels={mobileCountdownLabels}
            />
          )}
        </div>

        {/* 图表区域 */}
        {activeChart === "probability" && (
          <OutcomeProbabilityChart
            chartData={chartData}
            chartLoading={chartLoading}
            optionLabel={option?.label}
            selectedRange={selectedRange}
            onRangeChange={setSelectedRange}
          />
        )}

        {/* Price Chart (如果支持) */}
        {activeChart === "price" && (
          <div className="mb-1">
            <LivePriceChart
              symbol={liveChartSymbol}
              eventSlug={realEventSlug || market.slug}
              eventId={eventData?.id}
              isFinance={isFinanceEvent}
              height={200}
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

        <div className="flex flex-wrap items-center justify-between mt-3 mb-3 lg:mt-4 relative z-10">
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

        <div className="border border-(--border) rounded-xl mb-3">
          <button
            onClick={() => setOrderBookExpanded(!orderBookExpanded)}
            className="w-full flex items-center justify-between p-3"
          >
            <span className="text-sm font-medium text-(--text-primary)">
              {t.market.orderBook}
            </span>
            {orderBookExpanded ? (
              <ChevronUp size={18} className="text-(--text-secondary)" />
            ) : (
              <ChevronDown size={18} className="text-(--text-secondary)" />
            )}
          </button>

          {orderBookExpanded && eventMarket && (
            <div className="px-3 pb-3 border-t border-(--border)">
              <SpotOrderbook
                ticker={`${marketId}-${option?.label}`}
                basePrice={percentage / 100}
                label={option?.label}
                marketId={String(eventMarket.id)}
                marketSource={eventMarket.source}
                marketOutcomes={(eventMarket as any).marketOutcomes}
              />
            </div>
          )}
        </div>

        {/* Rules - 使用真实 API 数据 */}
        {eventData?.description && (
          <div className="mb-3">
            <h3 className="text-sm font-medium text-(--text-primary) mb-1.5">
              {t.market.rules}
            </h3>
            <p
              className={
                "text-xs text-(--text-secondary) leading-relaxed" +
                (showFullDescription ? "" : " line-clamp-2")
              }
            >
              {eventData?.description || option?.label}
            </p>
            {!showFullDescription && eventData?.description && (
              <button
                className="mt-1 text-xs text-(--text-secondary) hover:text-(--text-primary) flex items-center gap-0.5"
                onClick={() => setShowFullDescription(true)}
              >
                {t.common.showMore} <ChevronDown size={12} />
              </button>
            )}
          </div>
        )}
        {/* Comments/Holders/Activity - 使用 MarketDetailTabs 组件 */}
        <MarketDetailTabs
          marketId={market.id}
          unionKey={realEventSlug || market.id}
          eventSlug={realEventSlug || market.id}
          eventId={eventData?.id}
          markets={allMarkets}
          selectedMarketId={eventMarket ? String(eventMarket.id) : undefined}
        />

        {/* 底部留白 */}
        <div className="h-20" />
      </div>

      {/* 底部固定买入按钮 / 已解决状态 */}
      <OutcomeBottomBuyBar
        isResolved={isResolved}
        resolvedOutcome={resolvedOutcome}
        settlementDisplay={settlementDisplay}
        tradingEnded={tradingEnded}
        yesLabel={yesLabel}
        noLabel={noLabel}
        yesPrice={yesPrice}
        noPrice={noPrice}
        onBuyClick={handleBuyClick}
      />
    </div>
  );
}
