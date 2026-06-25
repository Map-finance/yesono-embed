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
  status?: string;       // e.g. "RESOLVED" | "ACTIVE" etc.
  result?: number;       // 0=主队输, 0.25=输一半, 0.5=平, 0.75=赢一半, 1=全赢 (相对 originalIndex=0)
}

export interface SportsEventDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  icon: string;
  image: string;
  /** 后端新增:主队/客队/联赛信息,含队标/会徽 logo URL(国家队=国旗、俱乐部=队徽,后端给定)。
   *  home=主队(标题首个队,左),away=客队(右);取不到 logo 为 null,前端回退 icon/image/默认。 */
  home?: { name: string; logo: string | null } | null;
  away?: { name: string; logo: string | null } | null;
  league?: { name: string; logo: string | null } | null;
  startDate: string;     // 毫秒时间戳字符串
  endDate: string;       // 毫秒时间戳字符串
  marketCount: number;
  volume?: number;
  tagsSlug: string[];
  props: SportsMarketItem[] | null;
  market: Record<string, SportsMarketItem[]> | null; // key: "moneyline" | "spreads" | "totals" etc.
}

/**
 * 取事件下「任意一个 marketId」作为评论区 entityId —— 评论按 marketId 维度存储,
 * 不能用事件 id。优先 moneyline,其次 spreads/totals,再其次其他类目 / props。
 * 同一事件返回稳定的同一个 marketId(避免切盘口时评论区重载)。取不到返回 undefined。
 */
export function getEventCommentMarketId(
  event: SportsEventDetail | null | undefined,
): string | undefined {
  if (!event) return undefined;
  const m = event.market;
  if (m) {
    for (const key of ["moneyline", "spreads", "totals"]) {
      const id = m[key]?.find((it) => it?.marketId)?.marketId;
      if (id) return id;
    }
    for (const items of Object.values(m)) {
      const id = items?.find((it) => it?.marketId)?.marketId;
      if (id) return id;
    }
  }
  return event.props?.find((it) => it?.marketId)?.marketId;
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
