/**
 * MarketChart 共享类型 / 常量 / 工具。
 * 从 MarketChart.tsx 拆出，机械搬运。
 */

import type { TimeRange } from "@/lib/hooks/usePriceHistory";

// Time ranges: 1H, 6H, 1D, 1W, 1M, ALL
export type UITimeRange = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";
export const timeRanges: UITimeRange[] = ["1H", "6H", "1D", "1W", "1M", "ALL"];

export const mapToApiRange = (range: UITimeRange): TimeRange => {
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

// 颜色配置 - 带发光效果
export const colors = ["#ED6432", "#BBE124", "#7134F7", "#3b82f6", "#22c55e"];

/** 为发光效果获取 CSS rgb 字符串。 */
export const getColorRgb = (color: string): string =>
  color === "#ED6432"
    ? "237, 100, 50"
    : color === "#BBE124"
      ? "187, 225, 36"
      : color === "#7134F7"
        ? "113, 52, 247"
        : color === "#3b82f6"
          ? "59, 130, 246"
          : "34, 197, 94";

// Smart downsample upper bound
export const MAX_DISPLAY_POINTS = 300;

// Chart area layout constants (must match recharts margin + YAxis width)
export const CHART_LEFT = 35; // YAxis width(45) + margin.left(-10)
export const CHART_RIGHT_PAD = 10; // margin.right
