"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMarketStore } from "@/lib/store/cryptoStore";
import { useTranslation, useLocale } from "@/lib/i18n";
import { formatDate } from "@/utils/format";
import {
  ArrowLeft,
  Globe,
  ChevronDown,
  Gift,
  RotateCw,
  ChevronUp,
  RefreshCw,
  Settings,
} from "lucide-react";
import { MarketItem } from "@/types/crypto";
import { mockOutcomes, resolvedOutcomes } from "../mockData";
import MarketDetailTabs from "@/components/detail/MarketDetailTabs";
import MarketContext from "@/components/crypto/MarketContext";
import Rules from "@/components/crypto/Rules";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import ProxyImage from "@/components/common/ProxyImage";

// 获取资产图标的辅助函数
const getAssetIcon = (asset: string) => {
  switch (asset) {
    case "BTC":
      return "https://cryptologos.cc/logos/bitcoin-btc-logo.png";
    case "ETH":
      return "https://cryptologos.cc/logos/ethereum-eth-logo.png";
    case "SOL":
      return "https://cryptologos.cc/logos/solana-sol-logo.png";
    case "XRP":
      return "https://cryptologos.cc/logos/xrp-xrp-logo.png";
    case "DOGE":
      return "https://cryptologos.cc/logos/dogecoin-doge-logo.png";
    default:
      return "https://cryptologos.cc/logos/bitcoin-btc-logo.png";
  }
};

// ========== Order Book 相关 ==========
interface OrderBookEntry {
  price: number;
  shares: number;
  total: number;
}

// 生成模拟订单簿数据
const generateOrderBook = (
  percentage: number
): { asks: OrderBookEntry[]; bids: OrderBookEntry[] } => {
  const basePrice = percentage / 100;
  const asks: OrderBookEntry[] = [];
  const bids: OrderBookEntry[] = [];

  // Asks (卖单) - 价格从低到高
  for (let i = 0; i < 4; i++) {
    const price = Math.round((basePrice + 0.001 + i * 0.001) * 1000) / 10;
    const shares = Math.round(Math.random() * 400000 + 3000);
    asks.push({ price, shares, total: Math.round((shares * price) / 100) });
  }

  // Bids (买单) - 价格从高到低
  for (let i = 0; i < 4; i++) {
    const price = Math.round((basePrice - 0.001 - i * 0.001) * 1000) / 10;
    const shares = Math.round(Math.random() * 400000 + 3000);
    bids.push({ price, shares, total: Math.round((shares * price) / 100) });
  }

  return { asks: asks.reverse(), bids };
};

// ========== Graph 相关 ==========
// 使用种子生成伪随机数
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

type TimeRange = "1D" | "1W" | "1M" | "ALL";
const timeRanges: TimeRange[] = ["1D", "1W", "1M", "ALL"];

// 生成图表数据
const generateGraphData = (
  percentage: number,
  range: TimeRange,
  locale: string = "en-US"
) => {
  const data: { date: string; value: number }[] = [];
  const now = new Date();

  let points: number;
  let getDate: (i: number) => Date;
  let fmtOpts: Intl.DateTimeFormatOptions = {};

  switch (range) {
    case "1D":
      points = 48;
      getDate = (i) => new Date(now.getTime() - (points - i) * 30 * 60 * 1000);
      fmtOpts = { hour: "numeric", minute: "2-digit", hour12: true };
      break;
    case "1W":
      points = 84;
      getDate = (i) =>
        new Date(now.getTime() - (points - i) * 2 * 60 * 60 * 1000);
      fmtOpts = { month: "short", day: "numeric" };
      break;
    case "1M":
      points = 60;
      getDate = (i) =>
        new Date(now.getTime() - (points - i) * 12 * 60 * 60 * 1000);
      fmtOpts = { month: "short", day: "numeric" };
      break;
    case "ALL":
      points = 90;
      getDate = (i) =>
        new Date(now.getTime() - (points - i) * 24 * 60 * 60 * 1000);
      fmtOpts = { month: "short", year: "numeric" };
      break;
  }

  for (let i = 0; i < points; i++) {
    const date = getDate(i);
    const seed = percentage * 100 + i + range.charCodeAt(0);
    const trend = Math.sin(i * 0.08) * 8;
    const noise = seededRandom(seed) * 6 - 3;
    data.push({
      date: formatDate(date, locale === "zh" ? "zh-CN" : "en-US", fmtOpts),
      value: Math.max(1, Math.min(99, percentage + trend + noise)),
    });
  }

  return data;
};

// Outcome Graph 组件
interface OutcomeGraphProps {
  percentage: number;
  change?: number;
  label?: string;
}

const OutcomeGraph: React.FC<OutcomeGraphProps> = ({
  percentage,
  change,
  label,
}) => {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [selectedRange, setSelectedRange] = useState<TimeRange>("1W");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    autoscale: true,
    xAxis: true,
    yAxis: true,
    horizontalGrid: true,
    verticalGrid: false,
    annotations: true,
  });

  // 生成图表数据
  const chartData = useMemo(
    () =>
      generateGraphData(
        percentage,
        selectedRange,
        locale === "zh-CN" || locale === "zh-TW" ? "zh-CN" : "en-US"
      ),
    [percentage, selectedRange, locale]
  );

  // 计算当前百分比
  const currentValue = useMemo(() => {
    if (!chartData || chartData.length === 0) return percentage;
    return chartData[chartData.length - 1].value;
  }, [chartData, percentage]);

  // 自定义工具提示
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ED6432]" />
            <span className="text-white text-sm">
              {label || t.market.chart.valueLabel}:{" "}
              {payload[0].value.toFixed(1)}%
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // 创建最后一个数据点的 dot 渲染函数
  const createLastDot = (props: any) => {
    const { cx, cy, index } = props;
    if (chartData && chartData.length > 0 && index === chartData.length - 1) {
      return <circle cx={cx} cy={cy} r={5} fill="#ED6432" />;
    }
    return null;
  };

  // 发光效果 CSS
  const glowStyles = `
    path[stroke="#ED6432"] { filter: drop-shadow(rgb(237, 100, 50) 0px 0px 8px) drop-shadow(rgb(237, 100, 50) 0px 0px 4px) !important; }
    circle[fill="#ED6432"] { filter: drop-shadow(rgb(237, 100, 50) 0px 0px 8px) drop-shadow(rgb(237, 100, 50) 0px 0px 4px) !important; }
  `;

  return (
    <div className="relative bg-[#111111] rounded-lg p-4">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full bg-[#ED6432]" />
        <span className="text-white text-sm">{label || t.market.outcome}</span>
        <span className="text-[#b0b0b0] text-sm">
          {currentValue.toFixed(1)}%
        </span>
        {change !== undefined && (
          <span
            className={`text-sm ${
              change >= 0 ? "text-[var(--green)]" : "text-[var(--red)]"
            }`}
          >
            {change >= 0 ? "▲" : "▼"}
            {Math.abs(change)}%
          </span>
        )}
      </div>

      {/* 时间范围选择器 */}
      <div className="flex gap-1 mb-4">
        {timeRanges.map((range) => (
          <button
            key={range}
            onClick={() => setSelectedRange(range)}
            className={`h-7 px-3 rounded-full text-sm font-normal transition-all ${
              selectedRange === range
                ? "bg-[#ED6432] text-[#030303]"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* 图表 */}
      <div className="relative" style={{ height: "180px" }}>
        <style dangerouslySetInnerHTML={{ __html: glowStyles }} />

        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
          >
            <CartesianGrid
              stroke="rgba(255, 255, 255, 0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="transparent"
              tick={{ fill: "rgb(167, 167, 167)", fontSize: 12 }}
              axisLine={{ stroke: "transparent" }}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="stepAfter"
              dataKey="value"
              stroke="#ED6432"
              strokeWidth={1.5}
              dot={createLastDot}
              activeDot={{ r: 6, fill: "#ED6432" }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 底部工具栏 */}
      <div className="flex items-center justify-end mt-2 pt-2 border-t border-[rgba(255,255,255,0.1)]">
        <div className="flex gap-1">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded hover:bg-white/10 text-[#b0b0b0]"
            title={t.market.common.settings}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 w-[260px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium text-[var(--text-primary)] mb-3">
              {t.market.common.settings}
            </div>
            {[
              { key: "autoscale", label: t.market.chart.autoscale },
              { key: "xAxis", label: t.market.chart.xAxis },
              { key: "yAxis", label: t.market.chart.yAxis },
              { key: "horizontalGrid", label: t.market.chart.horizontalGrid },
              { key: "verticalGrid", label: t.market.chart.verticalGrid },
              { key: "annotations", label: t.market.chart.annotations },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between py-2"
              >
                <span className="text-sm text-[var(--text-secondary)]">
                  {item.label}
                </span>
                <button
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      [item.key]: !prev[item.key as keyof typeof prev],
                    }))
                  }
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    settings[item.key as keyof typeof settings]
                      ? "bg-[#3b82f6]"
                      : "bg-[var(--bg-secondary)]"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                      settings[item.key as keyof typeof settings]
                        ? "left-5"
                        : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function CryptoDetailPage() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const params = useParams();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const router = useRouter();
  const { markets, fetchMarkets } = useMarketStore();
  const [market, setMarket] = useState<MarketItem | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const [showResolved, setShowResolved] = useState(false);
  // 可展开列表项状态
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<
    "orderbook" | "graph" | "resolution"
  >("graph");

  const [contextStatus, setContextStatus] = useState<
    "idle" | "loading" | "done"
  >("idle");
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [fullContextText, setFullContextText] = useState("");
  const [displayedContextText, setDisplayedContextText] = useState("");
  // Rules 状态
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const MOCK_CONTEXT_TEXT = `In the past week, as of December 25, 2025, recent news and market sentiment around Bitcoin's price predictions for the year highlight a mix of cautious optimism and volatility. Bitcoin is currently trading near $87,000, with reports of ETF outflows and a miner hashrate drop adding downward pressure. However, wallet accumulation and institutional buying interest between $80,000–$90,000 provide support. Forecasts range widely, from a potential rebound to $105,000 by year-end to bearish corrections targeting $75,000–$85,000. Macro factors like gold's outperformance and global financial trends continue to influence probabilities for various price outcomes.`;
  // 获取市场数据
  useEffect(() => {
    if (markets.length === 0) {
      fetchMarkets();
    }
  }, [markets.length, fetchMarkets]);

  // 根据 ID 查找市场
  useEffect(() => {
    if (markets.length > 0 && params?.id) {
      const foundMarket = markets.find((m) => m.id === params.id);
      setMarket(foundMarket || null);
    }
  }, [markets, params?.id]);

  useEffect(() => {
    if (!market || !sentinelRef.current) return;

    const sentinelEl = sentinelRef.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting);
      },
      {
        rootMargin: "-50px 0px 0px 0px",
        threshold: 0,
      }
    );

    observer.observe(sentinelEl);

    return () => {
      observer.unobserve(sentinelEl);
      observer.disconnect();
    };
  }, [market]);

  // 打字机效果逻辑
  useEffect(() => {
    if (contextStatus === "done" && isContextExpanded && !hasTyped) {
      let i = 0;
      setDisplayedContextText("");
      const interval = setInterval(() => {
        setDisplayedContextText(MOCK_CONTEXT_TEXT.slice(0, i));
        i++;
        if (i > MOCK_CONTEXT_TEXT.length) {
          clearInterval(interval);
          setHasTyped(true);
        }
      }, 10);
      return () => clearInterval(interval);
    } else if (hasTyped) {
      setDisplayedContextText(MOCK_CONTEXT_TEXT);
    }
  }, [contextStatus, isContextExpanded, hasTyped]);

  const handleGenerateClick = () => {
    setContextStatus("loading");
    setTimeout(() => {
      setContextStatus("done");
      setIsContextExpanded(true);
    }, 2000);
  };

  // 从概率字符串中提取数字
  const parsePercentage = (prob: string) => {
    return parseFloat(prob.replace("%", "")) || 50;
  };

  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-[var(--text-secondary)]">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-20 relative">
      <div className="max-w-[1280px] mx-auto grid grid-cols-12 gap-8 px-6">
        <div
          ref={sentinelRef}
          className="absolute top-0 left-0 w-full h-[1px] pointer-events-none opacity-0 z-0"
        />
        {/* 左侧主内容 */}
        <div className="col-span-12 lg:col-span-8">
          {/* Header Section - Sticky */}
          <div ref={headerRef} className="sticky top-[120px] z-40 -mx-6 px-6">
            <div
              className={`transition-all duration-100 ease-in-out border-b ${
                isScrolled
                  ? "bg-[var(--bg-primary)]/95 backdrop-blur-md py-3 border-[var(--border)] shadow-lg"
                  : "pt-8 pb-6 bg-transparent border-transparent"
              }`}
            >
              {/* 第一行：图标 + 标题 + 倒计时 */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  {/* 资产图标 */}
                  <div
                    className={`rounded-xl bg-orange-500 flex items-center justify-center transition-all duration-100 shrink-0 ${
                      isScrolled ? "w-10 h-10 p-1.5" : "w-16 h-16 p-3.5"
                    }`}
                  >
                    <ProxyImage
                      /**
                       * 中文注释：
                       * - Crypto 资产图标来自第三方站点（cryptologos.cc）
                       * - 生产环境走图片代理，可明显提升海外用户加载速度与稳定性
                       */
                      src={getAssetIcon(market.asset)}
                      className="w-full h-full object-contain invert"
                      alt="asset"
                    />
                  </div>
                  {/* 市场标题 */}
                  <h1
                    className={`!font-semibold !text-2xl text-pretty ${
                      isScrolled ? "text-[18px]" : "text-[32px]"
                    }`}
                  >
                    {market.question}
                  </h1>
                </div>

                {/* 倒计时 */}
                <div
                  className={`flex items-center gap-5 transition-all duration-100 ${
                    isScrolled
                      ? "scale-90 origin-right translate-y-0"
                      : "scale-100"
                  }`}
                >
                  {[
                    { val: "07", label: "DAYS" },
                    { val: "17", label: "HRS" },
                    { val: "51", label: "MINS" },
                  ].map((t, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <span className="text-[24px] font-bold text-[var(--text-primary)] leading-none">
                        {t.val}
                      </span>
                      <span className="text-[9px] text-[var(--text-secondary)] font-black mt-1.5 tracking-[0.05em] uppercase">
                        {t.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 第二行：交易量信息 */}
              <div
                className={`transition-all duration-100 overflow-hidden ${
                  isScrolled ? "opacity-0 max-h-0" : "opacity-100 max-h-10 mt-5"
                }`}
              >
                <div className="text-[var(--text-secondary)] text-[14px] font-medium pl-1">
                  {market.volume || "$152,218,277"} {t.common.volume}
                </div>
              </div>
            </div>
          </div>

          {/* 列表头部 */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-widest px-2 py-3 border-b border-[var(--border)]">
              <span className="w-1/3">Outcome</span>
              <span className="flex-1 text-center flex items-center justify-center gap-1.5 mr-10">
                % Chance <RotateCw className="w-3 h-3" />
              </span>
              <div className="w-[240px]" />
            </div>

            {/* 结果列表 - 可展开 */}
            <div className="divide-y divide-[var(--border)]">
              {mockOutcomes.map((o, idx) => {
                const isExpanded = expandedIndex === idx;
                return (
                  <div key={idx} className="flex flex-col">
                    {/* 列表项 - 可点击展开 */}
                    <div
                      onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                      className={`group flex items-center justify-between py-5 px-2 hover:bg-[var(--bg-secondary)] transition-all cursor-pointer ${
                        isExpanded ? "bg-[var(--bg-secondary)]" : ""
                      }`}
                    >
                      <div className="w-1/3 flex flex-col gap-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-[var(--text-secondary)] text-[14px] font-bold">
                            ↑
                          </span>
                          <span className="text-[17px] font-bold text-[var(--text-primary)] border-b border-dashed border-[var(--border)] pb-0.5 group-hover:border-[var(--text-secondary)] transition-colors cursor-help">
                            {o.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)] font-bold">
                          <span>
                            {o.vol} {t.common.volume}
                          </span>
                          {o.hasGift && (
                            <Gift className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                          )}
                        </div>
                      </div>

                      <div className="flex-1 text-center">
                        <span
                          className={`text-[28px] font-bold tracking-tighter transition-colors ${
                            isExpanded
                              ? "text-[var(--text-primary)]"
                              : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {o.prob}
                        </span>
                      </div>

                      <div className="w-[240px] flex gap-2.5 justify-end">
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex flex-col items-center justify-center bg-[#294a4c] hover:bg-[#00d684] text-[#3eae6b] hover:text-white rounded-md px-4 py-2 w-[115px] transition-all shadow-lg shadow-[#00c076]/10"
                        >
                          <span className="text-[13px] font-black uppercase leading-tight">
                            {t.market.buyYes}
                          </span>
                          <span className="text-[11px] font-bold opacity-80 leading-tight">
                            {o.yesPrice}
                          </span>
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex flex-col items-center justify-center bg-[#2d2424] hover:bg-[#ff4d4d] text-[#ff4d4d] hover:text-white rounded-md px-4 py-2 w-[115px] transition-all border border-[#451a1a] hover:border-transparent group/no"
                        >
                          <span className="text-[13px] font-black uppercase leading-tight">
                            {t.market.buyNo}
                          </span>
                          <span className="text-[11px] font-bold opacity-80 leading-tight group-hover/no:text-white">
                            {o.noPrice}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* 展开的内容区域 */}
                    {isExpanded &&
                      (() => {
                        const percentage = parsePercentage(o.prob);
                        const orderBook = generateOrderBook(percentage);
                        return (
                          <div className="bg-[var(--bg-card)] border-y border-[var(--border)] px-4 pb-4">
                            {/* 标签页导航 */}
                            <div className="flex items-center justify-between py-3">
                              <div className="flex gap-4">
                                {[
                                  {
                                    key: "orderbook" as const,
                                    label: t.market.orderBook,
                                  },
                                  {
                                    key: "graph" as const,
                                    label: t.market.chart.graph,
                                  },
                                  {
                                    key: "resolution" as const,
                                    label: t.market.chart.resolution,
                                  },
                                ].map((tab) => (
                                  <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`text-sm font-medium transition-colors ${
                                      activeTab === tab.key
                                        ? "text-[var(--text-primary)]"
                                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                                    }`}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                <RefreshCw size={14} />
                                <span>0.1¢</span>
                              </div>
                            </div>

                            {/* Order Book 内容 */}
                            {activeTab === "orderbook" && (
                              <div>
                                {/* Trade Yes 表格 */}
                                <div className="text-xs text-[var(--text-secondary)] uppercase mb-2 flex items-center gap-2">
                                  {t.market.buyYes}
                                  <span className="text-[var(--text-tertiary)]">
                                    ⊡
                                  </span>
                                </div>

                                {/* 表头 */}
                                <div className="grid grid-cols-3 text-xs text-[var(--text-secondary)] py-1 border-b border-[var(--border)]">
                                  <span className="text-center">Price</span>
                                  <span className="text-right">Shares</span>
                                  <span className="text-right">Total</span>
                                </div>

                                {/* Asks */}
                                {orderBook.asks.map((entry, i) => (
                                  <div
                                    key={`ask-${i}`}
                                    className="grid grid-cols-3 text-xs py-1.5 relative"
                                  >
                                    <div
                                      className="absolute left-0 top-0 bottom-0 bg-[rgba(239,68,68,0.15)]"
                                      style={{
                                        width: `${Math.min(
                                          entry.shares / 5000,
                                          100
                                        )}%`,
                                      }}
                                    />
                                    <span className="text-center text-[var(--green)] relative z-10">
                                      {entry.price}¢
                                    </span>
                                    <span className="text-right text-[var(--text-primary)] relative z-10">
                                      {entry.shares.toLocaleString()}
                                    </span>
                                    <span className="text-right text-[var(--text-secondary)] relative z-10">
                                      ${entry.total.toLocaleString()}
                                    </span>
                                  </div>
                                ))}

                                {/* Asks 标签 */}
                                <div className="flex items-center gap-2 py-2">
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-[rgba(239,68,68,0.2)] text-[var(--red)]">
                                    {t.market.asks}
                                  </span>
                                </div>

                                {/* Last / Spread */}
                                <div className="flex justify-between text-xs text-[var(--text-secondary)] py-2 border-y border-[var(--border)]">
                                  <span>
                                    {t.market.last} {percentage.toFixed(1)}¢
                                  </span>
                                  <span>{t.market.spread} 0.1¢</span>
                                </div>

                                {/* Bids 标签 */}
                                <div className="flex items-center gap-2 py-2">
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-[rgba(34,197,94,0.2)] text-[var(--green)]">
                                    {t.market.bids}
                                  </span>
                                </div>

                                {/* Bids */}
                                {orderBook.bids.map((entry, i) => (
                                  <div
                                    key={`bid-${i}`}
                                    className="grid grid-cols-3 text-xs py-1.5 relative"
                                  >
                                    <div
                                      className="absolute left-0 top-0 bottom-0 bg-[rgba(34,197,94,0.15)]"
                                      style={{
                                        width: `${Math.min(
                                          entry.shares / 5000,
                                          100
                                        )}%`,
                                      }}
                                    />
                                    <span className="text-center text-[var(--green)] relative z-10">
                                      {entry.price}¢
                                    </span>
                                    <span className="text-right text-[var(--text-primary)] relative z-10">
                                      {entry.shares.toLocaleString()}
                                    </span>
                                    <span className="text-right text-[var(--text-secondary)] relative z-10">
                                      ${entry.total.toLocaleString()}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Graph 内容 */}
                            {activeTab === "graph" && (
                              <OutcomeGraph
                                percentage={percentage}
                                label={o.label}
                              />
                            )}

                            {/* Resolution 内容 */}
                            {activeTab === "resolution" && (
                              <div className="py-4 text-sm text-[var(--text-secondary)]">
                                <p>{t.market.chart.resolutionSource}</p>
                                <p className="mt-2">
                                  {t.market.chart.resolutionDesc}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 已结算的市场列表 */}
          <div className="mt-8">
            <button
              onClick={() => setShowResolved(!showResolved)}
              className="flex items-center gap-1.5 text-[15px] font-bold text-white hover:text-slate-300 transition-colors px-2 py-4"
            >
              {showResolved ? t.market.hideResolved : t.market.viewResolved}
              {showResolved ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showResolved && (
              <div className="mt-2 transition-all duration-300 border-t border-slate-800/30">
                {/* 1. 移除了这里的 divide-y，改为 flex-col */}
                <div className="flex flex-col">
                  {resolvedOutcomes.map((item, index) => (
                    // 2. 新增外层 Wrapper：专门负责画底部的直线 (border-b)
                    // last:border-0 确保最后一个没有线条
                    <div
                      key={index}
                      className="border-b border-slate-800/30 last:border-0 px-2" // px-2 给左右留白，让线和圆角对齐更好看
                    >
                      {/* 3. 内层 Item：负责圆角背景和悬浮效果 */}
                      {/* 添加了 my-1 (上下间距)，让圆角背景和上下直线之间有空隙 */}
                      <div className="group flex items-center justify-between py-4 px-3 my-1 hover:bg-[rgb(37,52,69)] transition-all duration-100 cursor-pointer rounded-lg">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-500 text-[15px] font-bold w-4 text-center">
                              {item.trend === "up"
                                ? "↑"
                                : item.trend === "down"
                                ? "↓"
                                : ""}
                            </span>
                            <span className="text-[17px] font-bold text-white leading-none group-hover:underline underline-offset-[5px] decoration-1 transition-all">
                              {item.label}
                            </span>
                          </div>
                          <div className="text-[12px] text-slate-500 font-bold ml-7">
                            {item.vol} {t.common.volume}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pr-2">
                          <span className="text-[15px] font-bold text-white">
                            Yes
                          </span>
                          <div className="w-5 h-5 rounded-full bg-[#10b981] flex items-center justify-center">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              className="w-3 h-3 text-white"
                              stroke="currentColor"
                              strokeWidth="4.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Market Context 组件 */}
          <MarketContext
            contextStatus={contextStatus}
            isExpanded={isContextExpanded}
            onExpandToggle={() => setIsContextExpanded(!isContextExpanded)}
            onGenerateClick={handleGenerateClick}
            displayedText={displayedContextText}
            questionText={market.question}
          />

          {/* 规则折叠面板组件 */}
          <Rules
            isExpanded={isRulesExpanded}
            onToggle={() => setIsRulesExpanded(!isRulesExpanded)}
          />

          {/* 评论区 */}
          <MarketDetailTabs marketId={market.id} />
        </div>

        {/* 右侧边栏 - Sticky */}
        <div className="col-span-12 lg:col-span-4 pt-8">
          <div className="sticky top-[calc(120px+2rem)] max-h-[calc(100vh-var(--topbar-height))] overflow-y-auto flex flex-col gap-8 py-8 scrollbar-hide">
            {/* 相关推荐 */}
            <div className="pt-4 border-t border-[var(--border)]">
              <div className="flex overflow-x-auto gap-3 mb-6 scrollbar-hide">
                {["All", "Crypto", "Bitcoin", "Crypto Prices"].map((tab) => (
                  <button
                    key={tab}
                    className={`text-[12px] font-bold whitespace-nowrap px-4 py-2 rounded-full transition-all ${
                      tab === "All"
                        ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="space-y-6">
                {[
                  {
                    q: "Will Gold close at $3,200 or more at the end of 2025?",
                    p: "100%",
                    img: "https://images.unsplash.com/photo-1589118949245-7d38baf380d6?w=100&h=100&fit=crop",
                  },
                  {
                    q: "Will inflation reach more than 3% in 2025?",
                    p: "6%",
                    img: "https://images.unsplash.com/photo-1589118949245-7d38baf380d6?w=100&h=100&fit=crop",
                  },
                  {
                    q: "Will inflation reach more than 3% in 2025?",
                    p: "19%",
                    img: "https://images.unsplash.com/photo-1589118949245-7d38baf380d6?w=100&h=100&fit=crop",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 group cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-[var(--border)] group-hover:border-[var(--text-secondary)] transition-all">
                      <img
                        src={item.img}
                        className="w-full h-full object-cover"
                        alt="related"
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-[14px] font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] leading-tight line-clamp-2 transition-colors">
                        {item.q}
                      </h4>
                    </div>
                    <span className="text-[15px] font-black text-[var(--text-primary)]">
                      {item.p}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
