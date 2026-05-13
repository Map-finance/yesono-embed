/**
 * To-B 服务层统一出口（v1.1：仅写入类接口）
 *
 * 用法：
 *   import { tobApi } from "@/lib/services/tob";
 *   await tobApi.cancelOrder(betId);
 *
 * 查询类接口（余额 / 订单 / 活动 / 持仓）已废弃，沿用旧 lib/api.ts。
 */

export * from "./types";
export * from "./tobOrders";
export * from "./tobOrderActions";
export * from "./tobOrderCancel";
export * from "./tobUmaMarket";
export { USE_MOCK as TOB_USE_MOCK, BASE as TOB_BASE_URL } from "./client";

import { createTobOrder } from "./tobOrders";
import {
  splitTobOrder,
  mergeTobOrder,
  redeemTobOrder,
  queryTobOrderActionStatus,
} from "./tobOrderActions";
import { cancelTobOrder } from "./tobOrderCancel";
import { createTobUmaMarket } from "./tobUmaMarket";

/** 集中命名空间（推荐在 React 组件内使用） */
export const tobApi = {
  // 1. 创建订单
  createOrder: createTobOrder,

  // 2. 订单动作
  split: splitTobOrder,
  merge: mergeTobOrder,
  redeem: redeemTobOrder,
  actionStatus: queryTobOrderActionStatus,

  // 3. 取消订单
  cancelOrder: cancelTobOrder,

  // 5. UMA 市场创建
  createUmaMarket: createTobUmaMarket,
} as const;
