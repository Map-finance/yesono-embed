"use client";

/**
 * OutcomeProbabilityChart - Outcome 详情页概率折线图（含 hover tooltip / cursor / 时间范围选择器）。
 * 从 page.tsx 拆出，机械搬运无修改。
 */

import React, { useCallback, useMemo, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useTranslation } from "@/lib/i18n";
import { timeRanges, type UITimeRange } from "./outcomePage.helpers";

interface ChartPoint {
  date: string;
  timestamp: number;
  value: number;
}

interface OutcomeProbabilityChartProps {
  chartData: ChartPoint[];
  chartLoading: boolean;
  optionLabel?: string;
  selectedRange: UITimeRange;
  onRangeChange: (range: UITimeRange) => void;
}

const MAX_DISPLAY_POINTS = 300;
const CHART_LEFT = 35;
const CHART_RIGHT_PAD = 10;

const OutcomeProbabilityChart: React.FC<OutcomeProbabilityChartProps> = ({
  chartData,
  chartLoading,
  optionLabel,
  selectedRange,
  onRangeChange,
}) => {
  const { t } = useTranslation();

  // Tooltip refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const activeIdxRef = useRef<number>(-1);

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
      name.textContent = String(optionLabel || "Value");
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
    [displayData, formatTooltipTime, optionLabel]
  );

  const handleChartMouseLeave = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.display = "none";
    if (cursorRef.current) cursorRef.current.style.display = "none";
    activeIdxRef.current = -1;
  }, []);

  return (
    <>
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

      {/* 时间范围选择器 */}
      <div className="flex items-center gap-0.5 mb-4">
        {timeRanges.map((range) => (
          <button
            key={range}
            onClick={() => onRangeChange(range)}
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
    </>
  );
};

export default OutcomeProbabilityChart;
