// 开盘记录相关的类型定义

// 开盘记录选项接口
export interface MarketRecordOption {
  id: number;
  marketId: number;
  name: string;
  code: string;
  turnover: number;
  claimableAmount: number;
}

// 开盘记录事件接口
export interface MarketRecordEvent {
  id: string;
  name: string;
  state: number;
  stateName: string;
  closeTime: number;
  imagePath: string;
  options: Array<{
    id: string;
    code: string;
    name: string;
    imagePath: string;
    outcomeValue: string;
  }>;
}

// 单个开盘记录接口
export interface MarketRecord {
  id: number;
  anchorId: number;
  catalog: string;
  mechanism: string;
  status: string;
  openTime: number;
  closeTime: number;
  resolveAt: number;
  eventId: string;
  line: string;
  txHash: string;
  createdAt: number;
  // 开盘费（USDT，人类可读；后端新增字段）
  setupFee?: number | string | null;
  options: MarketRecordOption[];
  event: MarketRecordEvent;
}

// 开盘记录分页数据接口
export interface MarketRecordData {
  pages: number;
  total: number;
  current: number;
  records: MarketRecord[];
  size: number;
}

// 开盘记录API响应接口
export interface MarketRecordResponse {
  code: number;
  success: boolean;
  data: MarketRecordData;
  msg: string;
}

// 开盘记录状态枚举
export enum MarketRecordStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  RESOLVED = "RESOLVED",
  CANCELLED = "CANCELLED"
}

// 开盘记录机制枚举
export enum MarketRecordMechanism {
  BINARY = "BINARY",
  HANDICAP = "HANDICAP",
  TOTAL = "TOTAL",
  ODDS_EVEN = "ODDS_EVEN"
}

// 开盘记录分类枚举
export enum MarketRecordCatalog {
  FOOTBALL = "FOOTBALL",
  BASKETBALL = "BASKETBALL",
  TENNIS = "TENNIS",
  BASEBALL = "BASEBALL"
}

// 获取状态显示文本的工具函数
export const getMarketRecordStatusText = (status: string): string => {
  switch (status) {
    case MarketRecordStatus.OPEN: return "开盘中";
    case MarketRecordStatus.CLOSED: return "已关盘";
    case MarketRecordStatus.RESOLVED: return "已结算";
    case MarketRecordStatus.CANCELLED: return "已取消";
    default: return status;
  }
};

// 获取机制显示文本的工具函数
export const getMarketRecordMechanismText = (mechanism: string): string => {
  switch (mechanism) {
    case MarketRecordMechanism.BINARY: return "二元选择";
    case MarketRecordMechanism.HANDICAP: return "让球";
    case MarketRecordMechanism.TOTAL: return "大小球";
    case MarketRecordMechanism.ODDS_EVEN: return "单双";
    default: return mechanism;
  }
};

// 获取分类显示文本的工具函数
export const getMarketRecordCatalogText = (catalog: string): string => {
  switch (catalog) {
    case MarketRecordCatalog.FOOTBALL: return "足球";
    case MarketRecordCatalog.BASKETBALL: return "篮球";
    case MarketRecordCatalog.TENNIS: return "网球";
    case MarketRecordCatalog.BASEBALL: return "棒球";
    default: return catalog;
  }
};
