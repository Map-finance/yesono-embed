"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
  YAxis,
} from "recharts";
import NumberFlow from "@number-flow/react";

import { Card, CardContent } from "@/components/ui/shadcn/card";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { cn } from "@/lib/utils";
import useProfitLossChart from "@/lib/hooks/pna/use-profit-loss-chart";

interface ProfitLossChartProps {
  targetUserId?: string;
}

const TIME_RANGES = [
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "1Y", label: "1Y" },
  { value: "ALL", label: "ALL" },
] as const;

const CHART_COLOR = "#ED6432";

interface HoverPayload {
  val: number;
  fullTime: string;
}

/**
 * recharts Tooltip 自定义内容。
 * 关键点：**不能在 render 期直接 setState** —— 那样会导致
 *   "render → setState → re-render → setState ... ∞" 死循环。
 * 用 useEffect 在 commit 之后派发，并用 prev 比较保证值真变了才更新。
 */
function ChartTooltip({
  active,
  payload,
  setHovered,
}: TooltipProps<number, string> & {
  setHovered: React.Dispatch<React.SetStateAction<HoverPayload | null>>;
}) {
  const point = active && Array.isArray(payload) ? payload[0]?.payload : null;
  const val = point ? Number(point.val ?? 0) : null;
  const time = point ? String(point.fullTime ?? "") : "";

  useEffect(() => {
    setHovered((prev) => {
      if (active && val !== null) {
        if (prev && prev.val === val && prev.fullTime === time) return prev;
        return { val, fullTime: time };
      }
      return prev === null ? prev : null;
    });
  }, [active, val, time, setHovered]);

  return null;
}

export default function ProfitLossChart({ targetUserId }: ProfitLossChartProps) {
  const [timeRange, setTimeRange] = useState<string>("1D");
  const [hovered, setHovered] = useState<HoverPayload | null>(null);

  const { chartData, isLoading } = useProfitLossChart(timeRange, targetUserId);

  const lastPoint = chartData[chartData.length - 1];
  const displayValue = hovered?.val ?? lastPoint?.val ?? 0;
  const displayTime = hovered?.fullTime ?? lastPoint?.fullTime ?? "";
  const isPositive = displayValue >= 0;

  const trendColor = isPositive ? CHART_COLOR : "#ef4444";

  const yDomain = useMemo<[number, number]>(() => {
    if (chartData.length === 0) return [0, 1];
    const vals = chartData.map((p) => p.val);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.1 || 1;
    return [min - pad, max + pad];
  }, [chartData]);

  return (
    <Card className="w-full bg-(--bg-card) border-(--border)">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className={cn("text-3xl font-semibold", isPositive ? "text-(--text-primary)" : "text-red-500")}>
              <NumberFlow value={displayValue} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
            </div>
            <div className="text-xs text-(--text-secondary) mt-1">{displayTime || "—"}</div>
          </div>
          <div className="flex gap-1">
            {TIME_RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setTimeRange(r.value)}
                className={cn(
                  "px-2.5 py-1 text-xs rounded transition-colors",
                  timeRange === r.value
                    ? "bg-(--accent) text-(--bg-primary) font-medium"
                    : "text-(--text-secondary) hover:text-(--text-primary)"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[180px] w-full">
          {isLoading ? (
            <Skeleton className="size-full" />
          ) : chartData.length === 0 ? (
            <div className="size-full flex items-center justify-center text-sm text-(--text-secondary)">
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} onMouseLeave={() => setHovered(null)}>
                <defs>
                  <linearGradient id="pna-pl-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={trendColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={trendColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis hide domain={yDomain} />
                <Tooltip
                  cursor={{ stroke: trendColor, strokeWidth: 1, strokeDasharray: "3 3" }}
                  content={<ChartTooltip setHovered={setHovered} />}
                />
                <Area
                  type="monotone"
                  dataKey="val"
                  stroke={trendColor}
                  strokeWidth={2}
                  fill="url(#pna-pl-fill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
