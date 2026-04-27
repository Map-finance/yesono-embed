/**
 * 市场创建 API 类型定义
 * 基于 docs/API_MARKET.md
 */

// ============== 通用响应结构 ==============

export interface ApiResponse<T> {
  code: number;
  success: boolean;
  data: T;
  msg: string;
}

export interface Pagination<T> {
  page: number;
  size: number;
  total: number;
  data: T[];
}

// ============== 分类 (Category/Tag) ==============

export interface TagResp {
  id: string;
  label: string;
  slug: string;
}

// ============== 参与者 (Participant) ==============

export interface ParticipantResp {
  id: number;
  candidateId: number;
  alignment: 'home' | 'away' | string;
  name: string;
  slug: string;
  externalParticipantId: string;
  image: string;
  shortName: string;
  metadataJson: string;
}

// ============== 候选事件 (Candidate) ==============

export interface CandidateResp {
  id: number;
  title: string;
  description: string;
  startDate: number;
  endDate: number;
  provider: string;
  metadataId: string;
  participantType: string;
  status: string;
  visible: boolean;
  participants: ParticipantResp[];
}

export interface CandidateDetailResp extends CandidateResp {
  rawPayloadJson: string;
}

export interface CandidateQuery {
  offset?: number;
  limit?: number;
  key?: string;
  q?: string;
  slug?: string;
  startDate?: number;
  endDate?: number;
}

// ============== 市场类型枚举 ==============

export type MarketType = 'BINARY';

export type MarketSubType = 
  | 'moneyline'    // 独赢/欧盘
  | 'spreads'      // 让球
  | 'totals';      // 大小球

// ============== 创建市场请求 ==============

export interface MarketOutcomeReq {
  name: string;
  outcomeKey: string;
  originalIndex: number;
}

export interface CreateMarketReq {
  candidateId: number;
  eventId?: number;
  tagIds?: number[];
  marketType: MarketType;
  subType: MarketSubType;
  marketValue?: number;
  period?: string;
  groupItemTitle?: string;
  question?: string;
  outcomes?: MarketOutcomeReq[];
}

// ============== 新版创建市场 API (API_MARKET2.md) ==============

// 审核接口请求 (POST /market/v1/market/sports/)
export interface ReviewSportsMarketReq {
  market_sub_type: 'totals' | 'spreads' | 'moneyline';
  market_value: string;
  candidate_id: string;  // 使用 string 避免大整数精度丢失
}

// 审核接口响应
export interface ReviewSportsMarketResp {
  id: number;
  type: string;
  market_title: string;
  market_desc: string;
  unique_key: string;
  match_id: string;
  market_value: string;
  market_sub_type: string;
  status: string;
  used_time: string | null;
  created_time: string;
  updated_time: string;
}

// 新版创建市场请求 (POST /api/markets/create)
export interface CreateMarketReqV2 {
  candidateId: number;
  eventId?: number;
  subType: string;
  unique_key?: string;
  marketValue?: number | null;
  outcomes?: { name: string }[];
  question?: string;
  submittedBy: string;
  image?: string;
}

// 新版创建市场响应
export interface CreateMarketRespV2 {
  marketId: string;
  eventId: string;
  eventSlug: string;
  slug: string;
  outcomes: { name: string; originalIndex: number }[];
  description: string;
  resData: Record<string, string>;
  question: string;
  questionSlug: string;
}

// 确认市场请求 (PUT /api/market/{marketId}/confirm)
export interface ConfirmMarketReq {
  submittedBy: string;
  ancillaryDataHex: string;
  questionId: string;
}

// 批量确认市场请求 (POST /api/market/confirm)
export interface ConfirmMarketBatchItem {
  id: number;
  submittedBy: string;
  ancillaryDataHex: string;
  questionId?: string;
}

// ============== 创建市场响应 ==============

export interface MarketOutcomeSimpleResp {
  id: number;
  name: string;
  outcomeKey: string;
  originalIndex: number;
}

export interface MarketCreateResp {
  marketId: number;
  eventId: number;
  outcomes: MarketOutcomeSimpleResp[];
}

// 新版玩法类型映射
export type MarketSubTypeV2 = 'MONEYLINE' | 'OVER_UNDER' | 'HANDICAP';

// ============== 表单状态类型 ==============

export interface CreateMarketFormState {
  // Step 1: 选择分类
  selectedCategory: TagResp | null;
  
  // Step 2: 选择候选事件
  selectedCandidate: CandidateResp | null;
  candidateDetail: CandidateDetailResp | null;
  
  // Step 3: 配置市场
  subType: MarketSubType;
  marketValue?: number;
  question: string;
  groupItemTitle: string;
  outcomes: MarketOutcomeReq[];
  
  // 加载状态
  isLoadingCategories: boolean;
  isLoadingCandidates: boolean;
  isLoadingDetail: boolean;
  isSubmitting: boolean;
  
  // 错误
  error: string | null;
}

// ============== 辅助函数 ==============

/**
 * 根据 subType 获取默认 outcomes
 */
export function getDefaultOutcomes(
  subType: MarketSubType, 
  candidate?: CandidateResp | null
): MarketOutcomeReq[] {
  switch (subType) {
    case 'moneyline':
      // 独赢/欧盘 - 需要选择一个参与者或 DRAW
      return [];
    case 'spreads':
      // 让球 - 后端自动补 HOME/AWAY，前端可不传
      return [];
    case 'totals':
      // 大小球 - 忽略 outcomes
      return [];
    default:
      return [
        { name: 'Yes', outcomeKey: 'YES', originalIndex: 0 },
        { name: 'No', outcomeKey: 'NO', originalIndex: 1 },
      ];
  }
}

/**
 * 验证 subType 是否需要 marketValue
 */
export function requiresMarketValue(subType: MarketSubType): boolean {
  return ['moneyline', 'spreads', 'totals'].includes(subType);
}

/**
 * 获取 subType 显示名称
 */
export function getSubTypeLabel(subType: MarketSubType): string {
  // Returns i18n key suffix, use with t.market.create.subType{Key}
  const keys: Record<MarketSubType, string> = {
    moneyline: 'Moneyline',
    spreads: 'Spreads',
    totals: 'Totals',
  };
  return keys[subType] || subType;
}

/**
 * 获取所有可用的 subType 选项
 */
export function getSubTypeOptions(): MarketSubType[] {
  return ['moneyline', 'spreads', 'totals'];
}
