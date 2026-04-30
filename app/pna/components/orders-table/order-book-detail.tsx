"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { ApiOrderDetail } from "@/types/pna";
import { formatHandicap } from "@/utils/handicap";
import { TxHashLink } from "./tx-hash-link";
import { fmtRatio, formatDynamicAmount, pnlColor } from "./utils";

export function OrderDetailRow({
  detail,
  homeName,
  awayName,
}: {
  detail: ApiOrderDetail;
  homeName: string;
  awayName: string;
}) {
  const { t } = useTranslation();
  const isHome = detail.code === "1";
  const teamName = isHome ? homeName : detail.code === "2" ? awayName : "—";
  const lineRaw = detail.line;
  const lineNum = Number(lineRaw);

  let lineDisplay = "-";
  if (detail.mechanism === "overUnder") {
    const formatted = Number.isFinite(lineNum) ? formatHandicap(lineNum, false) : (lineRaw ?? "-");
    lineDisplay = (isHome ? t.pna.asian.over : t.pna.asian.under) + formatted;
  } else if (lineRaw && lineRaw !== "-") {
    const display = isHome ? lineNum : -lineNum;
    lineDisplay = formatHandicap(display, true);
  }

  const selLabel =
    detail.mechanism === "overUnder" ? lineDisplay : `${teamName} ${lineDisplay}`;

  const profitLoss = detail.profitLoss
    ? parseFloat(detail.profitLoss).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "-";
  const claimable =
    parseFloat(detail.claimableAmount) > 0
      ? formatDynamicAmount(detail.claimableAmount)
      : "-";

  const totalVol =
    detail.option1Turnover && detail.option2Turnover
      ? `$${(parseFloat(detail.option1Turnover) + parseFloat(detail.option2Turnover)).toLocaleString()}`
      : "-";

  const claimStatusLabel = (() => {
    switch (detail.claimStatus) {
      case 0:
        return "-";
      case 1:
        return t.pna.asian.notClaimed;
      case 2:
        return t.pna.asian.claimed;
      case 3:
        return t.pna.asian.claimableAmountZero;
      default:
        return t.pna.asian.unknownStatus;
    }
  })();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-x-4 gap-y-3 px-4 py-4 border-b border-dashed border-(--border) last:border-0">
      <DetailCell mobileLabel={t.pna.asian.handicapType}>
        <span className="text-sm text-(--text-primary)">
          {detail.mechanism === "overUnder" ? t.pna.asian.overUnder : t.pna.asian.handicap}
        </span>
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.betSelection}>
        <span className="text-xs font-medium text-(--text-primary)">{selLabel}</span>
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.betAmount}>
        <span className="text-sm tabular-nums text-(--text-primary)">
          {(Number(detail.stakeAmount) || 0).toLocaleString()}
        </span>
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.profitLoss}>
        <span className={cn("text-sm tabular-nums font-semibold", pnlColor(profitLoss))}>
          {profitLoss}
        </span>
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.claimableAmount}>
        <span className="text-sm tabular-nums text-(--text-primary)">{claimable}</span>
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.totalVolume}>
        <span className="text-sm tabular-nums text-(--text-primary)">{totalVol}</span>
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.myShare}>
        <span
          className={cn(
            "text-sm tabular-nums",
            parseFloat(detail.ownSideStakeRatio || "0") > 0
              ? "text-(--accent)"
              : "text-(--text-secondary)"
          )}
        >
          {parseFloat(detail.ownSideStakeRatio || "0") > 0
            ? fmtRatio(detail.ownSideStakeRatio)
            : "-"}
        </span>
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.transactionHash}>
        <TxHashLink hash={detail.transactionHash || detail.txHash} />
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.claimStatus}>
        <span className="text-xs px-2 py-0.5 rounded text-(--text-secondary) bg-(--bg-card)">
          {claimStatusLabel}
        </span>
      </DetailCell>
    </div>
  );
}

function DetailCell({
  mobileLabel,
  children,
}: {
  mobileLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs lg:hidden text-(--text-secondary)">{mobileLabel}</span>
      {children}
    </div>
  );
}
