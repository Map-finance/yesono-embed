"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { ApiOrderBookRecord } from "@/types/pna";
import {
  getMatchStateByCode,
  isMatchEnded,
  MatchMark,
  MatchState,
} from "@/types/match-state";
import { fmtUnixDateTime } from "../formatters";
import { OrderDetailRow } from "./order-book-detail";
import { fmtRatio, formatDynamicAmount, pnlColor } from "./utils";

export function OrderBookCard({
  record,
  expanded,
  onToggle,
}: {
  record: ApiOrderBookRecord;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const homeTeam = record.options?.find((o) => o.code === "1");
  const awayTeam = record.options?.find((o) => o.code === "2");
  const homeName = homeTeam?.name || "Home";
  const awayName = awayTeam?.name || "Away";
  const matchTime = fmtUnixDateTime(record.eventTime);

  const matchResult = isMatchEnded(record.state)
    ? `${homeTeam?.outcomeValue || "-"} : ${awayTeam?.outcomeValue || "-"}`
    : "- : -";

  const stateObj = getMatchStateByCode(record.state);
  const statusLabel = (() => {
    if (!stateObj) return "";
    if (stateObj.mark === MatchMark.END) {
      if (stateObj === MatchState.CANCELLED) return t.pna.asian.canceled;
      return t.pna.asian.finished;
    }
    if (stateObj.mark === MatchMark.RUN) return t.pna.asian.inProgress;
    if (stateObj.mark === MatchMark.HOLD) return t.pna.asian.notStarted;
    return stateObj.label;
  })();

  const totalStake = (Number(record.totalStakeAmount) || 0).toLocaleString();
  const profitLoss = record.totalProfitLoss
    ? (Number(record.totalProfitLoss) || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "-";
  const claimable =
    parseFloat(record.totalClaimableAmount) > 0
      ? formatDynamicAmount(record.totalClaimableAmount)
      : "-";

  const hasChildren = record.orderDetails?.length > 0;

  return (
    <div
      className={cn(
        "rounded-xl border border-(--border) bg-(--bg-card) overflow-hidden transition-shadow",
        expanded ? "shadow-md" : ""
      )}
    >
      <div
        className="px-3 py-3 cursor-pointer select-none"
        onClick={hasChildren ? onToggle : undefined}
      >
        <div className="flex flex-row items-start sm:items-center gap-2">
          <span
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-(--text-secondary) mt-0.5 sm:mt-0"
            style={{ opacity: hasChildren ? 1 : 0.25 }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>

          <div className="flex-1 min-w-0 mr-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded font-medium bg-(--bg-secondary) text-(--text-secondary) flex-shrink-0">
                {record.name || t.pna.asian.league}
              </span>
              <span className="text-[15px] font-semibold truncate flex items-center gap-1 text-(--text-primary)">
                <span>{homeName}</span>
                <span className="text-xs font-normal px-1 text-(--text-secondary) opacity-60">
                  vs
                </span>
                <span>{awayName}</span>
              </span>
            </div>
            {((record.option1Turnover && record.option1Turnover !== "0") ||
              (record.option2Turnover && record.option2Turnover !== "0")) && (
              <div className="mt-0.5 text-[11px] tabular-nums text-(--text-secondary)">
                {homeName} ${(parseFloat(record.option1Turnover) || 0).toLocaleString()} :{" "}
                {awayName} ${(parseFloat(record.option2Turnover) || 0).toLocaleString()}
                {parseFloat(record.ownSideStakeRatio || "0") > 0 && (
                  <>
                    {" · "}
                    {t.pna.asian.myShare}{" "}
                    <span className="text-(--accent)">
                      {fmtRatio(record.ownSideStakeRatio)}
                    </span>
                  </>
                )}
              </div>
            )}
            <div className="mt-1 text-xs tabular-nums text-(--text-secondary)">
              {matchTime}
            </div>
          </div>

          <span className="sm:hidden text-[11px] font-medium text-(--text-primary) flex-shrink-0 px-1.5 py-0.5 rounded bg-(--bg-secondary)">
            {statusLabel}
          </span>

          <div className="hidden sm:flex sm:flex-row sm:items-center sm:gap-4 sm:ml-2 sm:flex-shrink-0 sm:justify-end">
            <Stat label={t.pna.asian.betAmount} value={totalStake} />
            <Stat
              label={t.pna.asian.matchResult}
              value={matchResult}
              valueClass={
                matchResult === "- : -" ? "text-(--text-secondary)" : "text-(--accent)"
              }
            />
            <Stat
              label={t.pna.asian.status}
              value={statusLabel}
              valueClass="text-(--text-primary)"
            />
            <Stat
              label={t.pna.asian.profitLoss}
              value={fmtSignedPnl(profitLoss)}
              valueClass={pnlColor(profitLoss)}
            />
            <Stat
              label={t.pna.asian.claimableAmount}
              value={claimable}
              valueClass={
                claimable === "-" ? "text-(--text-secondary)" : "text-emerald-500"
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-y-2 gap-x-3 mt-3 pl-7 sm:hidden">
          <MobileStat label={t.pna.asian.betAmount} value={totalStake} />
          <MobileStat
            label={t.pna.asian.matchResult}
            value={matchResult}
            valueClass={
              matchResult === "- : -" ? "text-(--text-secondary)" : "text-(--accent)"
            }
          />
          <MobileStat
            label={t.pna.asian.profitLoss}
            value={fmtSignedPnl(profitLoss)}
            valueClass={pnlColor(profitLoss)}
          />
          <MobileStat
            label={t.pna.asian.claimableAmount}
            value={claimable}
            valueClass={
              claimable === "-" ? "text-(--text-secondary)" : "text-emerald-500"
            }
          />
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="bg-(--bg-secondary) border-t border-(--border)">
          <div className="hidden lg:grid grid-cols-9 gap-x-4 px-4 py-2.5 border-b border-(--border) bg-(--bg-card)">
            {[
              t.pna.asian.handicapType,
              t.pna.asian.betSelection,
              t.pna.asian.betAmount,
              t.pna.asian.profitLoss,
              t.pna.asian.claimableAmount,
              t.pna.asian.totalVolume,
              t.pna.asian.myShare,
              t.pna.asian.transactionHash,
              t.pna.asian.claimStatus,
            ].map((h) => (
              <span key={h} className="text-xs font-medium text-(--text-secondary)">
                {h}
              </span>
            ))}
          </div>
          {record.orderDetails.map((detail, idx) => (
            <OrderDetailRow
              key={`${detail.txHash || idx}`}
              detail={detail}
              homeName={homeName}
              awayName={awayName}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function fmtSignedPnl(profitLoss: string): string {
  if (profitLoss === "-") return "-";
  if (profitLoss.startsWith("-")) return profitLoss;
  if (profitLoss === "0.00") return profitLoss;
  return `+${profitLoss}`;
}

function Stat({
  label,
  value,
  valueClass,
  className,
}: {
  label: string;
  value: string;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <span className="text-[11px] mb-0.5 text-(--text-secondary)">{label}</span>
      <span className={cn("text-[15px] font-semibold tabular-nums text-(--text-primary)", valueClass)}>
        {value}
      </span>
    </div>
  );
}

function MobileStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs min-w-0">
      <span className="text-(--text-secondary) shrink-0">{label}</span>
      <span className={cn("font-semibold tabular-nums text-(--text-primary) truncate text-right", valueClass)}>
        {value}
      </span>
    </div>
  );
}
