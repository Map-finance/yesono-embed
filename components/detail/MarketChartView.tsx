"use client";

/**
 * MarketChartView - MarketChart 的纯展示子组件。
 * 包含：图例、时间范围选择器、单曲线 chance 指示器、recharts 折线图、
 *      自定义 tooltip / cursor、自动 Y 轴域、数据点稀释、发光 CSS。
 *
 * 从 MarketChart.tsx 拆出，机械搬运无修改。
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  CHART_LEFT,
  CHART_RIGHT_PAD,
  MAX_DISPLAY_POINTS,
  colors,
  getColorRgb,
  timeRanges,
  type UITimeRange,
} from "./MarketChart.helpers";
import type { MarketChartSettings } from "./MarketChartSettingsModal";

interface DisplayOption {
  label: string;
  marketId: string;
}

interface MarketChartViewProps {
  displayOptions: DisplayOption[];
  selectedOptions: number[];
  /** raw price-history rows, 每行包含 timestamp + 各 marketId 的数值 */
  chartData: Array<Record<string, any>>;
  loading: boolean;
  error: unknown;
  /** key = displayOptions index, value = 当前百分比字符串 */
  currentPercentages: Record<number, string>;
  selectedRange: UITimeRange;
  onRangeChange: (range: UITimeRange) => void;
  settings: MarketChartSettings;
}

const MarketChartView: React.FC<MarketChartViewProps> = ({
  displayOptions,
  selectedOptions,
  chartData,
  loading,
  error,
  currentPercentages,
  selectedRange,
  onRangeChange,
  settings,
}) => {
  const { t } = useTranslation();

  // Smart downsample: preserve step-chart transitions, remove only same-value plateaus
  const displayData = useMemo(() => {
    if (!chartData || chartData.length <= MAX_DISPLAY_POINTS) return chartData;
    const activeMarketIds = selectedOptions
      .map((idx) => displayOptions[idx]?.marketId)
      .filter(Boolean);
    // Phase 1: keep all transition points (where any market value changes)
    const kept = [chartData[0]];
    for (let i = 1; i < chartData.length; i++) {
      const prev = chartData[i - 1];
      const curr = chartData[i];
      const isLast = i === chartData.length - 1;
      let changed = isLast;
      if (!changed) {
        for (const mid of activeMarketIds) {
          if (curr[mid] !== prev[mid]) {
            changed = true;
            break;
          }
        }
      }
      if (changed) {
        // Also keep the end of the previous plateau
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
  }, [chartData, selectedOptions, displayOptions]);

  // Compute Y-axis domain from data (auto-scale)
  const yDomain = useMemo<[number, number]>(() => {
    if (!chartData || chartData.length === 0) return [0, 100];
    let min = Infinity;
    let max = -Infinity;
    const activeMarketIds = selectedOptions
      .map((idx) => displayOptions[idx]?.marketId)
      .filter(Boolean);
    for (const point of chartData) {
      for (const mid of activeMarketIds) {
        const v = point[mid];
        if (typeof v === "number") {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    if (!isFinite(min) || !isFinite(max)) return [0, 100];
    // Add small buffer then round to nearest 5% boundaries
    const buf = Math.max((max - min) * 0.05, 1);
    return [
      Math.max(0, Math.floor((min - buf) / 5) * 5),
      Math.min(100, Math.ceil((max + buf) / 5) * 5),
    ];
  }, [chartData, selectedOptions, displayOptions]);

  // Single-line chance indicator: show only when 1 option selected
  const isSingleLine = selectedOptions.length === 1;
  const chanceRef = useRef<HTMLDivElement>(null);
  const prevChanceValRef = useRef<{ current: number; change: number }>({
    current: -1,
    change: 0,
  });

  // DOM refs for zero-rerender tooltip & chance indicator
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const activeIdxRef = useRef<number>(-1);

  // Pre-compute: for each displayData index, the last rounded value that differs from current
  // Enables "BCD same value → show same change" behavior
  const lastDiffValues = useMemo(() => {
    if (!isSingleLine || !displayData || displayData.length === 0)
      return [] as (number | null)[];
    const mid = displayOptions[selectedOptions[0]]?.marketId;
    if (!mid) return [] as (number | null)[];
    const result: (number | null)[] = [];
    let prevDiffVal: number | null = null;
    let curRounded: number | null = null;
    for (const point of displayData) {
      const v = typeof point[mid] === "number" ? (point[mid] as number) : null;
      const rounded = v !== null ? Math.round(v) : null;
      if (rounded !== null && curRounded !== null && rounded !== curRounded) {
        prevDiffVal = curRounded;
      }
      if (rounded !== null) curRounded = rounded;
      result.push(prevDiffVal);
    }
    return result;
  }, [displayData, isSingleLine, selectedOptions, displayOptions]);

  // Default chance values (last point vs last-different-value point)
  const defaultChance = useMemo(() => {
    if (!isSingleLine || !displayData || displayData.length < 1) return null;
    const mid = displayOptions[selectedOptions[0]]?.marketId;
    if (!mid) return null;
    const lastIdx = displayData.length - 1;
    const lastVal =
      typeof displayData[lastIdx][mid] === "number"
        ? (displayData[lastIdx][mid] as number)
        : null;
    if (lastVal === null) return null;
    const lastDiff = lastDiffValues[lastIdx];
    const change = lastDiff !== null ? Math.round(lastVal) - lastDiff : 0;
    return { current: Math.round(lastVal), change };
  }, [
    displayData,
    isSingleLine,
    selectedOptions,
    displayOptions,
    lastDiffValues,
  ]);

  // Helper: update chance indicator DOM — "chance" is static, numbers slide in/out
  const updateChanceDOM = useCallback(
    (current: number, change: number) => {
      const el = chanceRef.current;
      if (!el || !isSingleLine) return;
      const color = colors[selectedOptions[0] % colors.length];
      const changeColor =
        change > 0 ? "var(--green)" : change < 0 ? "var(--red)" : "transparent";
      const arrow = change > 0 ? "\u25b2" : change < 0 ? "\u25bc" : "";
      const changeText = change !== 0 ? `${arrow} ${Math.abs(change)}%` : "";
      const prev = prevChanceValRef.current;
      const valAnim =
        prev.current !== current ? "animation:chanceSlideIn .3s ease-out" : "";
      const chgAnim =
        prev.change !== change ? "animation:chanceSlideIn .3s ease-out" : "";
      prevChanceValRef.current = { current, change };
      const fs = "font-size:clamp(18px,2.5vw,24px)";
      // Avoid innerHTML injection: build DOM nodes + textContent
      el.replaceChildren();

      const wrapVal = document.createElement("span");
      wrapVal.style.cssText =
        "display:inline-block;overflow:hidden;vertical-align:bottom;height:2.5em";
      const valSpan = document.createElement("span");
      valSpan.style.cssText = `display:inline-block;${fs};font-weight:700;color:${color};${valAnim}`;
      valSpan.textContent = `${current}%`;
      wrapVal.appendChild(valSpan);

      const chanceLabel = document.createElement("span");
      chanceLabel.style.cssText = `${fs};font-weight:700;color:${color};margin:0 4px`;
      chanceLabel.textContent = ` ${t.market.chance}`;

      const wrapChg = document.createElement("span");
      wrapChg.style.cssText =
        "display:inline-block;overflow:hidden;vertical-align:bottom;height:1.5em;min-width:60px";
      const chgSpan = document.createElement("span");
      chgSpan.style.cssText = `display:inline-block;font-size:14px;font-weight:600;color:${changeColor};${chgAnim}`;
      chgSpan.textContent = changeText;
      wrapChg.appendChild(chgSpan);

      el.appendChild(wrapVal);
      el.appendChild(chanceLabel);
      el.appendChild(wrapChg);
    },
    [isSingleLine, selectedOptions, t.market.chance]
  );

  // Populate chance indicator with default values on mount / data change
  useEffect(() => {
    if (defaultChance)
      updateChanceDOM(defaultChance.current, defaultChance.change);
  }, [defaultChance, updateChanceDOM]);

  // Format tooltip timestamp
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

  // Forward-fill lookup: for each displayData index, pre-compute filled values per market
  const filledValues = useMemo(() => {
    if (!displayData || displayData.length === 0)
      return [] as Record<string, number | null>[];
    const activeMarketIds = selectedOptions
      .map((idx) => displayOptions[idx]?.marketId)
      .filter(Boolean);
    const result: Record<string, number | null>[] = [];
    const lastKnown: Record<string, number | null> = {};
    for (const mid of activeMarketIds) lastKnown[mid] = null;
    for (const point of displayData) {
      const entry: Record<string, number | null> = {};
      for (const mid of activeMarketIds) {
        const v = point[mid];
        if (typeof v === "number") lastKnown[mid] = v;
        entry[mid] = lastKnown[mid];
      }
      result.push(entry);
    }
    return result;
  }, [displayData, selectedOptions, displayOptions]);

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
      const mouseY = e.clientY - rect.top;
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
      const filled = filledValues[idx];
      const pointX =
        CHART_LEFT + (idx / Math.max(displayData.length - 1, 1)) * chartWidth;

      // Cursor line
      cursor.style.display = "block";
      cursor.style.left = `${pointX}px`;

      // Build tooltip content (no innerHTML)
      const ts = point.timestamp as number;
      tooltip.replaceChildren();

      if (ts) {
        const header = document.createElement("div");
        header.style.cssText =
          "font-size:12px;color:var(--text-tertiary);margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)";
        header.textContent = formatTooltipTime(ts);
        tooltip.appendChild(header);
      }

      for (const optIdx of selectedOptions) {
        const opt = displayOptions[optIdx];
        if (!opt) continue;
        const dotColor = colors[optIdx % colors.length];
        const raw = point[opt.marketId];
        const val =
          typeof raw === "number" ? raw : (filled?.[opt.marketId] ?? null);
        const dv = val !== null ? `${val.toFixed(1)}%` : "—";

        const row = document.createElement("div");
        row.style.cssText =
          "display:flex;align-items:center;justify-content:space-between;gap:16px;padding:2px 0";

        const left = document.createElement("div");
        left.style.cssText = "display:flex;align-items:center;gap:8px";

        const dot = document.createElement("div");
        dot.style.cssText = `width:10px;height:10px;border-radius:50%;flex-shrink:0;background:${dotColor}`;

        const label = document.createElement("span");
        label.style.cssText =
          "font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px";
        label.textContent = String(opt.label ?? "");

        left.appendChild(dot);
        left.appendChild(label);

        const right = document.createElement("span");
        right.style.cssText =
          "font-size:12px;font-weight:500;color:var(--text-primary)";
        right.textContent = dv;

        row.appendChild(left);
        row.appendChild(right);

        tooltip.appendChild(row);
      }
      tooltip.style.display = "block";

      // Position tooltip (flip if near right edge)
      const tw = tooltip.offsetWidth || 160;
      let tx = pointX + 15;
      if (tx + tw > rect.width) tx = pointX - tw - 15;
      tooltip.style.left = `${tx}px`;
      tooltip.style.top = `${Math.max(10, mouseY - 20)}px`;

      // Update chance indicator: value at hovered point, change vs last different value
      if (isSingleLine && selectedOptions.length === 1) {
        const mid = displayOptions[selectedOptions[0]]?.marketId;
        if (mid) {
          const val =
            typeof point[mid] === "number"
              ? (point[mid] as number)
              : (filled?.[mid] ?? null);
          if (val !== null) {
            const rounded = Math.round(val);
            const lastDiff = lastDiffValues[idx];
            const change = lastDiff !== null ? rounded - lastDiff : 0;
            updateChanceDOM(rounded, change);
          }
        }
      }
    },
    [
      displayData,
      filledValues,
      selectedOptions,
      displayOptions,
      formatTooltipTime,
      isSingleLine,
      updateChanceDOM,
      lastDiffValues,
    ]
  );

  const handleChartMouseLeave = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.display = "none";
    if (cursorRef.current) cursorRef.current.style.display = "none";
    activeIdxRef.current = -1;
    // Revert chance indicator to default
    if (defaultChance)
      updateChanceDOM(defaultChance.current, defaultChance.change);
  }, [defaultChance, updateChanceDOM]);

  // 创建最后一个数据点的 dot 渲染函数（缓存避免每次渲染创建新组件导致 recharts 重挂载）
  const displayDataLenRef = useRef(0);
  displayDataLenRef.current = displayData?.length || 0;

  const lastDotComponents = useMemo(() => {
    const map: Record<string, React.FC<any>> = {};
    colors.forEach((color) => {
      const LastDot = (props: any) => {
        const { cx, cy, index } = props;
        const len = displayDataLenRef.current;
        if (len > 0 && index === len - 1) {
          return <circle cx={cx} cy={cy} r={5} fill={color} />;
        }
        return null;
      };
      LastDot.displayName = `LastDot(${color})`;
      map[color] = LastDot;
    });
    return map;
  }, []);

  const createLastDot = useCallback(
    (color: string) => {
      return lastDotComponents[color] || lastDotComponents[colors[0]];
    },
    [lastDotComponents]
  );

  // 生成发光效果的 CSS
  const glowStyles =
    selectedOptions
      .map((idx) => {
        const color = colors[idx % colors.length];
        const rgb = getColorRgb(color);
        return `
      path[stroke="${color}"] { filter: drop-shadow(rgb(${rgb}) 0px 0px 8px) drop-shadow(rgb(${rgb}) 0px 0px 4px) !important; }
      circle[fill="${color}"] { filter: drop-shadow(rgb(${rgb}) 0px 0px 8px) drop-shadow(rgb(${rgb}) 0px 0px 4px) !important; }
    `;
      })
      .join("\n") +
    `\n@keyframes chanceSlideIn { 0% { transform:translateY(100%); opacity:0; } 100% { transform:translateY(0); opacity:1; } }`;

  return (
    <>
      {/* 图例 */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {displayOptions.map(
          (option, index) =>
            selectedOptions.includes(index) && (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="text-sm text-(--text-primary)">
                  {option.label}
                </span>
                <span className="text-(--text-tertiary) text-sm">
                  {currentPercentages[index] || "0"}%
                </span>
              </div>
            )
        )}
      </div>

      {/* 时间范围选择器 + chance 指标 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => onRangeChange(range)}
              className={`h-7 px-3 rounded-full text-sm font-normal transition-all ${
                selectedRange === range
                  ? "bg-(--accent) text-(--text-inverse)"
                  : "bg-(--bg-secondary) text-(--text-secondary) hover:bg-(--bg-hover)"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        {/* 单曲线 chance 指标 - 与时间范围按钮齐平 */}
        {isSingleLine && !loading && chartData.length > 0 && (
          <div ref={chanceRef} className="flex items-baseline gap-2" />
        )}
      </div>

      {/* 图表 */}
      <div
        ref={chartContainerRef}
        className="relative"
        style={{ height: "320px" }}
      >
        <style dangerouslySetInnerHTML={{ __html: glowStyles }} />
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
                  tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
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
                  tick={{ fill: "var(--text-tertiary)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                  tickCount={6}
                />

                {displayOptions.map(
                  (option, idx) =>
                    selectedOptions.includes(idx) && (
                      <Line
                        key={option.marketId}
                        type="stepAfter"
                        dataKey={option.marketId}
                        stroke={colors[idx % colors.length]}
                        strokeWidth={2}
                        dot={createLastDot(colors[idx % colors.length])}
                        activeDot={false}
                        connectNulls
                        isAnimationActive={false}
                      />
                    )
                )}
              </LineChart>
            </ResponsiveContainer>
            {/* 透明遮罩拦截鼠标事件，避免 recharts 内部 re-render */}
            <div
              className="absolute inset-0 z-10"
              onMouseMove={handleChartMouseMove}
              onMouseLeave={handleChartMouseLeave}
            />
            {/* 自定义 cursor 竖线 */}
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
            {/* 自定义 tooltip */}
            <div
              ref={tooltipRef}
              className="absolute pointer-events-none z-20 border bg-(--bg-primary) border-(--border) rounded-lg p-3 shadow-xl min-w-[160px]"
              style={{ display: "none" }}
            />
          </>
        )}
      </div>

      {/* 数据点数量提示 */}
      {!loading && chartData.length > 0 && (
        <div className="text-[10px] text-(--text-tertiary) mt-1">
          {displayData.length}
          {displayData.length < chartData.length
            ? ` / ${chartData.length}`
            : ""}{" "}
          {t.market.chart.dataPoints}
        </div>
      )}
    </>
  );
};

export default MarketChartView;
