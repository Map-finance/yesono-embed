"use client";

/**
 * CTF 动作对话框：拆 / 合 / 赎回
 *
 * 流程：
 *   用户点按钮 → mutate(POST split|merge|redeem) → 拿 betId → 轮询 GET action/status → 终态 (COMPLETED|FAILED)
 *
 * - 拆 / 合：需要 amount（数量）输入
 * - 赎回：直接调 redeem，无 amount
 *
 * 不依赖任何链上 / 钱包，全部走 To-B HTTP（mock 或真实接口）。
 */

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";
import { Button } from "@/components/ui/shadcn/button";
import {
  useTobActionStatusPolling,
  useTobOrderMerge,
  useTobOrderRedeem,
  useTobOrderSplit,
} from "@/lib/hooks/tob";

export type CtfActionMode = "split" | "merge" | "redeem";

export interface CtfActionContext {
  /** 用于展示的市场名 */
  marketTitle?: string;
  /** 后端 redeem / split / merge 接口要求的 marketId（数字字符串） */
  marketId: string;
  /** 持仓 outcome 名（仅展示） */
  outcome?: string;
  /** 当前持仓数量，用作输入框默认值与最大值 */
  shares?: number;
}

interface Props {
  open: boolean;
  mode: CtfActionMode;
  ctx: CtfActionContext | null;
  onClose: () => void;
  /** 终态成功后回调（用于刷新持仓列表 / 余额） */
  onSuccess?: () => void;
}

const TITLES: Record<CtfActionMode, string> = {
  split: "Split shares",
  merge: "Merge shares",
  redeem: "Redeem shares",
};

const DESCRIPTIONS: Record<CtfActionMode, string> = {
  split:
    "Split a USDC position into matching YES + NO outcome shares of the same market.",
  merge:
    "Merge equal amounts of YES + NO shares back into USDC (1 YES + 1 NO = 1 USDC).",
  redeem:
    "Redeem all winning shares of a resolved market for the corresponding USDC payout.",
};

export default function CtfActionDialog({
  open,
  mode,
  ctx,
  onClose,
  onSuccess,
}: Props) {
  const [amount, setAmount] = useState<string>("");
  const [betId, setBetId] = useState<string | null>(null);

  const split = useTobOrderSplit();
  const merge = useTobOrderMerge();
  const redeem = useTobOrderRedeem();

  // 反应式选择当前 mode 对应的 mutation
  const current = mode === "split" ? split : mode === "merge" ? merge : redeem;
  const polling = useTobActionStatusPolling(betId);

  // 重置子状态
  useEffect(() => {
    if (!open) {
      setAmount("");
      setBetId(null);
      split.reset();
      merge.reset();
      redeem.reset();
    } else if (ctx?.shares != null && (mode === "split" || mode === "merge")) {
      setAmount(String(ctx.shares));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, ctx?.shares]);

  // 轮询完成后通知调用方
  useEffect(() => {
    if (polling.done && polling.data?.status === "COMPLETED") {
      onSuccess?.();
    }
  }, [polling.done, polling.data?.status, onSuccess]);

  const needAmount = mode !== "redeem";
  const validAmount = useMemo(() => {
    if (!needAmount) return true;
    const n = Number(amount);
    return Number.isFinite(n) && n > 0;
  }, [amount, needAmount]);

  const submitting = current.loading || (!!betId && !polling.done);

  const onSubmit = async () => {
    if (!ctx?.marketId) return;
    const newBetId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `bet-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    if (mode === "redeem") {
      const r = await redeem.mutate({
        betId: newBetId,
        marketId: ctx.marketId,
      });
      if (r) setBetId(newBetId);
    } else {
      const fn = mode === "split" ? split.mutate : merge.mutate;
      const r = await fn({
        betId: newBetId,
        marketId: ctx.marketId,
        amount: amount.trim(),
      });
      if (r) setBetId(newBetId);
    }
  };

  const status = polling.data?.status ?? (current.data ? "PENDING" : null);
  const isTerminal =
    polling.done && (status === "COMPLETED" || status === "FAILED");
  const isSuccess = isTerminal && status === "COMPLETED";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TITLES[mode]}</DialogTitle>
          <DialogDescription>{DESCRIPTIONS[mode]}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {ctx?.marketTitle ? (
            <div className="text-sm text-(--text-secondary)">
              <div className="text-xs uppercase tracking-wide opacity-60">
                Market
              </div>
              <div className="text-(--text-primary) line-clamp-2">
                {ctx.marketTitle}
              </div>
              {ctx.outcome ? (
                <div className="mt-1 text-xs">
                  Outcome: <span className="font-medium">{ctx.outcome}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {needAmount ? (
            <label className="block">
              <span className="text-xs text-(--text-secondary)">
                Amount (shares)
              </span>
              <input
                type="number"
                min={0}
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={submitting || !!betId}
                className="mt-1 w-full bg-(--bg-secondary) border border-(--border) rounded px-3 py-2 text-sm tabular-nums focus:outline-none focus:border-(--accent)"
                placeholder="0"
              />
              {ctx?.shares != null ? (
                <button
                  type="button"
                  onClick={() => setAmount(String(ctx.shares))}
                  className="mt-1 text-[11px] text-(--accent) hover:underline"
                  disabled={submitting || !!betId}
                >
                  Use max ({ctx.shares.toLocaleString()})
                </button>
              ) : null}
            </label>
          ) : null}

          {/* 状态展示 */}
          {(current.error || polling.error) && (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {current.error || polling.error}
            </div>
          )}
          {betId && (
            <div className="rounded border border-(--border) bg-(--bg-secondary) px-3 py-2 text-xs text-(--text-secondary) space-y-1">
              <div>
                <span className="opacity-60">betId:</span>{" "}
                <code className="text-[11px]">{betId.slice(0, 8)}…</code>
              </div>
              <div>
                <span className="opacity-60">status:</span>{" "}
                <span
                  className={
                    status === "COMPLETED"
                      ? "text-emerald-500"
                      : status === "FAILED"
                        ? "text-red-500"
                        : "text-(--text-primary)"
                  }
                >
                  {status ?? "…"}
                </span>
              </div>
              {polling.data?.routerStatus ? (
                <div>
                  <span className="opacity-60">router:</span>{" "}
                  {polling.data.routerStatus}
                </div>
              ) : null}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={onClose} disabled={submitting}>
              {isSuccess ? "Done" : "Cancel"}
            </Button>
            {!isTerminal ? (
              <Button
                onClick={onSubmit}
                disabled={
                  submitting || !!betId || !validAmount || !ctx?.marketId
                }
              >
                {submitting ? "Submitting…" : TITLES[mode].split(" ")[0]}
              </Button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
