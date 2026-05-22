/**
 * OutcomeList 内部共享类型 / 常量 / 纯工具函数。
 * 从 OutcomeList.tsx 拆出，机械搬运无修改。
 */

import type { TimeRange as ApiTimeRange } from "@/lib/hooks/usePriceHistory";

/** UI 上展示的时间范围选项（OutcomeGraph 子图表用）。 */
export type UITimeRange = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";

export const timeRanges: UITimeRange[] = ["1H", "6H", "1D", "1W", "1M", "ALL"];

/** UITimeRange → 后端 API TimeRange 的映射。 */
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

/** 把 0..1 的概率转成按钮上显示的「xx.x¢」字符串。 */
export const formatButtonPrice = (rawPrice: number): string => {
  const priceInCents = rawPrice * 100;
  return priceInCents.toFixed(1) + "¢";
};

/** OutcomeRow 渲染所需的扁平结构（从 PolymarketMarketResp / Market.options 投影而来）。 */
export interface DisplayOption {
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
  /** 已截止但未结算（后端 closed / 停止接单）：展示"等待结算"中间态，禁止下单 */
  isEnded: boolean;
  resolvedOutcome?: string;
  icon?: string;
  volume: number;
  marketData: any;
}
