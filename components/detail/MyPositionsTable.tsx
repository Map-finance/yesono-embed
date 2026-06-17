"use client";

/**
 * MyPositionsTable - 市场详情页"我的持仓"表(Polymarket 风格)
 *
 * 列:OUTCOME | QTY | AVG | VALUE (Cost) | RETURN | [Sell]
 * 已结算:OUTCOME | QTY | AVG | VALUE | RETURN | [Won/Lost + Claim]
 *
 * 数据来源:useMyMarketPosition(链上 balance + 后端 avgPrice/PnL)
 *
 * 活跃持仓不放卖出按钮(对齐 PNA 持仓页;市场详情右侧已有卖出面板)。
 * Claim 走 useCtfOperations.redeem(已结算 + 胜方/败方清仓)
 */

import React, { useCallback, useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { useMyMarketPosition, type UseMyMarketPositionResult } from "@/lib/hooks/useMyMarketPosition";
import { useCtfOperations } from "@/lib/hooks/useCtfOperations";
import { useToast } from "@/components/ui/Toast";
import { refreshPortfolio } from "@/lib/hooks/usePortfolio";
import { useClaimedPositionsStore } from "@/lib/stores/claimedPositionsStore";
import { PolymarketMarketResp } from "@/types/home";
import OutcomeTag from "@/components/common/OutcomeTag";
import {
  getOutcomeLabel,
  normalizeBinaryOutcomeLabel,
  sortOutcomesByOriginalIndex,
} from "@/lib/utils/outcomes";
export interface MyPositionsTableProps {
  market: PolymarketMarketResp | null;
  isResolved?: boolean;
  /** YES 侧赔付比例(0-1);≥0.5 表 YES 胜 */
  resolvedYesPayout?: number | null;
  className?: string;
  /** 可选:顶层已 lift 持仓数据时传入,组件不再自己 fetch(避免重复请求)。
   *  不传则组件自己调 useMyMarketPosition(market.id)。 */
  preset?: UseMyMarketPositionResult;
}

interface DisplayRow {
  side: "YES" | "NO";
  shares: number;
  avgPrice: number | null;
  currentPrice: number | null;
  value: number | null;
  cost: number | null;
  profit: number | null;
  profitPct: number | null;
  /** 用于卖单切换的 tokenId(仅真数据有,mock 行禁用 Sell) */
  tokenId: string | null;
  /** 用于 redeem 的 conditionId(已结算 + 胜方时用) */
  conditionId: string | null;
  /** 后端 canClaim:true = 这条仓位还可领取(未 redeem) */
  canClaim: boolean;
}

const fmtCents = (price: number | null): string => {
  if (price == null || !Number.isFinite(price)) return "—";
  return `${(price * 100).toFixed(0)}¢`;
};

/** 大数缩写:1e3=K, 1e6=M, 1e9=B, 1e12=T, 1e15=Q;尾随 0 / 小数点干净 */
const compact = (n: number, digits = 2): string => {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  const fmt = (v: number, suffix: string) => {
    const s = v.toFixed(digits).replace(/\.?0+$/, "");
    return `${sign}${s}${suffix}`;
  };
  if (abs >= 1e15) return fmt(abs / 1e15, "Q");
  if (abs >= 1e12) return fmt(abs / 1e12, "T");
  if (abs >= 1e9) return fmt(abs / 1e9, "B");
  if (abs >= 1e6) return fmt(abs / 1e6, "M");
  if (abs >= 1e4) return fmt(abs / 1e3, "K");
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
};

const fmtUsd = (v: number | null, withSign = false): string => {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const signPrefix = withSign ? (v > 0 ? "+" : v < 0 ? "-" : "") : v < 0 ? "-" : "";
  // 超大数走缩写,常规两位小数
  if (abs >= 1e6) return `${signPrefix}$${compact(abs)}`;
  return `${signPrefix}$${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const fmtShares = (n: number): string => {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e4) return compact(n);
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  // 小额(<1000,CTF 常见)显示到 6 位(去尾零),与卖出面板精确份额对齐,
  // 避免"持仓显示 4.96 / 卖出显示 4.955123"的割裂
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
};

const MyPositionsTable: React.FC<MyPositionsTableProps> = ({
  market,
  isResolved = false,
  resolvedYesPayout,
  className = "",
  preset,
}) => {
  const { t } = useTranslation();
  const toast = useToast();

  const marketId = market?.id ? String(market.id) : undefined;
  // preset 存在时,内部 hook 不发请求(传 undefined 让 hook 走 early-return)
  const ownReal = useMyMarketPosition(preset ? undefined : marketId);
  const real = preset ?? ownReal;

  const { redeem, isLoading: isRedeeming } = useCtfOperations();
  const [redeemingSide, setRedeemingSide] = useState<"yes" | "no" | null>(null);
  // 已领取/已清仓的 conditionId —— 共享 store(与右栏 ClaimWinningsPanel 同一集合),
  // 任一处 redeem 成功两处立即同步,不等后端 canClaim 翻转。
  const claimedSet = useClaimedPositionsStore((s) => s.claimed);
  const markClaimed = useClaimedPositionsStore((s) => s.markClaimed);

  // 从 clobTokenIds 解 yes / no token id(卖单切换用)
  const [yesTokenId, noTokenId] = useMemo<[string | null, string | null]>(() => {
    if (!market?.clobTokenIds) return [null, null];
    try {
      const ids = JSON.parse(market.clobTokenIds);
      if (Array.isArray(ids) && ids.length >= 2)
        return [String(ids[0]), String(ids[1])];
    } catch {
      /* noop */
    }
    return [null, null];
  }, [market?.clobTokenIds]);

  // 档位名(Up/Down / Yes/No / Team A/B)
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

  // 把 useMyMarketPosition 的 yes/no side 转成统一 DisplayRow 数组
  const realRows: DisplayRow[] = useMemo(() => {
    const rows: DisplayRow[] = [];
    if (real.yes.shares > 0) {
      rows.push({
        side: "YES",
        shares: real.yes.shares,
        avgPrice: real.yes.avgPrice,
        currentPrice: real.yes.currentPrice,
        value: real.yes.value,
        cost:
          real.yes.avgPrice != null
            ? real.yes.shares * real.yes.avgPrice
            : null,
        profit: real.yes.profit,
        profitPct: real.yes.profitPct,
        tokenId: yesTokenId,
        conditionId: real.yes.raw?.conditionId || (market as any)?.conditionId || null,
        canClaim: real.yes.raw?.canClaim === true,
      });
    }
    if (real.no.shares > 0) {
      rows.push({
        side: "NO",
        shares: real.no.shares,
        avgPrice: real.no.avgPrice,
        currentPrice: real.no.currentPrice,
        value: real.no.value,
        cost:
          real.no.avgPrice != null ? real.no.shares * real.no.avgPrice : null,
        profit: real.no.profit,
        profitPct: real.no.profitPct,
        tokenId: noTokenId,
        conditionId: real.no.raw?.conditionId || (market as any)?.conditionId || null,
        canClaim: real.no.raw?.canClaim === true,
      });
    }
    return rows;
  }, [real, yesTokenId, noTokenId, market]);

  const rows: DisplayRow[] = realRows;


  // Redeem(mock 行禁用)
  const handleRedeem = useCallback(
    async (row: DisplayRow) => {
      if (!row.conditionId || !marketId) {
        toast.error(t.common.operationFailed);
        return;
      }
      setRedeemingSide(row.side === "YES" ? "yes" : "no");
      try {
        const result = await redeem({
          conditionId: row.conditionId,
          marketId,
        });
        if (result.success) {
          // 立即写入共享 store(乐观),右栏 / 个人页同步显示已领取,避免重复领取
          markClaimed(row.conditionId);
          toast.success((t.trade as any)?.redeemSuccess || "Redeem succeeded");
          await Promise.all([real.refresh(), refreshPortfolio()]);
        } else {
          toast.error(result.error || t.common.operationFailed);
        }
      } finally {
        setRedeemingSide(null);
      }
    },
    [redeem, marketId, toast, t, real, markClaimed]
  );

  if (rows.length === 0) return null;

  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-card)] ${className}`}
    >
      {/* Header — 只保留标题(+示例角标),View Net Positions 链接挪到表底 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {(t.market as any).myPosition || "Positions"}
          </span>
        </div>
      </div>

      {/* 表头(仅桌面端;对齐 PNA 持仓表 4 列布局) */}
      <div className="hidden sm:grid grid-cols-[1fr_70px_70px_minmax(120px,1.4fr)] gap-3 px-4 py-2 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)] border-b border-[var(--border)]">
        <span>{(t.pna as any)?.positionHeaders?.outcome || "Outcome"}</span>
        <span className="text-center">{(t.pna as any)?.positionHeaders?.avg || "Avg"}</span>
        <span className="text-right">{(t.pna as any)?.positionHeaders?.current || "Current"}</span>
        <span className="text-right">{(t.pna as any)?.positionHeaders?.value || "Value"}</span>
      </div>

      {/* 行 */}
      <div className="divide-y divide-[var(--border)]">
        {rows.map((row) => {
          const outcomeName = row.side === "YES" ? yesLabel : noLabel;
          const sideColor =
            row.side === "YES"
              ? "text-[var(--green)]"
              : "text-[var(--red)]";
          const profitColor =
            row.profit == null
              ? "text-[var(--text-secondary)]"
              : row.profit > 0
              ? "text-[var(--green)]"
              : row.profit < 0
              ? "text-[var(--red)]"
              : "text-[var(--text-secondary)]";
          // 胜方判定(仅用于领取按钮文案:胜方=领取 / 败方=清仓)。
          // canRedeem=true 时数据已结算(canClaim 由后端置真),此处 currentPrice 决定性,文案正确。
          const won = (row.currentPrice ?? 0) >= 0.5;
          const isClaimingThis =
            redeemingSide === (row.side === "YES" ? "yes" : "no");
          // 本行是否已被领取/清仓(共享 store 乐观状态,跨组件同步)
          const rowClaimed = !!row.conditionId && claimedSet.has(row.conditionId);
          // 领取按钮:后端 canClaim + 有 conditionId + 未被领取(胜方=领取 / 败方=清仓,同一个 handleRedeem)。
          // 注:不再渲染"已领取 / 已输"等结算徽标 —— 它们要读 currentPrice/canClaim,而这俩会滞后于市场
          //     结算状态(isResolved),结算瞬间会把"还没变成可领取"误判成"已领取"。只保留由 canClaim
          //     驱动的领取按钮:数据未到位时 canClaim=false → 不显示,永不误判,数据到位后才出现。
          const canRedeem = !!row.conditionId && row.canClaim && !rowClaimed;

          const profitNumNode = (
            <span className={`tabular-nums text-xs font-semibold ${profitColor}`}>
              {fmtUsd(row.profit, true)}
              {row.profitPct != null && (
                <span className="opacity-80 ml-0.5">
                  ({row.profitPct > 0 ? "+" : ""}
                  {row.profitPct.toFixed(1)}%)
                </span>
              )}
            </span>
          );

          // Action 列:可领取 → 领取/清仓 按钮;否则无(活跃持仓 / 已领取过都不放按钮)
          const actionNode = canRedeem ? (
            <button
              onClick={() => handleRedeem(row)}
              disabled={isRedeeming && isClaimingThis}
              className="px-3 py-1 rounded text-xs font-bold bg-[var(--accent)] text-[var(--text-inverse)] hover:bg-[var(--accent-hover)] disabled:opacity-60 flex items-center gap-1"
            >
              {isRedeeming && isClaimingThis && (
                <Loader2 size={11} className="animate-spin" />
              )}
              {won
                ? (t.market as any).redeem || "Redeem"
                : (t.market as any).clearPosition || "Redeem"}
            </button>
          ) : null;

          // PNA 同款"chip + N 份额 at X¢ + 按钮"内联区
          const sharesText = (
            <span className="text-xs text-[var(--text-secondary)] font-medium whitespace-nowrap">
              {fmtShares(row.shares)} {(t.pna as any)?.positionHeaders?.shares || "shares"} at {fmtCents(row.avgPrice)}
            </span>
          );

          return (
            <div key={row.side}>
              {/* ============ 桌面端:对齐 PNA 持仓表 4 列布局 ============ */}
              <div className="hidden sm:grid grid-cols-[1fr_70px_70px_minmax(120px,1.4fr)] gap-3 px-4 py-3 items-center text-sm">
                {/* 标的:chip + 份额信息 + action 按钮 内联 */}
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <OutcomeTag
                    outcome={row.side}
                    text={outcomeName}
                    className="text-[11px] font-bold"
                  />
                  {sharesText}
                  {actionNode && (
                    <div className="flex items-center">{actionNode}</div>
                  )}
                </div>
                {/* 平均 */}
                <span className="text-center tabular-nums text-[var(--text-primary)] font-semibold">
                  {fmtCents(row.avgPrice)}
                </span>
                {/* 当前 */}
                <span className="text-right tabular-nums text-[var(--text-primary)] font-semibold">
                  {fmtCents(row.currentPrice)}
                </span>
                {/* 价值 + 盈亏 */}
                <div className="text-right">
                  <div className="tabular-nums text-[var(--text-primary)] font-bold">
                    {fmtUsd(row.value)}
                  </div>
                  {row.profit != null && (
                    <div className="mt-0.5">{profitNumNode}</div>
                  )}
                </div>
              </div>

              {/* ============ 移动端:卡片堆叠 ============ */}
              <div className="sm:hidden px-4 py-3 flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className={`font-semibold ${sideColor}`}>{outcomeName}</span>
                  <div className="flex items-center gap-2">
                    {actionNode}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-secondary)]">
                    <span className="tabular-nums text-[var(--text-primary)]">
                      {fmtShares(row.shares)}
                    </span>{" "}
                    shares · Avg{" "}
                    <span className="tabular-nums">{fmtCents(row.avgPrice)}</span>
                  </span>
                  {profitNumNode}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="tabular-nums text-[var(--text-primary)] font-medium">
                    {fmtUsd(row.value)}
                  </span>
                  {row.cost != null && (
                    <span className="tabular-nums text-[var(--text-tertiary)]">
                      Cost {fmtUsd(row.cost)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 表底:View Net Positions 链接(Polymarket 同款位置) */}
      <div className="px-4 py-2.5 border-t border-[var(--border)] flex justify-end">
        <Link
          href="/pna"
          className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1"
        >
          {(t.market as any).viewNetPositions || "View Net Positions"}
          <ExternalLink size={11} />
        </Link>
      </div>
    </div>
  );
};

export default React.memo(MyPositionsTable);
