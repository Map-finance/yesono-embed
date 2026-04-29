"use client";

/**
 * Outcome Detail Page - 移动端 Outcome 详情页
 * 对齐 /market/{slug} 页面功能：真实 Rules、Comments/Holders/Activity、ChartToggleSwitch、底部 buy 按钮
 */

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Market } from "@/types/types";

import { getEventBySlug, getNeedTimeTagTags } from "@/lib/services/homeService";
import { polymarketEventToMarket } from "@/lib/utils/eventToMarket";
import { PolymarketEventResp, PolymarketMarketResp } from "@/types/home";
import { ArrowLeft, ChevronDown, ChevronUp, X } from "lucide-react";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import SpotOrderbook from "@/components/detail/SpotOrderbook";
import MarketDetailTabs from "@/components/detail/MarketDetailTabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import ProxyImage from "@/components/common/ProxyImage";
import {
  useSingleMarketPriceHistory,
  TimeRange as ApiTimeRange,
} from "@/lib/hooks/usePriceHistory";
import { formatNumber } from "@/utils/format";
import { useTranslation } from "@/lib/i18n";
import {
  getOutcomeLabel,
  getOutcomesByMarket,
  normalizeBinaryOutcomeLabel,
  sortOutcomesByOriginalIndex,
} from "@/lib/utils/outcomes";
import dynamic from "next/dynamic";
import { useToast } from "@/components/ui/Toast";

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

// UI time range options
type UITimeRange = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";
const timeRanges: UITimeRange[] = ["1H", "6H", "1D", "1W", "1M", "ALL"];

const mapToApiRange = (range: UITimeRange): ApiTimeRange => {
  switch (range) {
    case "1H":
      return "1H";
    case "6H":
      return "6H";
    case "1D":
      return "1D";
    case "1W":
      return "1W";
    case "1M":
      return "1M";
    case "ALL":
      return "ALL";
    default:
      return "1D";
  }
};

// slug 前缀别名修正（与 market page 一致）
const COIN_ALIAS: Record<string, string> = {
  bitcoin: "btc",
  ethereum: "eth",
  solana: "sol",
  ripple: "xrp",
  dogecoin: "doge",
};

const DEFAULT_LIVE_COUNTDOWN_LABELS = {
  days: "Days",
  hours: "Hours",
  minutes: "Mins",
  seconds: "Secs",
};

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
        const [data, timeTagTags] = await Promise.all([
          getEventBySlug(marketId),
          getNeedTimeTagTags(),
        ]);
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
  const change = option?.change;

  // Chart data
  const effectiveMarketId = eventMarket ? String(eventMarket.id) : "";
  const {
    data: apiData,
    loading: chartLoading,
    currentPrices,
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

  const MAX_DISPLAY_POINTS = 300;
  const displayData = useMemo(() => {
    if (!chartData || chartData.length <= MAX_DISPLAY_POINTS) return chartData;
    const kept = [chartData[0]];
    for (let i = 1; i < chartData.length; i++) {
      const prev = chartData[i - 1];
      const curr = chartData[i];
      if (curr.value !== prev.value || i === chartData.length - 1) {
        if (kept[kept.length - 1] !== prev) kept.push(prev);
        kept.push(curr);
      }
    }
    if (kept.length <= MAX_DISPLAY_POINTS) return kept;
    const step = (kept.length - 2) / (MAX_DISPLAY_POINTS - 2);
    const thinned = [kept[0]];
    for (let i = 1; i < MAX_DISPLAY_POINTS - 1; i++) {
      thinned.push(kept[Math.round(i * step)]);
    }
    thinned.push(kept[kept.length - 1]);
    return thinned;
  }, [chartData]);

  const currentValue = useMemo(() => {
    const apiPrice = currentPrices[effectiveMarketId];
    if (apiPrice !== undefined) return apiPrice;
    if (chartData.length > 0) return chartData[chartData.length - 1].value;
    return percentage;
  }, [currentPrices, effectiveMarketId, chartData, percentage]);

  const yDomain = useMemo<[number, number]>(() => {
    if (!chartData || chartData.length === 0) return [0, 100];
    let min = Infinity,
      max = -Infinity;
    for (const point of chartData) {
      if (typeof point.value === "number") {
        if (point.value < min) min = point.value;
        if (point.value > max) max = point.value;
      }
    }
    if (!isFinite(min) || !isFinite(max)) return [0, 100];
    const buf = Math.max((max - min) * 0.05, 1);
    return [
      Math.max(0, Math.floor((min - buf) / 5) * 5),
      Math.min(100, Math.ceil((max + buf) / 5) * 5),
    ];
  }, [chartData]);

  const createLastDot = useCallback(
    (props: any) => {
      const { cx, cy, index } = props;
      if (
        displayData &&
        displayData.length > 0 &&
        index === displayData.length - 1
      ) {
        return <circle cx={cx} cy={cy} r={5} fill="#ED6432" />;
      }
      return null;
    },
    [displayData]
  );

  // Tooltip refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const activeIdxRef = useRef<number>(-1);

  const formatTooltipTime = useCallback(
    (ts: number) => {
      const d = new Date(ts);
      if (["1H", "6H"].includes(selectedRange)) {
        return d.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
      }
      if (selectedRange === "1D") {
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });
      }
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    },
    [selectedRange]
  );

  const CHART_LEFT = 35;
  const CHART_RIGHT_PAD = 10;

  const handleChartMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = chartContainerRef.current;
      const tooltip = tooltipRef.current;
      const cursor = cursorRef.current;
      if (
        !container ||
        !tooltip ||
        !cursor ||
        !displayData ||
        displayData.length === 0
      )
        return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const chartRight = rect.width - CHART_RIGHT_PAD;
      const chartWidth = chartRight - CHART_LEFT;

      if (mouseX < CHART_LEFT || mouseX > chartRight || chartWidth <= 0) {
        tooltip.style.display = "none";
        cursor.style.display = "none";
        activeIdxRef.current = -1;
        return;
      }

      const ratio = (mouseX - CHART_LEFT) / chartWidth;
      const idx = Math.max(
        0,
        Math.min(
          displayData.length - 1,
          Math.round(ratio * (displayData.length - 1))
        )
      );
      if (idx === activeIdxRef.current) return;
      activeIdxRef.current = idx;

      const point = displayData[idx];
      const pointX =
        CHART_LEFT + (idx / Math.max(displayData.length - 1, 1)) * chartWidth;

      cursor.style.display = "block";
      cursor.style.left = `${pointX}px`;

      const ts = point.timestamp as number;
      const val =
        typeof point.value === "number" ? point.value.toFixed(1) : "—";
      tooltip.replaceChildren();
      if (ts) {
        const header = document.createElement("div");
        header.style.cssText =
          "font-size:11px;color:var(--text-tertiary);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--border)";
        header.textContent = formatTooltipTime(ts);
        tooltip.appendChild(header);
      }
      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;align-items:center;justify-content:space-between;gap:8px";
      const left = document.createElement("div");
      left.style.cssText = "display:flex;align-items:center;gap:6px";
      const dot = document.createElement("div");
      dot.style.cssText =
        "width:8px;height:8px;border-radius:50%;flex-shrink:0;background:#ED6432";
      const name = document.createElement("span");
      name.style.cssText = "font-size:11px;color:var(--text-secondary)";
      name.textContent = String(option?.label || "Value");
      left.appendChild(dot);
      left.appendChild(name);
      const right = document.createElement("span");
      right.style.cssText =
        "font-size:11px;font-weight:500;color:var(--text-primary)";
      right.textContent = `${val}%`;
      row.appendChild(left);
      row.appendChild(right);
      tooltip.appendChild(row);
      tooltip.style.display = "block";
      const tw = tooltip.offsetWidth || 120;
      let tx = pointX + 12;
      if (tx + tw > rect.width) tx = pointX - tw - 12;
      tooltip.style.left = `${tx}px`;
      tooltip.style.top = `${Math.max(8, e.clientY - rect.top - 16)}px`;
    },
    [displayData, formatTooltipTime, option?.label]
  );

  const handleChartMouseLeave = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.display = "none";
    if (cursorRef.current) cursorRef.current.style.display = "none";
    activeIdxRef.current = -1;
  }, []);

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
      const yes = prices[0] !== undefined ? Math.round(prices[0] * 100) : 0;
      const no =
        prices[1] !== undefined
          ? Math.round(prices[1] * 100)
          : yes > 0
          ? 100 - yes
          : 0;
      return [`${yes}¢`, `${no}¢`];
    } catch (e) {
      console.error('[OutcomeDetailPage] Failed to parse outcome prices', e);
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
            console.error('[OutcomeDetailPage] Failed to parse marketOutcomes', e);
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
  const handleBuyClick = (side: "yes" | "no") => {
    if (isResolved) return;
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
            <div className="flex shrink-0 items-center gap-2 sm:hidden">
              {mobileLiveCountdown.days > 0 && (
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold leading-none text-[#FF453A] tabular-nums">
                    {String(mobileLiveCountdown.days).padStart(2, "0")}
                  </span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-(--text-secondary)">
                    {mobileCountdownLabels.days}
                  </span>
                </div>
              )}
              {mobileLiveCountdown.hours > 0 && (
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold leading-none text-[#FF453A] tabular-nums">
                    {String(mobileLiveCountdown.hours).padStart(2, "0")}
                  </span>
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-(--text-secondary)">
                    {mobileCountdownLabels.hours}
                  </span>
                </div>
              )}
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold leading-none text-[#FF453A] tabular-nums">
                  {String(mobileLiveCountdown.minutes).padStart(2, "0")}
                </span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-(--text-secondary)">
                  {mobileCountdownLabels.minutes}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-bold leading-none text-[#FF453A] tabular-nums">
                  {String(mobileLiveCountdown.seconds).padStart(2, "0")}
                </span>
                <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-(--text-secondary)">
                  {mobileCountdownLabels.seconds}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 百分比和变化 */}
        {/* <div className="flex items-center gap-2 mb-3">
          <span className="text-lg font-bold text-[#ED6432]">
            {currentValue.toFixed(1)}% {t.market.chance}
          </span>
          {change !== undefined && change !== 0 && (
            <span className={`text-xs ${change >= 0 ? "text-(--green)" : "text-(--red)"}`}>
              {change >= 0 ? "▲" : "▼"}{Math.abs(change)}%
            </span>
          )}
        </div> */}

        {/* 图表区域 */}
        {activeChart === "probability" && (
          <div ref={chartContainerRef} className="relative h-[200px] mb-1">
            <style
              dangerouslySetInnerHTML={{
                __html: `
              path[stroke="#ED6432"] { filter: drop-shadow(rgb(237, 100, 50) 0px 0px 8px) drop-shadow(rgb(237, 100, 50) 0px 0px 4px) !important; }
              circle[fill="#ED6432"] { filter: drop-shadow(rgb(237, 100, 50) 0px 0px 8px) drop-shadow(rgb(237, 100, 50) 0px 0px 4px) !important; }
            `,
              }}
            />
            {chartLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-5 h-5 border-2 border-(--text-secondary) border-t-transparent rounded-full animate-spin" />
              </div>
            ) : displayData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-(--text-secondary) text-xs">
                {t.market.common.noData}
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={displayData}
                    margin={{ top: 8, right: 8, left: -12, bottom: 4 }}
                  >
                    <CartesianGrid
                      stroke="var(--border-light)"
                      strokeOpacity={0.5}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="transparent"
                      tick={{ fill: "var(--text-tertiary)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                      minTickGap={50}
                    />
                    <YAxis
                      domain={yDomain}
                      tickFormatter={(v: number) => `${v}%`}
                      tick={{ fill: "var(--text-tertiary)", fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                      tickCount={5}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="value"
                      stroke="#ED6432"
                      strokeWidth={2}
                      dot={createLastDot}
                      activeDot={false}
                      connectNulls
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div
                  className="absolute inset-0 z-10"
                  onMouseMove={handleChartMouseMove}
                  onMouseLeave={handleChartMouseLeave}
                  onTouchMove={(e) => {
                    const touch = e.touches[0];
                    if (touch)
                      handleChartMouseMove({
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        currentTarget: e.currentTarget,
                      } as any);
                  }}
                  onTouchEnd={handleChartMouseLeave}
                />
                <div
                  ref={cursorRef}
                  className="absolute pointer-events-none z-20"
                  style={{
                    display: "none",
                    top: 8,
                    bottom: 20,
                    width: 0,
                    borderLeft: "1px dashed var(--text-tertiary)",
                  }}
                />
                <div
                  ref={tooltipRef}
                  className="absolute pointer-events-none z-20 border bg-(--bg-primary) border-(--border) rounded-lg p-2 shadow-xl min-w-[120px]"
                  style={{ display: "none" }}
                />
              </>
            )}
          </div>
        )}

        {/* Price Chart (如果支持) */}
        {activeChart === "price" && (
          <div className="mb-1">
            <LivePriceChart
              symbol={liveChartSymbol}
              eventSlug={realEventSlug || market.slug}
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

        {/* 时间范围选择器 */}
        {activeChart === "probability" && (
          <div className="flex items-center gap-0.5 mb-4">
            {timeRanges.map((range) => (
              <button
                key={range}
                onClick={() => setSelectedRange(range)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedRange === range
                    ? "bg-(--bg-secondary) text-(--text-primary)"
                    : "text-(--text-secondary)"
                }`}
              >
                {range}
              </button>
            ))}
          </div>
        )}

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
      <div className="fixed bottom-0 left-0 right-0 bg-(--bg-card) border-t border-(--border) p-3 safe-area-bottom z-40">
        {isResolved ? (
          <div className="py-2.5 rounded-lg text-center text-sm font-semibold bg-[rgba(59,130,246,0.15)] text-[#3b82f6] border border-[rgba(59,130,246,0.3)]">
            {t.market.resolved}: {resolvedOutcome || t.market.common.yes}
          </div>
        ) : (
          <div className="flex gap-2.5">
            <button
              onClick={() => handleBuyClick("yes")}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-[#22c55e] text-white active:opacity-80 transition-opacity"
            >
              {t.common.buy || "Buy"} {yesLabel} {yesPrice}
            </button>
            <button
              onClick={() => handleBuyClick("no")}
              className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-[#ef4444] text-white active:opacity-80 transition-opacity"
            >
              {t.common.buy || "Buy"} {noLabel} {noPrice}
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
