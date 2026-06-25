"use client";

/**
 * ClaimWinningsPanel - 市场已结算时右栏的领奖大面板(Polymarket 风格)
 *
 * 替代原"圆勾 + Outcome 文字"的简陋结算面板。
 * 结构:
 *   ✓ 大圆勾(颜色随结算五态)
 *   Outcome: {结算结果}
 *   {市场标题}
 *   ──────────────
 *   Your Earnings
 *   Position       {shares} {outcomeName}
 *   Value/share    ${valuePerShare}
 *   Total          ${total}
 *   [   Claim winnings   ]  ← 蓝色大按钮(无收益时禁用并显示"Already settled")
 *
 * 数据来源:useMyMarketPosition(链上 balance + 后端 avgPrice 兜底)
 * Claim 走 useCtfOperations.redeem,与 MyPositionsTable 同口径。
 *
 * Earnings 计算:
 *   - YES 仓位:每股价值 = resolvedYesPayout(0-1)
 *   - NO 仓位:每股价值 = 1 - resolvedYesPayout
 *   - 无持仓 → 隐藏 Earnings + Claim 区,只显示结果信息
 */

import React, { useCallback, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useMyMarketPosition, type UseMyMarketPositionResult } from "@/lib/hooks/useMyMarketPosition";
import { useCtfOperations } from "@/lib/hooks/useCtfOperations";
import { useToast } from "@/components/ui/Toast";
import { refreshPortfolio } from "@/lib/hooks/usePortfolio";
import { useClaimedPositionsStore } from "@/lib/stores/claimedPositionsStore";
import { PolymarketMarketResp } from "@/types/home";
import type { SettlementDisplay } from "@/lib/utils/settlementResult";
import {
  getOutcomeLabel,
  normalizeBinaryOutcomeLabel,
  sortOutcomesByOriginalIndex,
} from "@/lib/utils/outcomes";

export interface ClaimWinningsPanelProps {
  market: PolymarketMarketResp | null;
  /** 由 page.tsx 通过 getSettlementDisplay 计算的展示信息(含颜色/文案) */
  settlementDisplay: SettlementDisplay | null;
  /** YES 侧赔付比例 0-1;null 时输入兜底 0.5(push) */
  resolvedYesPayout: number | null;
  /** 市场标题文案(用 selectedMarketInfo.title 或 market.question 都行) */
  marketTitle?: string;
  /** 可选:上游已 lift 持仓数据,组件内 hook 跳过 fetch */
  positionPreset?: UseMyMarketPositionResult;
}

const fmtShares = (n: number): string => {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const fmtUsd = (v: number): string => {
  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const ClaimWinningsPanel: React.FC<ClaimWinningsPanelProps> = ({
  market,
  settlementDisplay,
  resolvedYesPayout,
  marketTitle,
  positionPreset,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { redeem, isLoading: isRedeeming } = useCtfOperations();
  const [redeemingSide, setRedeemingSide] = useState<"yes" | "no" | null>(null);
  // 已领取的 conditionId —— 共享 store(跨组件乐观状态):领奖是链上操作,后端反映有延迟,
  // 与详情页 MyPositionsTable 共用同一集合,任一处领取两处都立即同步(隐藏按钮 / 显示已领取)。
  const claimed = useClaimedPositionsStore((s) => s.claimed);
  const markClaimed = useClaimedPositionsStore((s) => s.markClaimed);

  const marketId = market?.id ? String(market.id) : undefined;
  // 有 preset 时复用上游数据,内部 hook 不发请求
  const ownResult = useMyMarketPosition(positionPreset ? undefined : marketId);
  const { yes, no, refresh } = positionPreset ?? ownResult;

  // 真实档位名(Up/Down / Yes/No),已结算文案用得上
  const [yesLabel, noLabel] = useMemo<[string, string]>(() => {
    const outcomes = sortOutcomesByOriginalIndex(
      (market as any)?.marketOutcomes ?? []
    );
    if (outcomes.length < 2) return [t.common.yes, t.common.no];
    const dict = {
      yes: t.common.yes as string,
      no: t.common.no as string,
      up: t.common.up as string,
      down: t.common.down as string,
    };
    return [
      normalizeBinaryOutcomeLabel(
        getOutcomeLabel(outcomes[0]),
        t.common.yes as string,
        dict
      ),
      normalizeBinaryOutcomeLabel(
        getOutcomeLabel(outcomes[1]),
        t.common.no as string,
        dict
      ),
    ];
  }, [market, t.common.yes, t.common.no, t.common.up, t.common.down]);

  // YES / NO 各自的每股价值(0-1)
  const yesPayout = resolvedYesPayout ?? 0.5; // push 兜底
  const noPayout = 1 - yesPayout;

  // 取持仓数量最大的那侧作为主展示(典型场景用户只持一侧)
  // 如果两侧都有,把 YES 排前
  const realSides = useMemo(() => {
    const list: Array<{
      key: "yes" | "no";
      label: string;
      shares: number;
      valuePerShare: number;
      conditionId: string | null;
    }> = [];
    if (yes.shares > 0) {
      list.push({
        key: "yes",
        label: yesLabel,
        shares: yes.shares,
        valuePerShare: yesPayout,
        conditionId: yes.raw?.conditionId || (market as any)?.conditionId || null,
      });
    }
    if (no.shares > 0) {
      list.push({
        key: "no",
        label: noLabel,
        shares: no.shares,
        valuePerShare: noPayout,
        conditionId: no.raw?.conditionId || (market as any)?.conditionId || null,
      });
    }
    return list;
  }, [yes, no, yesLabel, noLabel, yesPayout, noPayout, market]);

  const sides = realSides;

  const showEarnings = realSides.length > 0;

  // 总收益(两侧加和)
  const totalEarnings = sides.reduce(
    (sum, s) => sum + s.shares * s.valuePerShare,
    0
  );

  const handleClaim = useCallback(
    async (side: { key: "yes" | "no"; conditionId: string | null }) => {
      if (!side.conditionId || !marketId) {
        toast.error(t.common.operationFailed);
        return;
      }
      setRedeemingSide(side.key);
      try {
        const result = await redeem({
          conditionId: side.conditionId,
          marketId,
        });
        if (result.success) {
          // 立即标记已领取(乐观,写入共享 store),避免后端反映延迟期间被重复点击
          markClaimed(side.conditionId!);
          toast.success((t.trade as any)?.redeemSuccess || "Redeem succeeded");
          await Promise.all([refresh(), refreshPortfolio()]);
        } else {
          toast.error(result.error || t.common.operationFailed);
        }
      } finally {
        setRedeemingSide(null);
      }
    },
    [redeem, marketId, toast, t, refresh, markClaimed]
  );

  // settlementDisplay 为 null(结算数据完全缺失,正常情况下不会发生 —— page.tsx 已用
  // outcomePrices 回退)时,用中性灰 + "—",绝不默认成「蓝色 Yes」误导用户。
  const accent = settlementDisplay?.accent || "#6b7280";
  const outcomeLabelText = settlementDisplay?.label || "—";
  const title = marketTitle || (market as any)?.question || "";

  // 可领取的一侧:有 conditionId、有价值、且尚未被本地标记为已领取。
  const claimableSide = sides.find(
    (s) =>
      s.conditionId &&
      !claimed.has(s.conditionId) &&
      s.shares * s.valuePerShare > 0
  );
  // 本面板涉及的某侧已被领取(用于按钮显示「已领取」而非「Already settled」)
  const hasClaimed = sides.some(
    (s) => s.conditionId && claimed.has(s.conditionId)
  );
  const isClaiming = isRedeeming && redeemingSide != null;

  return (
    <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] flex flex-col items-center">
      {/* 大圆勾 */}
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: accent }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      {/* Outcome 文字 */}
      <div
        className="text-xl font-semibold mb-2 text-center"
        style={{ color: accent }}
      >
        {t.market.common.outcome} {outcomeLabelText}
      </div>

      {/* 市场标题 */}
      <div className="text-sm text-[var(--text-secondary)] text-center">
        {title}
      </div>

      {/* 有持仓(真 / mock) → 显示 Earnings + Claim 区 */}
      {showEarnings && sides.length > 0 && (
        <>
          <div className="w-full h-px bg-[var(--border)] my-5" />

          <div className="w-full">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {(t.market as any).yourEarnings || "Your Earnings"}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {sides.map((s) => {
                const value = s.shares * s.valuePerShare;
                return (
                  <React.Fragment key={s.key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">
                        {(t.market as any).position || "Position"}
                      </span>
                      <span className="tabular-nums text-[var(--text-primary)]">
                        {fmtShares(s.shares)} {s.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">
                        {(t.market as any).valuePerShare || "Value per share"}
                      </span>
                      <span className="tabular-nums text-[var(--text-primary)]">
                        {fmtUsd(s.valuePerShare)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">
                        {(t.market as any).totalEarnings || "Total"}
                      </span>
                      <span className="tabular-nums text-[var(--text-primary)] font-semibold">
                        {fmtUsd(value)}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            {/* Claim 按钮 */}
            <button
              onClick={() => claimableSide && handleClaim(claimableSide)}
              disabled={!claimableSide || isClaiming}
              className="mt-5 w-full py-3 rounded-lg text-sm font-bold bg-[#3b82f6] text-white hover:bg-[#2563eb] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isClaiming && <Loader2 size={14} className="animate-spin" />}
              {claimableSide
                ? (t.market as any).claimWinnings || "Claim winnings"
                : hasClaimed
                  ? (t.market as any).claimed || "Claimed"
                  : (t.market as any).alreadySettled || "Already settled"}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(ClaimWinningsPanel);
