"use client";

/**
 * 共享下单表单：BUY / SELL × MARKET / LIMIT × 多 outcome
 *
 * 设计原则（v1.1）：
 *   - 不接 dYdX SDK / 不接钱包；提交即调 POST /api/orders/tob/order/create
 *   - clobPairId 来自 outcome.clobPairId（市场详情接口已下发）
 *   - expiryTime / orderFlags 由前端用稳妥默认值传给后端，等后端规则明确后再调（详见 diff Q10）
 *
 * 由 TradingPanel（桌面右栏）和 MobileTradingPanel（移动端 sheet）共用。
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/shadcn/button";
import { useTobCreateOrder } from "@/lib/hooks/tob";
import { cn } from "@/lib/utils";

export interface TradingOutcome {
  /** 显示名（YES / NO / Over / Under …） */
  name: string;
  /** 后端要求的 tokenId，必填，没有则禁用 */
  tokenId?: string | null;
  /** clobPairId，必填 */
  clobPairId?: string | number | null;
  /** 当前价格（0-1），用于计算 size / amount */
  price?: number | null;
}

export interface TradingFormProps {
  /** event id（事件级），后端必填 */
  eventId: string | number | undefined;
  /** outcome 列表（最少 1 个） */
  outcomes: TradingOutcome[];
  /** 头部展示用的市场标题 */
  marketTitle?: string;
  /** 头部展示用的小标签（市场名 / 玩法名） */
  marketSubtitle?: string;
  /** 默认选中第几个 outcome */
  defaultOutcomeIndex?: number;
  /** 市场来源；POLYMARKET 不走 dYdX 撮合，不依赖 clobPairId */
  marketSource?: string;
  /** 提交成功后的回调（用于刷余额、关闭 sheet 等） */
  onPlaced?: (resp: {
    betId: string;
    status: string;
    routerOrderId: string;
  }) => void;
  /** 紧凑模式（移动 sheet 用） */
  compact?: boolean;
}

type Side = "BUY" | "SELL";
type OrderType = "MARKET" | "LIMIT";

const QUICK_AMOUNTS = [1, 10, 50, 100];

export default function TradingForm({
  eventId,
  outcomes,
  marketTitle,
  marketSubtitle,
  defaultOutcomeIndex = 0,
  marketSource,
  onPlaced,
  compact,
}: TradingFormProps) {
  const isPolymarket = marketSource === "POLYMARKET";
  const [side, setSide] = useState<Side>("BUY");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [outcomeIdx, setOutcomeIdx] = useState(defaultOutcomeIndex);
  const [amount, setAmount] = useState<string>("");
  const [limitPrice, setLimitPrice] = useState<string>("");

  const create = useTobCreateOrder();

  useEffect(() => {
    setOutcomeIdx(Math.min(defaultOutcomeIndex, Math.max(outcomes.length - 1, 0)));
  }, [defaultOutcomeIndex, outcomes.length]);

  const outcome = outcomes[outcomeIdx];
  const price = useMemo(() => {
    if (orderType === "LIMIT") {
      const n = Number(limitPrice);
      return Number.isFinite(n) && n > 0 && n <= 1 ? n : 0;
    }
    return Number(outcome?.price) || 0;
  }, [orderType, limitPrice, outcome?.price]);

  const amountNum = Number(amount) || 0;
  const estimatedShares = price > 0 ? amountNum / price : 0;

  const canSubmit =
    !!outcome?.tokenId &&
    (!!outcome?.clobPairId || isPolymarket) &&
    !!eventId &&
    amountNum > 0 &&
    (orderType === "MARKET" || price > 0) &&
    !create.loading;

  const submit = async () => {
    if (!canSubmit || !outcome) return;
    const betId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `bet-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    // dYdX uint32 clientId：时间戳低 16 位 + 16 位随机数，端到端追踪
    const clientId =
      (((Date.now() & 0xffff) << 16) | Math.floor(Math.random() * 65536)) >>> 0;

    const r = await create.mutate({
      betId,
      clientId,
      eventId: String(eventId),
      tokenId: String(outcome.tokenId),
      side,
      amount: String(amountNum),
      size: String(estimatedShares),
      orderType,
      orderPrice: orderType === "LIMIT" ? String(price) : "",
      // 短期有效（短单）：传当前时间 + 1 分钟。后端规则明确后再调。
      expiryTime: String(Date.now() + 60_000),
      orderFlags: 0,
      clobPairId: outcome.clobPairId ? String(outcome.clobPairId) : "",
    });
    if (r) {
      onPlaced?.(r);
      setAmount("");
      // 成功 toast 由调用方决定，本组件只在卡片内显示状态
    }
  };

  return (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-3")}>
      {/* 标题 */}
      {marketTitle ? (
        <div>
          <div className="text-sm font-medium text-(--text-primary) line-clamp-2">
            {marketTitle}
          </div>
          {marketSubtitle ? (
            <div className="mt-1 text-[11px] text-(--text-secondary) bg-(--bg-secondary) inline-block px-2 py-0.5 rounded">
              {marketSubtitle}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Buy / Sell 切换 */}
      <div className="grid grid-cols-2 gap-1 p-0.5 bg-(--bg-secondary) rounded-md">
        {(["BUY", "SELL"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cn(
              "py-1.5 text-xs font-medium rounded transition-colors",
              side === s
                ? s === "BUY"
                  ? "bg-emerald-500 text-white"
                  : "bg-red-500 text-white"
                : "text-(--text-secondary) hover:text-(--text-primary)"
            )}
          >
            {s === "BUY" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      {/* Outcome 选择 */}
      {outcomes.length > 1 ? (
        <div className="grid grid-cols-2 gap-1">
          {outcomes.map((o, i) => (
            <button
              key={`${o.name}-${i}`}
              type="button"
              onClick={() => setOutcomeIdx(i)}
              disabled={!o.tokenId}
              className={cn(
                "px-2 py-1.5 text-xs rounded border tabular-nums",
                outcomeIdx === i
                  ? "border-(--accent) bg-(--accent)/10 text-(--text-primary)"
                  : "border-(--border) text-(--text-secondary) hover:text-(--text-primary)",
                !o.tokenId && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="truncate">{o.name}</div>
              <div className="text-[10px] opacity-60">
                {o.price != null ? (Number(o.price) * 100).toFixed(0) + "¢" : "—"}
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {/* MARKET / LIMIT 切换 */}
      <div className="flex gap-2 text-xs">
        {(["MARKET", "LIMIT"] as const).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOrderType(o)}
            className={cn(
              "px-2 py-1 rounded",
              orderType === o
                ? "text-(--text-primary) underline underline-offset-4"
                : "text-(--text-secondary) hover:text-(--text-primary)"
            )}
          >
            {o === "MARKET" ? "Market" : "Limit"}
          </button>
        ))}
      </div>

      {/* Limit price */}
      {orderType === "LIMIT" ? (
        <label className="block">
          <span className="text-[11px] text-(--text-secondary)">
            Limit price (0–1)
          </span>
          <input
            type="number"
            min={0}
            max={1}
            step="0.01"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value)}
            className="mt-1 w-full bg-(--bg-secondary) border border-(--border) rounded px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-(--accent)"
            placeholder="0.50"
          />
        </label>
      ) : null}

      {/* 金额输入 */}
      <label className="block">
        <span className="text-[11px] text-(--text-secondary)">
          Amount (USDC)
        </span>
        <input
          type="number"
          min={0}
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full bg-(--bg-secondary) border border-(--border) rounded px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-(--accent)"
          placeholder="0"
        />
        <div className="mt-1 flex gap-1">
          {QUICK_AMOUNTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(String(q))}
              className="flex-1 text-[11px] py-1 rounded bg-(--bg-secondary) hover:bg-(--bg-hover) text-(--text-secondary)"
            >
              ${q}
            </button>
          ))}
        </div>
      </label>

      {/* 估算 */}
      <div className="text-[11px] text-(--text-secondary) flex justify-between">
        <span>Avg price</span>
        <span className="tabular-nums">
          {price > 0 ? (price * 100).toFixed(1) + "¢" : "—"}
        </span>
      </div>
      <div className="text-[11px] text-(--text-secondary) flex justify-between">
        <span>Est. shares</span>
        <span className="tabular-nums">
          {estimatedShares > 0 ? estimatedShares.toFixed(2) : "—"}
        </span>
      </div>

      {/* 错误 / 状态 */}
      {create.error ? (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-400">
          {create.error}
        </div>
      ) : null}
      {create.data ? (
        <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-400 space-y-0.5">
          <div>Order accepted</div>
          <div className="opacity-70">
            betId: <code>{create.data.betId.slice(0, 8)}…</code>
          </div>
          <div className="opacity-70">status: {create.data.status}</div>
        </div>
      ) : null}

      <Button
        onClick={submit}
        disabled={!canSubmit}
        className={cn(
          side === "BUY"
            ? "bg-emerald-500 hover:bg-emerald-600 text-white"
            : "bg-red-500 hover:bg-red-600 text-white"
        )}
      >
        {create.loading
          ? "Submitting…"
          : `${side === "BUY" ? "Buy" : "Sell"} ${outcome?.name ?? ""}`}
      </Button>

      {!outcome?.tokenId || (!outcome?.clobPairId && !isPolymarket) ? (
        <div className="text-[10px] text-(--text-tertiary) text-center">
          Missing tokenId / clobPairId on the selected outcome — order disabled.
        </div>
      ) : null}
    </div>
  );
}
