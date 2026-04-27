/**
 * 首页 API 类型定义
 * 基于 docs/API_HOME.md 文档
 */

import { TranslationPathKeys } from "@/lib/i18n/translations";

// ============== 通用响应结构 ==============

export interface ApiResponse<T> {
  code: number;
  success: boolean;
  data: T;
  msg: string;
}

// ============== 导航栏 ==============

export interface NavigationItem {
  id: number;
  label: string;
  slug: string;
  langKey: TranslationPathKeys;
}

// ============== 标签树 ==============

export interface TagTreeNode {
  id: number;
  name: string;
  slug: string;
  count?: string | null; // API returns count as string
  type?: string | null; // e.g. "SPORT", "ASSET" - SPORT means expandable with children
  children?: TagTreeNode[];
}

export interface TagResp {
  id: string;
  label: string;
  slug: string;
}

// ============== 参与者 ==============

export interface Participant {
  id: number;
  candidateId: number;
  alignment: string;
  name: string;
  slug: string;
  externalParticipantId: string;
  image: string;
  shortName: string;
  metadataJson: string;
}

// ============== 市场结果选项 ==============

export interface MarketOutcome {
  outcome: string;
  id: number;
  marketId: number;
  source: string;
  externalId: string;
  name: string;
  outcomeKey: string;
  price: number;
  tokenId: string;
  dydxTokenId: string;
  originalIndex: number;
  tradingPair?: string | null;
  clobPairId: number;
  atomicResolution: number;
  quantumConversionExponent: number;
  stepBaseQuantums: number;
  subticksPerTick: number;
  unionKey: string;
  parentId: number;
}

// ============== 市场 ==============

export interface MarketResp {
  id: number;
  eventId: number;
  source: string;
  externalId: string;
  question: string;
  slug: string;
  groupItemTitle: string;
  conditionId: string;
  questionId: string;
  status: string;
  volume: number;
  liquidity: number;
  umaResolutionStatus: string;
  rawOutcomes: string;
  rawClobTokenIds: string;
  unionKey: string;
  parentId: number;
  marketType: string;
  line: number;
  outcomes: MarketOutcome[];
  rowOutcomePrice?: string; // JSON string of row outcome prices for card display, e.g. '["0","1"]'
}

// ============== 统计数据 ==============

export interface StatsResp {
  chance: number;
  volume: number;
  liquidity: number;
}

// ============== 事件摘要 ==============

export interface EventSummary {
  id: number;
  candidateId: number;
  source: string;
  externalId: string;
  title: string;
  slug: string;
  description: string;
  primaryCategoryId: number;
  primaryCategoryCode: string;
  primaryCategoryPath: string;
  categorySlug: string;
  seriesId: number;
  icon: string;
  image: string;
  startTime: number;
  endTime: number;
  endDate?: number;
  status: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  volume: number;
  volume24hr: number;
  liquidity: number;
  featured: boolean;
  tags: TagResp[];
  enableOrderBook: boolean;
  acceptingOrders: boolean;
  unionKey: string;
  parentId: number;
  participants: Participant[];
  markets: MarketResp[];
  cardType: string;
  isLive: boolean;
  favorite: boolean;
  subtitle: string;
  secondaryLines: string[];
  stats: StatsResp;
}

// ============== 事件列表响应 ==============

export interface EventsResp {
  total: number;
  nextOffset: number;
  events: EventSummary[];
}

// ============== 事件列表查询参数 ==============

export interface EventsQuery {
  category?: string; // 分类筛选（navigation 接口返回的 slug，如 sports,politics）
  tag_slug?: string; // 标签筛选 slug，支持逗号分隔多个（如 "bitcoin,daily"）
  series_slug?: string; // 系列/周期 slug
  active?: boolean; // 是否可见/进行中
  closed?: boolean; // 是否停止交易
  archived?: boolean; // 是否归档
  collected?: boolean; // 是否只显示已收藏
  search?: string; // 搜索关键词（旧）
  q?: string; // 搜索关键词（新）
  order?: string; // 排序参数，支持多字段，如 "-volume,+startdate"。前缀 - 为降序，+ 为升序。默认 -volume。
  //       可用字段: volume/volume24hr/startdate/enddate/liquidity/createdat/updatedat
  limit?: number; // 分页大小
  offset?: number; // 分页偏移量
}

// ============== Polymarket 事件详情响应 ==============

export interface PolymarketTagResp {
  id: string;
  label: string;
  slug: string;
}

export interface PolymarketMarketResp {
  id: string;
  eventId?: string;
  externalId: string;
  source: string;
  question: string;
  subType: string;
  conditionId: string;
  slug: string;
  resolutionSource: string;
  endDate: number;
  startDate: number;
  image: string;
  icon: string;
  description: string;
  outcomes: string; // JSON string of outcome names, e.g. '["Yes","No"]'
  outcomePrices: string; // JSON string of prices, e.g. '[0.65,0.35]'
  rowOutcomePrice?: string; // JSON string of row outcome prices for card display, e.g. '["0","1"]'
  volume: number;
  active: boolean;
  closed: boolean;
  marketMakerAddress: string;
  createdAt: number;
  updatedAt: number;
  closedTime: number;
  featured: boolean;
  archived: boolean;
  resolvedBy: string;
  restricted: boolean;
  groupItemTitle: string;
  groupItemThreshold: string;
  enableOrderBook: boolean;
  orderPriceMinTickSize: number;
  orderMinSize: number;
  umaResolutionStatus: string;
  volumeNum: number;
  acceptingOrders: boolean;
  negRisk: boolean;
  negRiskMarketID: string;
  clobTokenIds: string; // JSON string of token IDs
  bestAsk: number;
  bestBid: number;
  lastTradePrice: number;
  oneDayPriceChange: number;
  oneHourPriceChange: number;
  oneWeekPriceChange: number;
  spread: number;
  marketOutcomes: MarketOutcome[];
  unionKey: string;
}

export interface PolymarketEventResp {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  description: string;
  startDate: number;
  creationDate: number;
  endDate: number;
  image: string;
  icon: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  featured: boolean;
  restricted: boolean;
  volume: number;
  openInterest: number;
  createdAt: number;
  updatedAt: number;
  volume1wk: number;
  volume1mo: number;
  volume1yr: number;
  enableOrderBook: boolean;
  negRisk: boolean;
  negRiskMarketID: string;
  commentCount: number;
  markets: PolymarketMarketResp[];
  tags: PolymarketTagResp[];
  closedTime: number;
  showAllOutcomes: boolean;
  showMarketImages: boolean;
  unionKey: string;
  favorite?: boolean;
}

// ============== 固定导航项 ==============

export const FIXED_NAV_ITEMS: NavigationItem[] = [
  { id: -1, label: "Trending", langKey: 'common.nav.trending', slug: "trending" },
  // { id: -2, label: "Breaking", langKey: 'common.nav.breaking', slug: "breaking" },
  { id: -3, label: "New", langKey: 'common.nav.new', slug: "new" },
];
