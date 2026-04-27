/**
 * 体育赛事相关类型定义
 * 基于 docs/API_SPORTS_EVENT.md
 */

// ============== 体育赛事 API 类型 ==============

export interface SportsMarketOutcome {
  id: string;
  tokenId?: string;      // token ID for trading (WS asset_id)
  outcome: string;       // "Yes" | "No"
  price: string;         // e.g. "0.5", "0.885"
  originalIndex: number; // 0 = Yes, 1 = No
}

export interface SportsMarketItem {
  marketId: string;
  marketTitle: string;   // e.g. "FC Augsburg", "Draw (FC Augsburg vs. 1. FC Köln)"
  subType: string;       // "moneyline" | "spreads" | "totals" | "prediction"
  lineValue: number | null; // e.g. -1.5, +2.5 (spreads/totals), null (moneyline)
  outcomes: SportsMarketOutcome[];
  conditionId: string;
}

export interface SportsEventDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  icon: string;
  image: string;
  startDate: string;     // 毫秒时间戳字符串
  endDate: string;       // 毫秒时间戳字符串
  marketCount: number;
  volume?: number;
  tagsSlug: string[];
  props: SportsMarketItem[] | null;
  market: Record<string, SportsMarketItem[]> | null; // key: "moneyline" | "spreads" | "totals" etc.
}

// API 请求参数
export interface SportsEventsQuery {
  tags?: string;         // 逗号分隔, e.g. "sports,soccer,bundesliga"
  tab?: 'games' | 'props';
  limit?: number;
  offset?: number;
}

// API 响应
export interface SportsEventsResponse {
  code: number;
  success: boolean;
  data: SportsEventDetail[];
  msg: string;
}

export interface SportsEventDetailResponse {
  code: number;
  success: boolean;
  data: SportsEventDetail;
  msg: string;
}
