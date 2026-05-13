"use client";

import { useState } from "react";
import Link from "next/link";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { Button } from "@/components/ui/shadcn/button";
import ProxyImage from "@/components/common/ProxyImage";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import useGetPositions, { type Position } from "@/app/pna/hooks/use-get-positions";
import useGetClosedPositions, {
  type ClosedPosition,
} from "@/app/pna/hooks/use-get-closed-positions";
import { fmtMoney, fmtPct } from "./formatters";
import { TOB_FEATURE_FLAGS } from "@/lib/hooks/tob";
import CtfActionDialog, {
  type CtfActionContext,
  type CtfActionMode,
} from "@/components/tob/CtfActionDialog";

interface PositionsTableProps {
  targetUserId?: string;
}

type SubTab = "active" | "closed";

export default function PositionsTable({ targetUserId }: PositionsTableProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SubTab>("active");

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as SubTab)}>
        <TabsList variant="line">
          <TabsTrigger value="active">{t.pna.positionFilters.active}</TabsTrigger>
          <TabsTrigger value="closed">{t.pna.positionFilters.closed}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "active" ? (
        <ActivePositions targetUserId={targetUserId} />
      ) : (
        <ClosedPositions targetUserId={targetUserId} />
      )}
    </div>
  );
}

function ActivePositions({ targetUserId }: { targetUserId?: string }) {
  const { t } = useTranslation();
  const { positions, isLoading, refresh } = useGetPositions({
    userId: targetUserId,
    limit: 100,
  });

  const showCtfActions = TOB_FEATURE_FLAGS.useNewCtf;
  const [dialogState, setDialogState] = useState<{
    mode: CtfActionMode;
    ctx: CtfActionContext;
  } | null>(null);

  const openCtf = (mode: CtfActionMode, p: Position) => {
    setDialogState({
      mode,
      ctx: {
        marketTitle: p.question || p.market,
        marketId: String(p.marketId ?? p.marketNumericId ?? ""),
        outcome: p.outcome,
        shares: Number(p.shares) || 0,
      },
    });
  };

  const columns: DataTableColumn<Position>[] = [
    {
      key: "market",
      header: t.pna.positionHeaders.market,
      cell: (p) => {
        const profit = derivedProfit(p);
        return (
          <MarketCell
            icon={p.icon}
            title={p.question || p.market}
            eventSlug={p.eventSlug}
            subtitle={
              <>
                <OutcomeBadge label={p.outcome} tone={profit >= 0 ? "positive" : "negative"} />
                <span className="text-xs text-(--text-secondary) tabular-nums">
                  {p.shares.toLocaleString()} {t.pna.activity.shares} at {fmtMoney(p.avgPrice)}
                </span>
                {p.canClaim ? (
                  <span className="inline-flex items-center gap-0.5 py-0.5 px-1.5 rounded text-[10px] font-medium bg-(--accent) text-black">
                    {t.pna.positions.claim}
                  </span>
                ) : null}
              </>
            }
          />
        );
      },
    },
    {
      key: "avg",
      header: t.pna.positionHeaders.avg,
      align: "center",
      cell: (p) => <span className="tabular-nums">{fmtMoney(p.avgPrice)}</span>,
    },
    {
      key: "current",
      header: t.pna.positionHeaders.current,
      align: "right",
      cell: (p) => <span className="tabular-nums">{fmtMoney(p.currentPrice)}</span>,
    },
    {
      key: "value",
      header: t.pna.positionHeaders.value,
      align: "right",
      cell: (p) => {
        const value = derivedValue(p);
        const profit = derivedProfit(p);
        const pct = derivedProfitPct(p);
        return (
          <div className="flex flex-col items-end">
            <span className="tabular-nums">{fmtMoney(value)}</span>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                profit >= 0 ? "text-emerald-500" : "text-red-500"
              )}
            >
              {profit >= 0 ? "+" : "-"}
              {fmtMoney(Math.abs(profit))} ({fmtPct(pct)})
            </span>
          </div>
        );
      },
    },
    ...(showCtfActions
      ? ([
          {
            key: "actions",
            header: "Actions",
            align: "right",
            cell: (p: Position) => {
              const hasMarketId = !!String(
                p.marketId ?? p.marketNumericId ?? ""
              );
              return (
                <div className="flex gap-1 justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!hasMarketId || (p.shares ?? 0) <= 0}
                    onClick={() => openCtf("split", p)}
                  >
                    Split
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!hasMarketId || (p.shares ?? 0) <= 0}
                    onClick={() => openCtf("merge", p)}
                  >
                    Merge
                  </Button>
                  <Button
                    size="sm"
                    variant={p.canClaim ? "default" : "secondary"}
                    disabled={!hasMarketId || !p.canClaim}
                    onClick={() => openCtf("redeem", p)}
                  >
                    Redeem
                  </Button>
                </div>
              );
            },
          },
        ] as DataTableColumn<Position>[])
      : []),
  ];

  return (
    <>
      <DataTable
        data={positions}
        loading={isLoading}
        rowKey={(p) => p.id}
        empty={t.pna.noPositions}
        columns={columns}
      />
      {showCtfActions && dialogState ? (
        <CtfActionDialog
          open
          mode={dialogState.mode}
          ctx={dialogState.ctx}
          onClose={() => setDialogState(null)}
          onSuccess={() => {
            refresh();
          }}
        />
      ) : null}
    </>
  );
}

// 后端 value/profit 字段不可靠（实际看到 0），用 shares × price 客户端推导，
// 与 h2-market 原始 PositionsTable 一致。
function derivedValue(p: Position): number {
  return (Number(p.shares) || 0) * (Number(p.currentPrice) || 0);
}
function derivedProfit(p: Position): number {
  const cost = (Number(p.shares) || 0) * (Number(p.avgPrice) || 0);
  return derivedValue(p) - cost;
}
function derivedProfitPct(p: Position): number {
  const cost = (Number(p.shares) || 0) * (Number(p.avgPrice) || 0);
  if (cost === 0) return 0;
  return (derivedProfit(p) / cost) * 100;
}

function ClosedPositions({ targetUserId }: { targetUserId?: string }) {
  const { t } = useTranslation();
  const { positions, isLoading } = useGetClosedPositions({ userId: targetUserId, limit: 100 });

  const columns: DataTableColumn<ClosedPosition>[] = [
    {
      key: "market",
      header: t.pna.positionHeaders.market,
      cell: (p) => {
        const won = p.result === "Won";
        return (
          <MarketCell
            icon={p.icon}
            title={p.question || p.market}
            eventSlug={p.eventSlug}
            subtitle={
              <>
                <OutcomeBadge label={p.outcome} tone={won ? "positive" : "negative"} />
                <span className="text-xs text-(--text-secondary)">
                  {won ? `🏆 ${t.pna.positions.won}` : `❌ ${t.pna.positions.lost}`}
                </span>
              </>
            }
          />
        );
      },
    },
    {
      key: "bet",
      header: t.pna.positionHeaders.bet,
      align: "right",
      cell: (p) => <span className="tabular-nums">{fmtMoney(p.totalBet)}</span>,
    },
    {
      key: "value",
      header: t.pna.positionHeaders.value,
      align: "right",
      cell: (p) => <span className="tabular-nums">{fmtMoney(p.amountWon)}</span>,
    },
    {
      key: "profit",
      header: t.pna.profitLossLabel,
      align: "right",
      cell: (p) => {
        const positive = p.profit >= 0;
        const sign = positive ? "+" : "-";
        return (
          <div
            className={cn(
              "flex flex-col items-end tabular-nums",
              positive ? "text-emerald-500" : "text-red-500"
            )}
          >
            <span className="font-medium">
              {sign}
              {fmtMoney(Math.abs(p.profit))}
            </span>
            <span className="text-[11px]">({fmtPct(p.profitPct)})</span>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      data={positions}
      loading={isLoading}
      rowKey={(p, i) => `${p.eventSlug ?? "p"}-${i}`}
      empty={t.pna.noPositions}
      columns={columns}
    />
  );
}

interface MarketCellProps {
  icon: string | null;
  title: string;
  eventSlug?: string | null;
  subtitle?: React.ReactNode;
}

function MarketCell({ icon, title, eventSlug, subtitle }: MarketCellProps) {
  const titleNode = eventSlug ? (
    <Link
      href={`/market/${eventSlug}`}
      className="truncate font-medium hover:underline"
      title={title}
    >
      {title}
    </Link>
  ) : (
    <span className="truncate font-medium" title={title}>
      {title}
    </span>
  );

  return (
    <div className="flex items-center gap-2 min-w-0">
      {icon ? (
        <ProxyImage src={icon} alt="" className="size-8 rounded shrink-0 object-cover" />
      ) : null}
      <div className="min-w-0 flex flex-col gap-1">
        {titleNode}
        {subtitle ? (
          <div className="flex items-center gap-2 flex-wrap">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Outcome 徽章 —— 默认按 outcome 文字语义着色（up/YES/over → 绿；down/NO/under → 红）。
 * 调用方传 tone 时优先用 tone（如活跃持仓里按 profit 正负着色，与 h2-market 对齐）。
 */
function OutcomeBadge({
  label,
  tone,
}: {
  label: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const finalTone = tone ?? outcomeTone(label);
  const cls =
    finalTone === "positive"
      ? "bg-emerald-500/15 text-emerald-500"
      : finalTone === "negative"
        ? "bg-red-500/15 text-red-500"
        : "bg-(--bg-secondary) text-(--text-secondary)";
  return (
    <span className={cn("py-0.5 px-2 rounded text-xs font-medium whitespace-nowrap", cls)}>
      {label}
    </span>
  );
}

const POSITIVE_TOKENS = new Set(["yes", "y", "up", "over", "won", "win", "more"]);
const NEGATIVE_TOKENS = new Set(["no", "n", "down", "under", "lost", "lose", "less"]);

function outcomeTone(label: string): "positive" | "negative" | "neutral" {
  const k = (label ?? "").trim().toLowerCase();
  if (POSITIVE_TOKENS.has(k)) return "positive";
  if (NEGATIVE_TOKENS.has(k)) return "negative";
  return "neutral";
}

export { MarketCell };
