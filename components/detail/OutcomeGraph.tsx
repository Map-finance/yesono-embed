"use client";

/**
 * OutcomeGraph - OutcomeRow 展开后的子图表（API 数据 + 动态 tooltip / chance 指标）。
 * 从 OutcomeList.tsx 拆出，机械搬运无修改。
 */

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { Settings, Loader2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useTranslation } from "@/lib/i18n";
import { useSingleMarketPriceHistory } from "@/lib/hooks/usePriceHistory";
import { mapToApiRange, timeRanges, type UITimeRange } from "./OutcomeList.helpers";

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
  const effectiveMarketId = marketId || "";
  const {
    data: apiData,
    loading,
    currentPrices,
    error,
  } = useSingleMarketPriceHistory(
    effectiveMarketId,
    mapToApiRange(selectedRange),
    isVisible // Only poll when visible
  );

  // Transform API data for chart
  const chartData = useMemo(() => {
    if (!apiData || apiData.length === 0) return [];
    return apiData.map((point) => ({
      date: point.date,
      timestamp: point.timestamp,
      value: (point[effectiveMarketId] as number) || 0,
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
  const prevChanceValRef = useRef<{ current: number; change: number }>({
    current: -1,
    change: 0,
  });

  // Pre-compute: for each displayData index, the last rounded value that differs from current
  const lastDiffValues = useMemo(() => {
    if (!displayData || displayData.length === 0) return [] as (number | null)[];
    const result: (number | null)[] = [];
    let prevDiffVal: number | null = null;
    let curRounded: number | null = null;
    for (const point of displayData) {
      const v = typeof point.value === "number" ? point.value : null;
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
    const lastVal =
      typeof displayData[lastIdx].value === "number"
        ? displayData[lastIdx].value
        : null;
    if (lastVal === null) return null;
    const lastDiff = lastDiffValues[lastIdx];
    const change = lastDiff !== null ? Math.round(lastVal) - lastDiff : 0;
    return { current: Math.round(lastVal), change };
  }, [displayData, lastDiffValues]);

  // Helper: update chance indicator DOM — "chance" is static, numbers slide in/out
  const updateChanceDOM = useCallback(
    (current: number, change: number) => {
      const el = chanceRef.current;
      if (!el) return;
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
      const fs = "font-size:clamp(16px,2.5vw,20px)";
      // Avoid innerHTML injection: build DOM nodes + textContent
      el.replaceChildren();

      const wrapVal = document.createElement("span");
      wrapVal.style.cssText =
        "display:inline-block;overflow:hidden;vertical-align:bottom;height:2.2em";
      const valSpan = document.createElement("span");
      valSpan.style.cssText = `display:inline-block;${fs};font-weight:700;color:#ED6432;${valAnim}`;
      valSpan.textContent = `${current}%`;
      wrapVal.appendChild(valSpan);

      const chanceLabel = document.createElement("span");
      chanceLabel.style.cssText = `${fs};font-weight:700;color:#ED6432;margin:0 4px`;
      chanceLabel.textContent = ` ${t.market.chance}`;

      const wrapChg = document.createElement("span");
      wrapChg.style.cssText =
        "display:inline-block;overflow:hidden;vertical-align:bottom;height:1.5em;min-width:55px";
      const chgSpan = document.createElement("span");
      chgSpan.style.cssText = `display:inline-block;font-size:13px;font-weight:600;color:${changeColor};${chgAnim}`;
      chgSpan.textContent = changeText;
      wrapChg.appendChild(chgSpan);

      el.appendChild(wrapVal);
      el.appendChild(chanceLabel);
      el.appendChild(wrapChg);
    },
    [t.market.chance]
  );

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
      const pointX =
        CHART_LEFT + (idx / Math.max(displayData.length - 1, 1)) * chartWidth;

      cursor.style.display = "block";
      cursor.style.left = `${pointX}px`;

      const ts = point.timestamp as number;
      const val = typeof point.value === "number" ? point.value.toFixed(1) : "—";
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
      tooltip.style.top = `${Math.max(10, mouseY - 20)}px`;

      // Update chance indicator: value at hovered point, change vs last different value
      const currVal = typeof point.value === "number" ? point.value : null;
      if (currVal !== null) {
        const rounded = Math.round(currVal);
        const lastDiff = lastDiffValues[idx];
        const chg = lastDiff !== null ? rounded - lastDiff : 0;
        updateChanceDOM(rounded, chg);
      }
    },
    [displayData, formatTooltipTime, label, updateChanceDOM, lastDiffValues]
  );

  const handleChartMouseLeave = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.display = "none";
    if (cursorRef.current) cursorRef.current.style.display = "none";
    activeIdxRef.current = -1;
    // Revert chance indicator to default
    if (defaultChance) updateChanceDOM(defaultChance.current, defaultChance.change);
  }, [defaultChance, updateChanceDOM]);

  // 创建最后一个数据点的 dot 渲染函数
  const createLastDot = (props: any) => {
    const { cx, cy, index } = props;
    if (
      displayData &&
      displayData.length > 0 &&
      index === displayData.length - 1
    ) {
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

      {/* 数据点数量提示 */}
      {!loading && chartData.length > 0 && (
        <div className="text-[10px] text-(--text-tertiary) mt-1">
          {displayData.length}
          {displayData.length < chartData.length ? ` / ${chartData.length}` : ""} {t.market.chart.dataPoints}
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

export default OutcomeGraph;
