/**
 * Outcome detail page 共享常量 / 类型 / 工具。
 * 从 page.tsx 拆出，机械搬运。
 */

import type { TimeRange as ApiTimeRange } from "@/lib/hooks/usePriceHistory";

// UI time range options
export type UITimeRange = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";
export const timeRanges: UITimeRange[] = ["1H", "6H", "1D", "1W", "1M", "ALL"];

export const mapToApiRange = (range: UITimeRange): ApiTimeRange => {
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
export const COIN_ALIAS: Record<string, string> = {
  bitcoin: "btc",
  ethereum: "eth",
  solana: "sol",
  ripple: "xrp",
  dogecoin: "doge",
};

export const DEFAULT_LIVE_COUNTDOWN_LABELS = {
  days: "Days",
  hours: "Hours",
  minutes: "Mins",
  seconds: "Secs",
};
