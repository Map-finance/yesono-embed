export interface MarketOption {
  label: string;
  percentage: number;
  change?: number;
  icon?: string;
  // 对应二元市场的两个 outcome 文案，例如 ["Yes","No"] 或 ["Up","Down"]
  yesLabel?: string;
  noLabel?: string;
}

export type CardType = "vs" | "image" | "multi";

export interface Market {
  id: string;
  slug?: string; // 用于 URL 导航（优先使用，fallback 到 id）
  icon: string;
  title: string;
  options: MarketOption[];
  date?: string;
  endDate?: number;
  volume: string;
  cardType?: CardType;
  circularBadge?: {
    value: string;
    label: string;
  };
  isLive?: boolean;
  liveLabel?: string;
  backgroundImage?: string;
  timeframe?: string;
  isResolved?: boolean;
  resolvedOutcome?: string;
  isFavorite?: boolean;
}

export interface Team {
  seed: number;
  logo: string;
  name: string;
  record: string;
  primaryColor: string; // 队伍主色调
}

export interface GameMarketOption {
  team: "home" | "away"; // 关联的队伍
  label: string; // 显示文本
  odds: string; // 赔率
  value: string; // 用于标识选项的唯一值
  disabled?: boolean;
}

export interface GameMarket {
  id: string; // 市场唯一标识
  type: string; // 市场类型，如 'moneyline', 'spread', 'total'
  name: string; // 市场名称，如 '胜负盘', '让分盘', '总分盘'
  options: [GameMarketOption, GameMarketOption]; // 两个选项（双方）
}

export interface Game {
  id: string;
  sport: string;
  status: "LIVE" | "SCHEDULED" | "FINAL";
  period: string;
  time?: string;
  startTime?: string; // 比赛开始时间，格式如 "2:45 AM"
  startDate?: string; // 比赛日期，格式如 "Wed, December 24"
  volume: string;
  marketCount: number;
  homeTeam: Team;
  awayTeam: Team;
  markets: GameMarket[]; // 市场列表，每个市场包含两个选项
}

export interface TradeRow {
  userName: string;
  userId: string;
  side: string;
  price: string;
}

export interface Holding {
  userId: string;
  userName: string;
  size: string;
  avgPrice?: string;
  profit?: string;
  outcomeName?: string;
  originalIndex?: number;
}

export interface HoldRankGroup {
  outcomeName: string;
  originalIndex: number;
  rankings: Holding[];
}
