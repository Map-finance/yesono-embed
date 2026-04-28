"use client";

/**
 * OutcomeList - 选项结果列表（可展开显示详情）
 */

import React, { useState, useMemo, useCallback, useRef, useEffect, memo } from "react";
import { useRouter } from "next/navigation";
import { Market } from "@/types/types";
import { PolymarketMarketResp } from "@/types/home";
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Settings,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import SpotOrderbook from "./SpotOrderbook";
import { useTranslation } from "@/lib/i18n";
import {
  getOutcomeLabel,
  getOutcomesByMarket,
  normalizeBinaryOutcomeLabel,
  sortOutcomesByOriginalIndex,
} from "@/lib/utils/outcomes";
import { formatNumber } from "@/utils/format";
import { formatPercentage } from "@/lib/utils/eventToMarket";
import { useTradingStore } from "@/lib/store/tradingStore";
import { useSingleMarketPriceHistory, TimeRange as ApiTimeRange } from "@/lib/hooks/usePriceHistory";

// UI time range options for sub-chart: 1H, 6H, 1D, 1W, 1M, ALL
type UITimeRange = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";
const timeRanges: UITimeRange[] = ["1H", "6H", "1D", "1W", "1M", "ALL"];

const mapToApiRange = (range: UITimeRange): ApiTimeRange => {
  switch (range) {
    case "1H": return "1H";
    case "6H": return "6H";
    case "1D": return "1D";
    case "1W": return "1W";
    case "1M": return "1M";
    case "ALL": return "ALL";
    default: return "1D";
  }
};

// 使用种子生成伪随机数 (used for mock orderbook data)
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Outcome Graph 组件 - 子图表，使用真实 API 数据
interface OutcomeGraphProps {
  percentage: number;
  change?: number;
  label?: string;
  /** Market ID for API call */
  marketId?: string;
  /** Whether the graph tab is visible (controls polling) */
  isVisible?: boolean;
}

const OutcomeGraph: React.FC<OutcomeGraphProps> = ({
  percentage,
  change,
  label,
  marketId,
  isVisible = true,
}) => {
  const [selectedRange, setSelectedRange] = useState<UITimeRange>("1D");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    autoscale: true,
    xAxis: true,
    yAxis: true,
    horizontalGrid: true,
    verticalGrid: false,
    annotations: true,
  });

  const { t } = useTranslation();

  // Use real API data - polling stops when tab is not visible
  const effectiveMarketId = marketId || '';
  const { data: apiData, loading, currentPrices, error } = useSingleMarketPriceHistory(
    effectiveMarketId,
    mapToApiRange(selectedRange),
    isVisible // Only poll when visible
  );

  // Transform API data for chart
  const chartData = useMemo(() => {
    if (!apiData || apiData.length === 0) return [];
    return apiData.map(point => ({
      date: point.date,
      timestamp: point.timestamp,
      value: point[effectiveMarketId] as number || 0,
    }));
  }, [apiData, effectiveMarketId]);

  // Smart downsample: preserve step-chart transitions, remove only same-value plateaus
  const MAX_DISPLAY_POINTS = 300;
  const displayData = useMemo(() => {
    if (!chartData || chartData.length <= MAX_DISPLAY_POINTS) return chartData;
    // Phase 1: keep all transition points (where value changes)
    const kept = [chartData[0]];
    for (let i = 1; i < chartData.length; i++) {
      const prev = chartData[i - 1];
      const curr = chartData[i];
      const isLast = i === chartData.length - 1;
      if (curr.value !== prev.value || isLast) {
        if (kept[kept.length - 1] !== prev) kept.push(prev);
        kept.push(curr);
      }
    }
    // Phase 2: if still too many, interval-thin
    if (kept.length <= MAX_DISPLAY_POINTS) return kept;
    const step = (kept.length - 2) / (MAX_DISPLAY_POINTS - 2);
    const thinned = [kept[0]];
    for (let i = 1; i < MAX_DISPLAY_POINTS - 1; i++) {
      thinned.push(kept[Math.round(i * step)]);
    }
    thinned.push(kept[kept.length - 1]);
    return thinned;
  }, [chartData]);

  // Calculate current value from API or fallback to percentage
  const currentValue = useMemo(() => {
    const apiPrice = currentPrices[effectiveMarketId];
    if (apiPrice !== undefined) return apiPrice;
    if (chartData.length > 0) return chartData[chartData.length - 1].value;
    return percentage;
  }, [currentPrices, effectiveMarketId, chartData, percentage]);

  // DOM refs for zero-rerender tooltip & chance indicator
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const activeIdxRef = useRef<number>(-1);
  const chanceRef = useRef<HTMLDivElement>(null);
  const prevChanceValRef = useRef<{ current: number; change: number }>({ current: -1, change: 0 });

  // Pre-compute: for each displayData index, the last rounded value that differs from current
  const lastDiffValues = useMemo(() => {
    if (!displayData || displayData.length === 0) return [] as (number | null)[];
    const result: (number | null)[] = [];
    let prevDiffVal: number | null = null;
    let curRounded: number | null = null;
    for (const point of displayData) {
      const v = typeof point.value === 'number' ? point.value : null;
      const rounded = v !== null ? Math.round(v) : null;
      if (rounded !== null && curRounded !== null && rounded !== curRounded) {
        prevDiffVal = curRounded;
      }
      if (rounded !== null) curRounded = rounded;
      result.push(prevDiffVal);
    }
    return result;
  }, [displayData]);

  // Default chance values (last point vs last-different-value point)
  const defaultChance = useMemo(() => {
    if (!displayData || displayData.length < 1) return null;
    const lastIdx = displayData.length - 1;
    const lastVal = typeof displayData[lastIdx].value === 'number' ? displayData[lastIdx].value : null;
    if (lastVal === null) return null;
    const lastDiff = lastDiffValues[lastIdx];
    const change = lastDiff !== null ? Math.round(lastVal) - lastDiff : 0;
    return { current: Math.round(lastVal), change };
  }, [displayData, lastDiffValues]);

  // Helper: update chance indicator DOM — "chance" is static, numbers slide in/out
  const updateChanceDOM = useCallback((current: number, change: number) => {
    const el = chanceRef.current;
    if (!el) return;
    const changeColor = change > 0 ? 'var(--green)' : change < 0 ? 'var(--red)' : 'transparent';
    const arrow = change > 0 ? '\u25b2' : change < 0 ? '\u25bc' : '';
    const changeText = change !== 0 ? `${arrow} ${Math.abs(change)}%` : '';
    const prev = prevChanceValRef.current;
    const valAnim = prev.current !== current ? 'animation:chanceSlideIn .3s ease-out' : '';
    const chgAnim = prev.change !== change ? 'animation:chanceSlideIn .3s ease-out' : '';
    prevChanceValRef.current = { current, change };
    const fs = 'font-size:clamp(16px,2.5vw,20px)';
    // Avoid innerHTML injection: build DOM nodes + textContent
    el.replaceChildren();

    const wrapVal = document.createElement('span');
    wrapVal.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:bottom;height:2.2em';
    const valSpan = document.createElement('span');
    valSpan.style.cssText = `display:inline-block;${fs};font-weight:700;color:#ED6432;${valAnim}`;
    valSpan.textContent = `${current}%`;
    wrapVal.appendChild(valSpan);

    const chanceLabel = document.createElement('span');
    chanceLabel.style.cssText = `${fs};font-weight:700;color:#ED6432;margin:0 4px`;
    chanceLabel.textContent = ` ${t.market.chance}`;

    const wrapChg = document.createElement('span');
    wrapChg.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:bottom;height:1.5em;min-width:55px';
    const chgSpan = document.createElement('span');
    chgSpan.style.cssText = `display:inline-block;font-size:13px;font-weight:600;color:${changeColor};${chgAnim}`;
    chgSpan.textContent = changeText;
    wrapChg.appendChild(chgSpan);

    el.appendChild(wrapVal);
    el.appendChild(chanceLabel);
    el.appendChild(wrapChg);
  }, [t.market.chance]);

  // Populate chance indicator with default values on mount / data change
  useEffect(() => {
    if (defaultChance) updateChanceDOM(defaultChance.current, defaultChance.change);
  }, [defaultChance, updateChanceDOM]);

  // Compute Y-axis domain from data (auto-scale)
  const yDomain = useMemo<[number, number]>(() => {
    if (!chartData || chartData.length === 0) return [0, 100];
    let min = Infinity;
    let max = -Infinity;
    for (const point of chartData) {
      if (typeof point.value === 'number') {
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

  // Format tooltip timestamp
  const formatTooltipTime = useCallback((ts: number) => {
    const d = new Date(ts);
    if (['1H', '6H'].includes(selectedRange)) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    if (selectedRange === '1D') {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }, [selectedRange]);

  const CHART_LEFT = 35;
  const CHART_RIGHT_PAD = 10;

  const handleChartMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = chartContainerRef.current;
    const tooltip = tooltipRef.current;
    const cursor = cursorRef.current;
    if (!container || !tooltip || !cursor || !displayData || displayData.length === 0) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const chartRight = rect.width - CHART_RIGHT_PAD;
    const chartWidth = chartRight - CHART_LEFT;

    if (mouseX < CHART_LEFT || mouseX > chartRight || chartWidth <= 0) {
      tooltip.style.display = 'none';
      cursor.style.display = 'none';
      activeIdxRef.current = -1;
      return;
    }

    const ratio = (mouseX - CHART_LEFT) / chartWidth;
    const idx = Math.max(0, Math.min(displayData.length - 1, Math.round(ratio * (displayData.length - 1))));
    if (idx === activeIdxRef.current) return;
    activeIdxRef.current = idx;

    const point = displayData[idx];
    const pointX = CHART_LEFT + (idx / Math.max(displayData.length - 1, 1)) * chartWidth;

    cursor.style.display = 'block';
    cursor.style.left = `${pointX}px`;

    const ts = point.timestamp as number;
    const val = typeof point.value === 'number' ? point.value.toFixed(1) : '—';
    tooltip.replaceChildren();
    if (ts) {
      const header = document.createElement('div');
      header.style.cssText = 'font-size:12px;color:var(--text-tertiary);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)';
      header.textContent = formatTooltipTime(ts);
      tooltip.appendChild(header);
    }

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px';

    const left = document.createElement('div');
    left.style.cssText = 'display:flex;align-items:center;gap:8px';

    const dot = document.createElement('div');
    dot.style.cssText = 'width:10px;height:10px;border-radius:50%;flex-shrink:0;background:#ED6432';

    const name = document.createElement('span');
    name.style.cssText = 'font-size:12px;color:var(--text-secondary)';
    name.textContent = String(label || 'Value');

    left.appendChild(dot);
    left.appendChild(name);

    const right = document.createElement('span');
    right.style.cssText = 'font-size:12px;font-weight:500;color:var(--text-primary)';
    right.textContent = `${val}%`;

    row.appendChild(left);
    row.appendChild(right);
    tooltip.appendChild(row);
    tooltip.style.display = 'block';
    const tw = tooltip.offsetWidth || 140;
    let tx = pointX + 15;
    if (tx + tw > rect.width) tx = pointX - tw - 15;
    tooltip.style.left = `${tx}px`;
    tooltip.style.top = `${Math.max(10, mouseY - 20)}px`;

    // Update chance indicator: value at hovered point, change vs last different value
    const currVal = typeof point.value === 'number' ? point.value : null;
    if (currVal !== null) {
      const rounded = Math.round(currVal);
      const lastDiff = lastDiffValues[idx];
      const chg = lastDiff !== null ? rounded - lastDiff : 0;
      updateChanceDOM(rounded, chg);
    }
  }, [displayData, formatTooltipTime, label, updateChanceDOM, lastDiffValues]);

  const handleChartMouseLeave = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.display = 'none';
    if (cursorRef.current) cursorRef.current.style.display = 'none';
    activeIdxRef.current = -1;
    // Revert chance indicator to default
    if (defaultChance) updateChanceDOM(defaultChance.current, defaultChance.change);
  }, [defaultChance, updateChanceDOM]);

  // 创建最后一个数据点的 dot 渲染函数
  const createLastDot = (props: any) => {
    const { cx, cy, index } = props;
    if (displayData && displayData.length > 0 && index === displayData.length - 1) {
      return <circle cx={cx} cy={cy} r={5} fill="#ED6432" />;
    }
    return null;
  };

  // 发光效果 CSS + chance 动画
  const glowStyles = `
    path[stroke="#ED6432"] { filter: drop-shadow(rgb(237, 100, 50) 0px 0px 8px) drop-shadow(rgb(237, 100, 50) 0px 0px 4px) !important; }
    circle[fill="#ED6432"] { filter: drop-shadow(rgb(237, 100, 50) 0px 0px 8px) drop-shadow(rgb(237, 100, 50) 0px 0px 4px) !important; }
    @keyframes chanceSlideIn { 0% { transform:translateY(100%); opacity:0; } 100% { transform:translateY(0); opacity:1; } }
  `;

  return (
    <div className="rounded-xl p-4">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full bg-[#ED6432]" />
        <span className="text-sm text-(--text-primary)">{label || t.market.outcome}</span>
        <span className="text-(--text-tertiary) text-sm">
          {currentValue.toFixed(1)}%
        </span>
        {change !== undefined && (
          <span
            className={`text-sm ${change >= 0 ? "text-(--green)" : "text-(--red)"}`}
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
            className={`h-7 px-3 rounded-full text-sm font-normal transition-all ${selectedRange === range
              ? "bg-(--accent) text-(--text-inverse)"
              : "bg-(--bg-secondary) text-(--text-secondary) hover:bg-(--bg-hover)"
              }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* 图表 */}
      <div ref={chartContainerRef} className="relative" style={{ height: "220px" }}>
        <style dangerouslySetInnerHTML={{ __html: glowStyles }} />
        {/* 单曲线 chance 指标 - DOM ref 动态更新 */}
        {!loading && chartData.length > 0 && (
          <div
            ref={chanceRef}
            style={{ top: "-3rem" }}
            className="absolute right-2 z-30 flex items-baseline gap-2 pointer-events-none"
          />
        )}
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-(--text-secondary)" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-(--text-secondary) text-sm">
            {t.common.error}
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-(--text-secondary) text-sm">
            {t.market.common.noData}
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={displayData}
                margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid
                  stroke="var(--border-light)"
                  strokeOpacity={0.5}
                  vertical={settings.verticalGrid}
                  horizontal={settings.horizontalGrid}
                />
                <XAxis
                  dataKey="date"
                  stroke="transparent"
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={60}
                  hide={!settings.xAxis}
                />
                <YAxis
                  hide={!settings.yAxis}
                  domain={settings.autoscale ? yDomain : [0, 100]}
                  tickFormatter={(value: number) => `${value}%`}
                  tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                  tickCount={6}
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
            />
            <div
              ref={cursorRef}
              className="absolute pointer-events-none z-20"
              style={{ display: 'none', top: 10, bottom: 25, width: 0, borderLeft: '1px dashed var(--text-tertiary)' }}
            />
            <div
              ref={tooltipRef}
              className="absolute pointer-events-none z-20 border bg-(--bg-primary) border-(--border) rounded-lg p-3 shadow-xl min-w-[140px]"
              style={{ display: 'none' }}
            />
          </>
        )}
      </div>

      {/* 数据点数量提示 */}
      {!loading && chartData.length > 0 && (
        <div className="text-[10px] text-(--text-tertiary) mt-1">
          {displayData.length}{displayData.length < chartData.length ? ` / ${chartData.length}` : ''} {t.market.chart.dataPoints}
        </div>
      )}

      {/* 底部工具栏 */}
      <div className="flex items-center justify-end mt-2 pt-2 border-t border-(--border)">
        <div className="flex gap-1">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-secondary)"
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
            className="bg-(--bg-card) border border-(--border) rounded-xl p-4 w-[260px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-medium text-(--text-primary) mb-3">
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
                <span className="text-sm text-(--text-secondary)">
                  {item.label}
                </span>
                <button
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      [item.key as keyof typeof prev]:
                        !prev[item.key as keyof typeof prev],
                    }))
                  }
                  className={`w-10 h-5 rounded-full transition-colors relative ${settings[item.key as keyof typeof settings] ? "bg-[#3b82f6]" : "bg-(--bg-secondary)"}`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${settings[item.key as keyof typeof settings] ? "left-5" : "left-0.5"}`}
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


const BuyButton: React.FC<{
  label: string;
  price: string;
  color: "yes" | "no";
  selected: boolean;
  onClick?: () => void;
  className?: string;
}> = ({ label, price, color, selected, onClick, className = "" }) => {
  const yesSelected = "bg-[#22c55e] text-white border-[#22c55e] hover:bg-[#16a34a]";
  const yesDefault = "bg-[rgba(34,197,94,0.15)] text-[#22c55e] border-[rgba(34,197,94,0.3)] hover:bg-[rgba(34,197,94,0.25)]";

  const noSelected = "bg-[#ef4444] text-white border-[#ef4444] hover:bg-[#dc2626]";
  const noDefault = "bg-[rgba(239,68,68,0.15)] text-[#ef4444] border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.25)]";

  const colorStyles = color === "yes"
    ? (selected ? yesSelected : yesDefault)
    : (selected ? noSelected : noDefault);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick();
      }}
      className={`px-5 py-2.5 w-[148px] space-x-1 flex items-center shrink-0 rounded-lg text-base font-bold whitespace-nowrap border transition-colors ${colorStyles} ${className}`}
    >
      <span className="flex-1 truncate">{label}</span>
      <span>{price}</span>
    </button>
  );
};

const formatButtonPrice = (rawPrice: number) => {
  const priceInCents = rawPrice * 100;
  return priceInCents.toFixed(1) + "¢";
};

interface DisplayOption {
  label: string;
  percentage: number;
  yesPriceRaw: number;
  noPriceRaw: number;
  change?: number;
  marketId: string | number;
  questionID?: string;
  eventId?: string;
  clobTokenIds: string[];
  isResolved: boolean;
  resolvedOutcome?: string;
  icon?: string;
  volume: number;
  marketData: any;
}

interface OutcomeRowProps {
  option: DisplayOption;
  index: number;
  isExpanded: boolean;
  selectOutcomeId: string | null;
  marketId: string;
  onToggleExpand: (index: number, e: React.MouseEvent) => void;
  onSelectOutcomeId: (id: string) => void;
  onSelectOutcome: (option: DisplayOption, tokenId: string) => void;
  onMobileTrade?: (index: number, side: "yes" | "no") => void;
}

const OutcomeRow = memo(({
  option,
  index,
  isExpanded,
  selectOutcomeId,
  marketId,
  onToggleExpand,
  onSelectOutcomeId,
  onSelectOutcome,
  onMobileTrade
}: OutcomeRowProps) => {
  const { t } = useTranslation();
  // 精准 selector：只在 direction / market 变化时重渲染
  // orderBookRaw 订阅独立保留，仅用于触发实时价格更新（已被 tradingStore 节流到 500ms）
  const direction = useTradingStore((s) => s.direction);
  const market = useTradingStore((s) => s.market);
  const getOrderBook = useTradingStore((s) => s.getOrderBook);
  useTradingStore((s) => s.orderBookRaw); // 订阅 orderBookRaw 变化以刷新买卖盘价格

  const [activeTab, setActiveTab] = useState<"orderbook" | "graph" | "resolution">("orderbook");

  // token ids (prefer clobTokenIds, fallback to parsedTokenIds)
  const volume = option.volume;
  const tokenIds = useMemo(() => {
    if (option.clobTokenIds.length > 0) {
      return option.clobTokenIds;
    }
    const clobTokenIdsJson = option.marketData?.clobTokenIds || "[]"
    try {
      const parsed = JSON.parse(clobTokenIdsJson);
      if (Array.isArray(parsed) && parsed.every((id) => typeof id === "string")) {
        return parsed;
      }
    } catch (e) {
      console.warn("Failed to parse clobTokenIds from marketData:", e);
    }
    return [];
  }, [option.clobTokenIds, option.marketData.clobTokenIds])

  const yesTokenId = tokenIds[0] || "";
  const noTokenId = tokenIds[1] || "";
  const marketOutcomes = useMemo(
    () => (option.marketData.marketOutcomes || []) as any[],
    [option.marketData.marketOutcomes]
  );

  const sortedOutcomes = useMemo(
    () => sortOutcomesByOriginalIndex(marketOutcomes),
    [marketOutcomes]
  );

  const [yesAssetId, noAssetId] = useMemo(() => {
    const yes = sortedOutcomes[0];
    const no = sortedOutcomes[1];
    return [
      String(yes?.tradingPair || yes?.tokenId || ""),
      String(no?.tradingPair || no?.tokenId || ""),
    ];
  }, [sortedOutcomes]);

  const [yesLabel, noLabel] = useMemo(() => {
    if (sortedOutcomes.length >= 2) {
      const label0 = getOutcomeLabel(sortedOutcomes[0]);
      const label1 = getOutcomeLabel(sortedOutcomes[1]);
      return [
        normalizeBinaryOutcomeLabel(label0, t.common.yes as string, {
          yes: t.common.yes as string,
          no: t.common.no as string,
          up: t.common.up as string,
          down: t.common.down as string,
        }),
        normalizeBinaryOutcomeLabel(label1, t.common.no as string, {
          yes: t.common.yes as string,
          no: t.common.no as string,
          up: t.common.up as string,
          down: t.common.down as string,
        }),
      ];
    }
    return [t.common.yes as string, t.common.no as string];
  }, [
    sortedOutcomes,
    t.common.yes,
    t.common.no,
    t.common.up,
    t.common.down,
  ]);

  // 订单簿的 key 必须与 WS 推送的 asset_id 一致：这里是 tradingPair（如 `${marketId}-YES-USDT`）。
  // tokenId / clobTokenIds 是链上 tokenId，不用于索引 WS 订单簿，避免出现“看得到挂单但取不到深度”的问题。
  const yesOrderBook = getOrderBook(yesAssetId || "");
  const noOrderBook = getOrderBook(noAssetId || "");

  const yesRaw = useMemo(() => {
    if (market?.id === option.marketId) {
      return direction === "BUY"
        ? (yesOrderBook?.bestAsk || option.yesPriceRaw)
        : (yesOrderBook?.bestBid || option.yesPriceRaw);
    }
    return option.yesPriceRaw;
  }, [market, option.marketId, direction, yesOrderBook, option.yesPriceRaw]);

  const noRaw = useMemo(() => {
    if (market?.id === option.marketId) {
      return direction === "BUY"
        ? (noOrderBook?.bestAsk || option.noPriceRaw)
        : (noOrderBook?.bestBid || option.noPriceRaw);
    }
    return option.noPriceRaw;
  }, [market, option.marketId, direction, noOrderBook, option.noPriceRaw]);

  const yesPrice = formatButtonPrice(yesRaw);
  const noPrice = formatButtonPrice(noRaw);

  const tabs = [
    { id: "orderbook", label: t.market.orderBook },
    { id: "graph", label: t.market.chart.graph },
    { id: "resolution", label: t.market.chart.resolution },
  ] as const;

  return (
    <div
      className={`rounded-xl border transition-all ${isExpanded
        ? "border-(--accent) bg-(--bg-card)"
        : "border-(--border) bg-(--bg-card) hover:border-(--border-light)"
        }`}
    >
      {/* Desktop Layout */}
      <div
        onClick={(e) => onToggleExpand(index, e)}
        className="hidden lg:flex items-center justify-between p-4 cursor-pointer"
      >
        <div className="flex-1">
          <div className="font-medium text-(--text-primary)">
            {option.label}
          </div>
          <div className="text-xs text-(--text-secondary) mt-1">
            {formatNumber(Number(volume))} {t.common.volume}
          </div>
        </div>

        <div className="w-24 text-center">
          {!option.isResolved && (
            <>
              <span className="text-lg font-semibold text-(--text-primary)">
                {formatPercentage(option.percentage)}
              </span>
              {option.change !== undefined && (
                <span
                  className={`ml-2 text-xs ${option.change >= 0 ? "text-(--green)" : "text-(--red)"}`}
                >
                  {option.change >= 0 ? "▲" : "▼"}
                  {Math.abs(option.change)}%
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3 justify-end">
          {option.isResolved ? (
            <div className="px-4 py-2 rounded-lg bg-[rgba(59,130,246,0.15)] text-[#3b82f6] border border-[rgba(59,130,246,0.3)] font-medium">
              {t.market.resolved}: {option.resolvedOutcome || yesLabel}
            </div>
          ) : (
            <>
              <BuyButton
                label={`${direction === "BUY" ? t.common.buy : t.common.sell} ${yesLabel}`}
                price={yesPrice}
                color="yes"
                selected={selectOutcomeId === yesTokenId}
                onClick={() => onSelectOutcome(option, yesTokenId)}
              />
              <BuyButton
                label={`${direction === "BUY" ? t.common.buy : t.common.sell} ${noLabel}`}
                price={noPrice}
                color="no"
                selected={selectOutcomeId === noTokenId}
                onClick={() => onSelectOutcome(option, noTokenId)}
              />
            </>
          )}
          {isExpanded ? (
            <ChevronUp size={20} className="text-(--text-secondary)" />
          ) : (
            <ChevronDown size={20} className="text-(--text-secondary)" />
          )}
        </div>
      </div>

      {/* Mobile Layout */}
      <div
        onClick={(e) => onToggleExpand(index, e)}
        className="lg:hidden p-4 cursor-pointer"
      >
        <div className="flex items-start justify-between mb-1">
          <div className="flex-1">
            <div className="font-semibold text-lg text-(--text-primary)">
              {option.label}
            </div>
            <div className="text-sm text-(--text-secondary) mt-0.5">
              {formatNumber(Number(volume))} {t.common.volume}
            </div>
          </div>
          {!option.isResolved && (
            <span className="text-2xl font-bold text-(--text-primary)">
              {formatPercentage(option.percentage)}
            </span>
          )}
        </div>

        {option.isResolved ? (
          <div className="mt-3 py-3 rounded-lg text-center bg-[rgba(59,130,246,0.15)] text-[#3b82f6] border border-[rgba(59,130,246,0.3)] font-medium">
            {t.market.resolved}: {option.resolvedOutcome || yesLabel}
          </div>
        ) : (
          <div className="flex gap-3 mt-3">
            <BuyButton
              label={`${direction === "BUY" ? t.common.buy : t.common.sell} ${yesLabel}`}
              price={yesPrice}
              color="yes"
              selected={selectOutcomeId === yesTokenId}
              onClick={() => {
                onSelectOutcome(option, yesTokenId);
                if (onMobileTrade) onMobileTrade(index, "yes");
              }}
              className="flex-1"
            />
            <BuyButton
              label={`${direction === "BUY" ? t.common.buy : t.common.sell} ${noLabel}`}
              price={noPrice}
              color="no"
              selected={selectOutcomeId === noTokenId}
              onClick={() => {
                onSelectOutcome(option, noTokenId);
                if (onMobileTrade) onMobileTrade(index, "no");
              }}
              className="flex-1"
            />
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-(--border)">
          <div className="flex items-center justify-between py-3">
            <div className="flex gap-4">
              {tabs
                .filter((tab) => !option.isResolved || tab.id !== "orderbook")
                .map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`text-sm font-medium transition-colors ${activeTab === tab.id
                      ? "text-(--text-primary)"
                      : "text-(--text-secondary) hover:text-(--text-primary)"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
            </div>
          </div>

          {activeTab === "orderbook" && !option.isResolved && (
            <SpotOrderbook
              ticker={`${marketId}-${option.label}`}
              basePrice={option.percentage / 100}
              label={option.label}
              marketId={String(option.marketId)}
              marketSource={option.marketData?.source}
              marketOutcomes={option.marketData?.marketOutcomes}
              selectedSide={selectOutcomeId === noTokenId ? 'no' : 'yes'}
              onSideChange={(side) => onSelectOutcomeId(side === 'no' ? noTokenId : yesTokenId)}
            />
          )}

          {activeTab === "graph" && (
            <OutcomeGraph
              percentage={option.percentage}
              change={option.change}
              label={option.label}
              marketId={String(option.marketId)}
              isVisible={isExpanded && activeTab === "graph"}
            />
          )}

          {activeTab === "resolution" && (
            <div className="py-4 text-sm text-(--text-secondary)">
              <p>{t.market.chart.resolutionSource}</p>
              <p className="mt-2">
                {t.market.chart.resolutionDesc}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  if (prev.option !== next.option) return false;
  if (prev.index !== next.index) return false;
  if (prev.isExpanded !== next.isExpanded) return false;
  if (prev.marketId !== next.marketId) return false;

  // If only selectOutcomeId changed
  if (prev.selectOutcomeId !== next.selectOutcomeId) {
    const tokenIds = next.option.clobTokenIds.length > 0
      ? next.option.clobTokenIds
      : (() => {
          const clobTokenIdsJson = next.option.marketData?.clobTokenIds || "[]";
          try {
            const parsed = JSON.parse(clobTokenIdsJson);
            return Array.isArray(parsed) && parsed.every((id) => typeof id === "string")
              ? parsed
              : [];
          } catch (e) {
            console.warn('[OutcomeList] Failed to parse clobTokenIds', e);
            return [];
          }
        })();
    const yesId = tokenIds[0];
    const noId = tokenIds[1];
    const prevRelated = prev.selectOutcomeId === yesId || prev.selectOutcomeId === noId;
    const nextRelated = next.selectOutcomeId === yesId || next.selectOutcomeId === noId;
    // If neither were related, no need to update.
    if (!prevRelated && !nextRelated) return true;
    // If relevant changed, or relevance changed, update.
    return false;
  }

  return true;
});
OutcomeRow.displayName = 'OutcomeRow';

interface OutcomeListProps {
  market: Market;
  onMobileTrade?: (outcomeIndex: number, side: "yes" | "no") => void;
  /** Event markets from API - each market becomes an outcome row */
  eventMarkets?: PolymarketMarketResp[];
  /** Callback when market selection changes, passes market info */
  onMarketSelect?: (marketInfo: {
    isResolved: boolean;
    resolvedOutcome?: string;
    title: string;
    percentage?: number;
    icon?: string;
    marketId: string;
    questionID: string;
    eventId?: string;
  }) => void;
}

interface OrderBookEntry {
  price: number;
  shares: number;
  total: number;
}

// 生成模拟订单簿数据
const generateOrderBook = (
  percentage: number,
): { asks: OrderBookEntry[]; bids: OrderBookEntry[] } => {
  const basePrice = percentage / 100;
  const asks: OrderBookEntry[] = [];
  const bids: OrderBookEntry[] = [];

  // Asks (卖单) - 价格从低到高，增加更多数据以测试滚动
  for (let i = 0; i < 8; i++) {
    const price = Math.round((basePrice + 0.001 + i * 0.001) * 1000) / 10;
    const shares = Math.round(
      seededRandom(percentage * 100 + i) * 400000 + 3000,
    );
    asks.push({ price, shares, total: Math.round((shares * price) / 100) });
  }

  // Bids (买单) - 价格从高到低，增加更多数据以测试滚动
  for (let i = 0; i < 8; i++) {
    const price = Math.round((basePrice - 0.001 - i * 0.001) * 1000) / 10;
    const shares = Math.round(
      seededRandom(percentage * 100 + i + 100) * 400000 + 3000,
    );
    bids.push({ price, shares, total: Math.round((shares * price) / 100) });
  }

  return { asks: asks.reverse(), bids };
};

const OutcomeList: React.FC<OutcomeListProps> = ({
  market,
  onMobileTrade,
  eventMarkets,
  onMarketSelect,
}) => {
  // 精准 selector，避免 orderBookRaw 高频更新时重渲染整个列表容器
  const selectOutcomeId = useTradingStore((s) => s.selectOutcomeId);
  const setSelectOutcomeId = useTradingStore((s) => s.setSelectOutcomeId);
  const setMarket = useTradingStore((s) => s.setMarket);
  // 记录已初始化过默认选中的 marketId，避免重复设置覆盖用户点击
  const defaultSelectedMarketIdRef = useRef<string | null>(null);
  // 如果有 eventMarkets，将其转换为 options 格式显示
  const displayOptions = useMemo(() => {
    if (eventMarkets && eventMarkets.length > 0) {
      return eventMarkets.map((m) => {
        // PolymarketMarketResp 的 outcomes 和 outcomePrices 是 JSON 字符串
        let yesPercentage = 50; // 用于百分比显示
        let yesPriceRaw = 0; // 用于 buy yes 按钮价格 (来自 outcomePrices)
        let noPriceRaw = 0; // 用于 buy no 按钮价格 (来自 outcomePrices)
        let tokenIds: string[] = [];
        try {
          const outcomes = getOutcomesByMarket(m);
          const prices = JSON.parse(m.outcomePrices || "[]") as number[];
          const yesIndex = outcomes.findIndex((o) => o.toLowerCase() === "yes");
          const noIndex = outcomes.findIndex((o) => o.toLowerCase() === "no");

          // outcomePrices 用于 buy yes/buy no 按钮价格
          if (yesIndex >= 0 && prices[yesIndex] !== undefined) {
            yesPriceRaw = prices[yesIndex];
          }
          if (noIndex >= 0 && prices[noIndex] !== undefined) {
            noPriceRaw = prices[noIndex];
          } else if (prices.length > 1) {
            noPriceRaw = prices[1];
          }

          // rowOutcomePrice 用于百分比显示（优先）
          const rowPrices = (m as any).rowOutcomePrice
            ? JSON.parse((m as any).rowOutcomePrice)
            : null;
          if (rowPrices && rowPrices.length > 0) {
            yesPercentage = Math.round(parseFloat(rowPrices[0]) * 100);
          } else {
            // fallback 到 outcomePrices
            yesPercentage = Math.round(yesPriceRaw * 100);
          }

          // 解析 clobTokenIds
          tokenIds = JSON.parse(m.clobTokenIds || "[]") as string[];
        } catch (err) {
          console.error("Error parsing clobTokenIds:", err);
        }
        // 判断解决结果
        let resolvedOutcome: string | undefined;
        if (
          m.umaResolutionStatus === "RESOLVED" ||
          (m as any).status === "RESOLVED"
        ) {
          // 找出获胜的 outcome（价格为 1 的那个，或价格最高的那个作为 fallback）
          try {
            const outcomes = getOutcomesByMarket(m);
            const prices = JSON.parse(m.outcomePrices || "[]") as number[];
            const winnerIndex = prices.findIndex((p) => p >= 0.99);
            if (winnerIndex >= 0) {
              resolvedOutcome = outcomes[winnerIndex];
            } else if (outcomes.length > 0) {
              // 价格未更新为 1/0 时，取价格最高的 outcome 作为 fallback
              let maxIdx = 0;
              for (let i = 1; i < prices.length; i++) {
                if (prices[i] > prices[maxIdx]) maxIdx = i;
              }
              resolvedOutcome = outcomes[maxIdx];
            }
          } catch (e) {
            console.error('[OutcomeList] Failed to determine resolved outcome', e);
          }
        }
        return {
          label: m.groupItemTitle || m.question || "Market",
          percentage: yesPercentage,
          yesPriceRaw, // outcomePrices[0] 原始值
          noPriceRaw, // outcomePrices[1] 原始值
          change: m.oneDayPriceChange
            ? Math.round(m.oneDayPriceChange * 100)
            : undefined,
          marketId: m.id,
          questionID: m.conditionId,
          clobTokenIds: tokenIds,
          isResolved:
            m.umaResolutionStatus === "RESOLVED" ||
            (m as any).status === "RESOLVED",
          resolvedOutcome,
          icon: m.icon || m.image,
          eventId: m.eventId,
          volume: m.volume || 0,
          marketData: m,
        };
      });
    }
    // fallback 到原有的 market.options
    return market.options.map((opt, idx) => ({
      ...opt,
      yesPriceRaw: opt.percentage / 100,
      noPriceRaw: (100 - opt.percentage) / 100,
      marketId: idx.toString(),
      questionID: '',
      clobTokenIds: [] as string[],
      isResolved: false,
      resolvedOutcome: undefined,
      icon: market.icon,
      eventId: undefined as string | undefined,
      volume: 0,
      marketData: null,
    }));
  }, [eventMarkets, market.options, market.icon]);

  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const { t } = useTranslation();

  // 分离 active 和 resolved markets
  const { activeOptions, resolvedOptions } = useMemo(() => {
    const active = displayOptions.filter((opt) => !opt.isResolved);
    const resolved = displayOptions.filter((opt) => opt.isResolved);
    return { activeOptions: active, resolvedOptions: resolved };
  }, [displayOptions]);

  // 记录上次已通知父组件/store 的 marketId，防止 activeOptions 引用变化时重复调用 setMarket
  // setMarket 内部会关闭旧 WS 并打开新 WS，频繁调用会造成不必要的 WS 重连
  const lastNotifiedMarketIdRef = useRef<string | null>(null);

  const handleToggleExpand = (index: number, e: React.MouseEvent, option: any) => {
    e.stopPropagation();

    // 已结算的 outcome 不允许跳转到移动端详情页
    if (option.isResolved) return;

    // 移动端跳转到新页面 - 使用原始 displayOptions 中的真实索引
    if (window.innerWidth < 1024) {
      const realIndex = displayOptions.findIndex(
        (opt) => String(opt.marketId) === String(option.marketId)
      );
      const navIndex = realIndex >= 0 ? realIndex : index;
      router.push(`/market/${market.slug || market.id}/outcome/${navIndex}`);
      return;
    }
    // 桌面端展开/收起
    setExpandedIndex(expandedIndex === index ? null : index);
    if (option.marketData) setMarket(option.marketData);
    // 通知父组件当前选中的 market 信息
    if (onMarketSelect) {
      onMarketSelect({
        isResolved: option.isResolved,
        resolvedOutcome: option.resolvedOutcome,
        title: option.label,
        percentage: option.percentage,
        icon: option.icon,
        marketId: option.marketId,
        questionID: option.questionID,
        eventId: option.eventId,
      });
    }
  };

  // 点击 Yes/No 按钮时，如果点击的行不是当前选中的市场，先切换市场再设置 outcome
  const handleSelectOutcome = React.useCallback((option: DisplayOption, tokenId: string) => {
    const currentMarketId = market?.id;
    const targetMarketId = String(option.marketId);
    if (currentMarketId !== targetMarketId && option.marketData) {
      setMarket(option.marketData);
      lastNotifiedMarketIdRef.current = targetMarketId;
      if (onMarketSelect) {
        onMarketSelect({
          isResolved: option.isResolved,
          resolvedOutcome: option.resolvedOutcome,
          title: option.label,
          percentage: option.percentage,
          icon: option.icon,
          marketId: String(option.marketId),
          questionID: option.questionID || '',
          eventId: option.eventId,
        });
      }
      // setMarket 会默认选第一个 clobTokenId，需要覆盖为用户点击的 tokenId
      // 使用 setTimeout 确保在 setMarket 完成后再设置
      setTimeout(() => setSelectOutcomeId(tokenId), 0);
    } else {
      setSelectOutcomeId(tokenId);
    }
  }, [market?.id, setMarket, setSelectOutcomeId, onMarketSelect]);

  // 默认选中第一个非 resolved 的 market 的 buy yes
  React.useEffect(() => {
    // 优先选中第一个 active market，如果没有则选中第一个 resolved market
    const firstOpt = activeOptions.length > 0 ? activeOptions[0] : resolvedOptions[0];
    if (!firstOpt) return;

    const marketId = String(firstOpt.marketId);

    // 仅在 market 真正切换时才调用 setMarket
    // 防止 activeOptions 引用变化（但内容相同）时触发不必要的 WS 重连
    if (marketId !== lastNotifiedMarketIdRef.current) {
      lastNotifiedMarketIdRef.current = marketId;

      if (firstOpt.marketData) {
        setMarket(firstOpt.marketData);
      }
      if (onMarketSelect) {
        onMarketSelect({
          isResolved: firstOpt.isResolved,
          resolvedOutcome: firstOpt.resolvedOutcome,
          title: firstOpt.label,
          percentage: firstOpt.percentage,
          icon: firstOpt.icon,
          marketId: firstOpt.marketId,
          questionID: firstOpt.questionID,
          eventId: firstOpt.eventId,
        });
      }

      // 默认选中第一个非已结算 outcome 的 buy yes（clobTokenIds[0] 为 YES token）
      // 仅在尚未初始化默认选中时执行，避免覆盖用户的点击选择
      if (!firstOpt.isResolved && defaultSelectedMarketIdRef.current !== marketId) {
        defaultSelectedMarketIdRef.current = marketId;
        const yesTokenId = firstOpt.clobTokenIds[0] || '';
        if (yesTokenId) {
          // setMarket 内部会设置 selectOutcomeId = clobTokenIds[0]，此处再次确保一致
          setTimeout(() => setSelectOutcomeId(yesTokenId), 0);
        }
      }
    }
  }, [activeOptions, resolvedOptions, setMarket, setSelectOutcomeId, onMarketSelect]);

  return (
    <div className="mt-4">
      {/* 表头 */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-(--text-secondary) uppercase">
        <span className="flex-1">{t.market.outcome}</span>
        <span className="w-24 text-center">{`% ${t.common.chance} ⇅`}</span>
        <span className="w-48"></span>
      </div>

      <div className="space-y-2 max-h-[800px] overflow-y-auto scrollbar-hide">
        {/* Active markets */}
        {activeOptions.map((option, index) => (
          <OutcomeRow
            key={index}
            option={option}
            index={index}
            isExpanded={expandedIndex === index}
            selectOutcomeId={selectOutcomeId}
            marketId={market.id}
            onToggleExpand={(idx, e) => handleToggleExpand(idx, e, option)}
            onSelectOutcomeId={setSelectOutcomeId}
            onSelectOutcome={handleSelectOutcome}
            onMobileTrade={onMobileTrade}
          />
        ))}

        {/* Show Resolved 按钮 */}
        {resolvedOptions.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => setShowResolved(!showResolved)}
              className="w-full py-3 px-4 rounded-lg border border-(--border) bg-(--bg-secondary) hover:bg-(--bg-hover) text-sm text-(--text-primary) font-medium transition-colors flex items-center justify-center gap-2"
            >
              {showResolved ? (
                <>
                  <ChevronUp size={16} />
                  {t.market.hideResolved || "Hide Resolved"} ({resolvedOptions.length})
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  {t.market.viewResolved || "View Resolved"} ({resolvedOptions.length})
                </>
              )}
            </button>
          </div>
        )}

        {/* Resolved markets */}
        {showResolved && resolvedOptions.map((option, index) => {
          const actualIndex = activeOptions.length + index;
          return (
            <OutcomeRow
              key={actualIndex}
              option={option}
              index={actualIndex}
              isExpanded={expandedIndex === actualIndex}
              selectOutcomeId={selectOutcomeId}
              marketId={market.id}
              onToggleExpand={(idx, e) => handleToggleExpand(idx, e, option)}
              onSelectOutcomeId={setSelectOutcomeId}
              onSelectOutcome={handleSelectOutcome}
              onMobileTrade={onMobileTrade}
            />
          );
        })}
      </div>
    </div>
  );
};



export default OutcomeList;
