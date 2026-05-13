/**
 * To-B 控制器接口共享类型（按 docs/tob-controller-api.md v1 + 后端 v1.1 答复录入）
 *
 * 范围（v1.1 后端答复，详见 docs/tob-controller-api-diff.md §5 回执）：
 *   - 仅保留"写入类"接口：创建订单 / 拆 / 合 / 赎 / 动作状态 / 取消 / UMA 市场创建
 *   - 所有"查询类"接口（balances / orders / actions / transfers）全部不接入，
 *     前端沿用旧 `lib/api.ts` 中的接口与字段（持仓、活动、余额、订单列表等）
 *
 * 约定：
 * - long → TS `string`（避免精度丢失）
 * - decimal → TS `string`
 */

/* ============================================================ */
/* 通用结构                                                       */
/* ============================================================ */

export interface TobApiResp<T> {
  code: number;
  success: boolean;
  data: T | null;
  msg: string;
}

/* ============================================================ */
/* 1. 创建订单                                                    */
/* ============================================================ */

export interface TobOrderCreateReq {
  /** 幂等键 = 业务订单 ID；防止重复提交。前端生成唯一值（建议 uuid） */
  betId: string;
  /**
   * dYdX 链上 clientId（uint32 随机数）。
   * 与下单流程中传给链上 buy/sell 的 clientId 保持一致，
   * 用于在多笔订单/重试场景下做端到端追踪。
   */
  clientId: number;
  eventId: string;
  tokenId: string;
  side: string;
  /** 渠道扣款金额 */
  amount: string;
  /** 数量 */
  size: string;
  orderType: string;
  /** LIMIT 等场景的限价 */
  orderPrice?: string;
  /** 订单过期时间（沿用旧下单逻辑的字段格式） */
  expiryTime: string;
  /** 订单标志位（沿用旧下单逻辑） */
  orderFlags: number;
  /** CLOB 交易对 ID（沿用旧下单逻辑） */
  clobPairId: string;
}

export interface TobOrderCreateResp {
  betId: string;
  status: string;
  channelTxHash: string;
  routerOrderId: string;
  bridgeBacTxHash: string;
  bridgeDydxConfirmRef: string;
  routerOrderStatus: string;
  message: string;
}

/* ============================================================ */
/* 2. 订单动作 (split / merge / redeem / status)                 */
/* ============================================================ */

export interface TobOrderSplitReq {
  betId: string;
  marketId: string;
  amount: string;
}

export type TobOrderMergeReq = TobOrderSplitReq;

export interface TobOrderRedeemReq {
  betId: string;
  marketId: string;
}

export interface TobOrderActionResp {
  betId: string;
  /** SPLIT / MERGE / REDEEM */
  actionType: string;
  routerOrderId: string;
  actionId: string;
  status: string;
  message: string;
}

export interface TobOrderActionStatusResp extends TobOrderActionResp {
  routerStatus: string;
}

/* ============================================================ */
/* 3. 取消订单                                                    */
/* ============================================================ */

export interface TobOrderCancelResp {
  betId: string;
  routerOrderId: string;
  status: string;
  message: string;
}

/* ============================================================ */
/* 5. UMA 聚合市场                                                */
/* ============================================================ */
/* 注：查询类（§4）接口全部废弃，沿用旧 lib/api.ts。 */

/** common 分支 outcome */
export interface TobUmaCommonOutcome {
  name: string;
  question: string;
  slug: string;
  image?: string;
  description?: string;
}

/** sports 分支单条玩法 */
export interface TobUmaSportsMarket {
  /** moneyline / totals / spreads / binary 等 */
  marketType: string;
  outcomes: string[];
}

/** crypto 分支单条市场 */
export interface TobUmaCryptoMarketItem {
  question: string;
  slug?: string;
  image?: string;
  description?: string;
  marketValue?: string;
  /** 例 RANGE:100000,120000 / GT:120000 / LT:95000 / FIRST_HIT:10000,20000 */
  targetRule?: string;
  outcomes?: string[];
}

/**
 * 单一入口请求体；按 type 分支只填本分支字段（[TBD-Q11/Q12] 详见 diff）。
 */
export interface TobUmaMarketCreateReq {
  /** 幂等键 */
  betId: string;
  /** common / sports / crypto（大小写不敏感） */
  type: "common" | "sports" | "crypto";
  /** 渠道下注金额（>0） */
  betAmount: string;

  /* common 分支 */
  liveness?: number;
  eventId?: string;
  eventTitle?: string;
  outcomes?: TobUmaCommonOutcome[];
  tags?: string[];
  marketType?: string;
  slug?: string;
  /** 停止下注时间，毫秒 */
  commonResolutionDate?: number;
  image?: string;
  description?: string;

  /* sports 分支 */
  /** Candidate.id；要求 SCHEDULED */
  gameId?: string;
  markets?: TobUmaSportsMarket[];

  /* crypto 分支 */
  /** ABOVE / BELOW / PRICE_RANGE / HIT_PRICE / FIRST_TO_HIT */
  eventType?: string;
  cryptoMarkets?: TobUmaCryptoMarketItem[];
  coinSymbol?: string;
  coinId?: string;
  tagsSlug?: string[];
}

/** 创建成功的单个子市场 */
export interface TobUmaMarketBatchItem {
  marketId: string;
  questionId?: string;
  question?: string;
  slug?: string;
  [k: string]: unknown;
}

/** 部分成功场景下的失败项 */
export interface TobUmaMarketBatchFailedItem {
  question?: string;
  reason?: string;
  code?: string | number;
  [k: string]: unknown;
}

export interface TobUmaMarketCreateResp {
  betId: string;
  status: string;
  eventId: string;
  /** 事件 slug，详情页路由首选（/market/{slug}） */
  slug?: string;
  /** 事件 title（展示用） */
  title?: string;
  channelTxHash: string | null;
  marketIds: string[];
  questionIds: string[];
  message: string | null;
  /** 创建成功的市场明细 */
  markets?: TobUmaMarketBatchItem[];
  /** 部分成功场景下的失败明细 */
  failed?: TobUmaMarketBatchFailedItem[];
}
