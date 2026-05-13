/**
 * To-B 写入类接口 mock（v1.1：查询类接口已废弃，下方不再包含查询 mock）
 *
 * 启用：env `NEXT_PUBLIC_TOB_USE_MOCK=1`
 */

import type {
  TobOrderActionResp,
  TobOrderActionStatusResp,
  TobOrderCancelResp,
  TobOrderCreateReq,
  TobOrderCreateResp,
  TobUmaMarketCreateReq,
  TobUmaMarketCreateResp,
} from "./types";

const LATENCY_MS = 200;

function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  return new Promise((r) => setTimeout(() => r(value), ms));
}

let _seq = 0;
const seq = () => ++_seq;
const now = () => Date.now();

/* ========== 内存状态机：下单 → action 推进 ========== */

interface MockOrderRecord {
  betId: string;
  routerOrderId: string;
  status: string;
}
const orderStore = new Map<string, MockOrderRecord>();

interface MockActionRecord {
  betId: string;
  actionType: string;
  actionId: string;
  routerOrderId: string;
  status: string;
  routerStatus: string;
  startedAt: number;
}
const actionStore = new Map<string, MockActionRecord>();

/* ========== 1. 创建订单 ========== */

export function mockCreateOrder(
  req: TobOrderCreateReq
): Promise<TobOrderCreateResp> {
  // 幂等：同 betId 直接复用
  const existed = orderStore.get(req.betId);
  if (existed) {
    return delay({
      betId: existed.betId,
      status: existed.status,
      channelTxHash: "0xchannel" + existed.betId.slice(-8),
      routerOrderId: existed.routerOrderId,
      bridgeBacTxHash: "0xbac" + existed.betId.slice(-8),
      bridgeDydxConfirmRef: "ref-" + existed.betId.slice(-6),
      routerOrderStatus: "EXECUTING",
      message: "OK (idempotent replay)",
    });
  }
  const routerOrderId = String(1000_000 + seq());
  const rec: MockOrderRecord = {
    betId: req.betId,
    routerOrderId,
    status: "channel_deducted",
  };
  orderStore.set(req.betId, rec);
  return delay({
    betId: req.betId,
    status: rec.status,
    channelTxHash: "0xchannel" + req.betId.slice(-8),
    routerOrderId,
    bridgeBacTxHash: "",
    bridgeDydxConfirmRef: "",
    routerOrderStatus: "PENDING",
    message: "OK",
  });
}

/* ========== 2. 订单动作 ========== */

export function mockOrderAction(
  actionType: "SPLIT" | "MERGE" | "REDEEM",
  betId: string
): Promise<TobOrderActionResp> {
  const order = orderStore.get(betId);
  const routerOrderId = order?.routerOrderId ?? String(2000_000 + seq());
  const actionId = `${actionType.toLowerCase()}-${seq()}`;
  const rec: MockActionRecord = {
    betId,
    actionType,
    actionId,
    routerOrderId,
    status: "PENDING",
    routerStatus: "QUEUED",
    startedAt: now(),
  };
  actionStore.set(actionId, rec);
  return delay({
    betId,
    actionType,
    routerOrderId,
    actionId,
    status: rec.status,
    message: "OK",
  });
}

export function mockOrderActionStatus(
  betId: string
): Promise<TobOrderActionStatusResp> {
  const recs = Array.from(actionStore.values())
    .filter((a) => a.betId === betId)
    .sort((a, b) => b.startedAt - a.startedAt);
  const rec = recs[0];
  if (!rec) {
    return delay({
      betId,
      actionType: "",
      routerOrderId: "",
      actionId: "",
      status: "NOT_FOUND",
      routerStatus: "",
      message: "no action for this betId",
    });
  }
  // 模拟状态机：3s 后 EXECUTING、6s 后 COMPLETED
  const elapsed = now() - rec.startedAt;
  if (elapsed > 6000) {
    rec.status = "COMPLETED";
    rec.routerStatus = "COMPLETED";
  } else if (elapsed > 3000) {
    rec.status = "EXECUTING";
    rec.routerStatus = "EXECUTING";
  }
  return delay({
    betId: rec.betId,
    actionType: rec.actionType,
    routerOrderId: rec.routerOrderId,
    actionId: rec.actionId,
    status: rec.status,
    routerStatus: rec.routerStatus,
    message: "OK",
  });
}

/* ========== 3. 取消订单 ========== */

export function mockCancelOrder(betId: string): Promise<TobOrderCancelResp> {
  const order = orderStore.get(betId);
  if (order) order.status = "CANCELED";
  return delay({
    betId,
    routerOrderId: order?.routerOrderId ?? "",
    status: "CANCELED",
    message: "OK",
  });
}

/* ========== 5. UMA 市场 ========== */

export function mockUmaCreate(
  req: TobUmaMarketCreateReq
): Promise<TobUmaMarketCreateResp> {
  const n =
    req.type === "sports"
      ? req.markets?.length ?? 1
      : req.type === "crypto"
        ? req.cryptoMarkets?.length ?? 1
        : req.outcomes?.length ?? 1;
  return delay({
    betId: req.betId,
    status: "CREATED",
    eventId: req.eventId ?? String(7000_000 + seq()),
    channelTxHash: "0xchannel" + req.betId.slice(-8),
    marketIds: Array.from({ length: n }, (_, i) =>
      String(8000_000 + seq() + i)
    ),
    questionIds: Array.from(
      { length: n },
      (_, i) =>
        "0x" +
        seq().toString(16).padStart(8, "0") +
        i.toString(16).padStart(2, "0").repeat(28)
    ),
    message: "OK",
  });
}
