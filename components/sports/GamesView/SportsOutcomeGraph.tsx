"use client";

/**
 * SportsOutcomeGraph - 体育赛事内嵌价格曲线
 * 参考 OutcomeList.tsx 中的 OutcomeGraph 实现
 * 使用 useSingleMarketPriceHistory 获取单个 market 的价格数据
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useSingleMarketPriceHistory, TimeRange } from "@/lib/hooks/usePriceHistory";

type UITimeRange = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";
const timeRanges: UITimeRange[] = ["1H", "6H", "1D", "1W", "1M", "ALL"];

const mapToApiRange = (range: UITimeRange): TimeRange => range as TimeRange;

interface SportsOutcomeGraphProps {
  /** Market ID for price history API */
  marketId: string;
  /** Display label */
  label?: string;
  /** Whether this graph is visible (controls polling) */
  isVisible?: boolean;
}

const SportsOutcomeGraph: React.FC<SportsOutcomeGraphProps> = ({
  marketId,
  label,
  isVisible = true,
}) => {
  const { t } = useTranslation();
  const [selectedRange, setSelectedRange] = useState<UITimeRange>("1D");

  const {
    data: apiData,
    loading,
    currentPrices,
    error,
  } = useSingleMarketPriceHistory(
    marketId || null,
    mapToApiRange(selectedRange),
    isVisible
  );

  // Transform API data for chart
  const chartData = useMemo(() => {
    if (!apiData || apiData.length === 0) return [];
    return apiData.map((point) => ({
      date: point.date,
      timestamp: point.timestamp,
      value: (point[marketId] as number) || 0,
    }));
  }, [apiData, marketId]);

  // Smart downsample
  const MAX_DISPLAY_POINTS = 300;
  const displayData = useMemo(() => {
    if (!chartData || chartData.length <= MAX_DISPLAY_POINTS) return chartData;
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
    if (kept.length <= MAX_DISPLAY_POINTS) return kept;
    const step = (kept.length - 2) / (MAX_DISPLAY_POINTS - 2);
    const thinned = [kept[0]];
    for (let i = 1; i < MAX_DISPLAY_POINTS - 1; i++) {
      thinned.push(kept[Math.round(i * step)]);
    }
    thinned.push(kept[kept.length - 1]);
    return thinned;
  }, [chartData]);

  // Current value
  const currentValue = useMemo(() => {
    const apiPrice = currentPrices[marketId];
    if (apiPrice !== undefined) return apiPrice;
    if (chartData.length > 0) return chartData[chartData.length - 1].value;
    return 50;
  }, [currentPrices, marketId, chartData]);

  // Y-axis domain
  const yDomain = useMemo<[number, number]>(() => {
    if (!chartData || chartData.length === 0) return [0, 100];
    let min = Infinity;
    let max = -Infinity;
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

  // Tooltip refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const activeIdxRef = useRef<number>(-1);

  const CHART_LEFT = 35;
  const CHART_RIGHT_PAD = 10;

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
        CHART_LEFT +
        (idx / Math.max(displayData.length - 1, 1)) * chartWidth;

      cursor.style.display = "block";
      cursor.style.left = `${pointX}px`;

      const ts = point.timestamp as number;
      const val =
        typeof point.value === "number" ? point.value.toFixed(1) : "—";
      tooltip.replaceChildren();
      if (ts) {
        const header = document.createElement("div");
        header.style.cssText =
          "font-size:12px;color:var(--text-tertiary);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)";
        header.textContent = formatTooltipTime(ts);
        tooltip.appendChild(header);
      }

      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;align-items:center;justify-content:space-between;gap:12px";

      const left = document.createElement("div");
      left.style.cssText = "display:flex;align-items:center;gap:8px";

      const dot = document.createElement("div");
      dot.style.cssText =
        "width:10px;height:10px;border-radius:50%;flex-shrink:0;background:#ED6432";

      const name = document.createElement("span");
      name.style.cssText = "font-size:12px;color:var(--text-secondary)";
      name.textContent = String(label || "Value");

      left.appendChild(dot);
      left.appendChild(name);

      const right = document.createElement("span");
      right.style.cssText =
        "font-size:12px;font-weight:500;color:var(--text-primary)";
      right.textContent = `${val}%`;

      row.appendChild(left);
      row.appendChild(right);
      tooltip.appendChild(row);
      tooltip.style.display = "block";
      const tw = tooltip.offsetWidth || 140;
      let tx = pointX + 15;
      if (tx + tw > rect.width) tx = pointX - tw - 15;
      tooltip.style.left = `${tx}px`;
      tooltip.style.top = `${Math.max(10, e.clientY - rect.top - 20)}px`;
    },
    [displayData, formatTooltipTime, label]
  );

  const handleChartMouseLeave = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.display = "none";
    if (cursorRef.current) cursorRef.current.style.display = "none";
    activeIdxRef.current = -1;
  }, []);

  const createLastDot = (props: any) => {
    const { cx, cy, index } = props;
    if (displayData && displayData.length > 0 && index === displayData.length - 1) {
      return <circle cx={cx} cy={cy} r={5} fill="#ED6432" />;
    }
    return null;
  };

  const glowStyles = `
    path[stroke="#ED6432"] { filter: drop-shadow(rgb(237, 100, 50) 0px 0px 8px) drop-shadow(rgb(237, 100, 50) 0px 0px 4px) !important; }
    circle[fill="#ED6432"] { filter: drop-shadow(rgb(237, 100, 50) 0px 0px 8px) drop-shadow(rgb(237, 100, 50) 0px 0px 4px) !important; }
  `;

  return (
    <div className="rounded-xl p-4 max-sm:p-2">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="w-3 h-3 rounded-full bg-[#ED6432] shrink-0" />
        <span className="text-sm text-(--text-primary) truncate max-w-[60%]">
          {label || "Price"}
        </span>
        <span className="text-(--text-tertiary) text-sm shrink-0">
          {currentValue.toFixed(1)}%
        </span>
      </div>

      {/* 时间范围选择器 */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {timeRanges.map((range) => (
          <button
            key={range}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRange(range);
            }}
            className={`h-7 px-2 sm:px-3 rounded-full text-xs sm:text-sm font-normal transition-all ${
              selectedRange === range
                ? "bg-(--accent) text-(--text-inverse)"
                : "bg-(--bg-secondary) text-(--text-secondary) hover:bg-(--bg-hover)"
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* 图表 */}
      <div ref={chartContainerRef} className="relative" style={{ height: "200px" }}>
        <style dangerouslySetInnerHTML={{ __html: glowStyles }} />
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-(--text-secondary)" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full text-(--text-secondary) text-sm">
            {t.common.error || "Error"}
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-(--text-secondary) text-sm">
            No data
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
                  vertical={false}
                  horizontal={true}
                />
                <XAxis
                  dataKey="date"
                  stroke="transparent"
                  tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={60}
                />
                <YAxis
                  domain={yDomain}
                  tickFormatter={(value: number) => `${value}%`}
                  tick={{ fill: "var(--text-tertiary)", fontSize: 10 }}
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
              style={{
                display: "none",
                top: 10,
                bottom: 25,
                width: 0,
                borderLeft: "1px dashed var(--text-tertiary)",
              }}
            />
            <div
              ref={tooltipRef}
              className="absolute pointer-events-none z-20 border bg-(--bg-primary) border-(--border) rounded-lg p-3 shadow-xl min-w-[140px]"
              style={{ display: "none" }}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default SportsOutcomeGraph;
