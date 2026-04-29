"use client";

import { useState } from "react";
import Link from "next/link";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { Badge } from "@/components/ui/shadcn/badge";
import ProxyImage from "@/components/common/ProxyImage";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import useGetPositions, { type Position } from "@/lib/hooks/pna/use-get-positions";
import useGetClosedPositions, {
  type ClosedPosition,
} from "@/lib/hooks/pna/use-get-closed-positions";
import { fmtMoney, fmtPct, fmtUnixDate } from "./formatters";

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
        <TabsList variant="line" className="border-b border-(--border) [&_[data-active]]:after:bg-(--accent) [&_[data-active]]:text-(--text-primary)">
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
  const { positions, isLoading } = useGetPositions({ userId: targetUserId, limit: 100 });

  const columns: DataTableColumn<Position>[] = [
    {
      key: "market",
      header: t.pna.positionHeaders.market,
      cell: (p) => (
        <MarketCell
          icon={p.icon}
          title={p.question || p.market}
          eventSlug={p.eventSlug}
          subtitle={
            <>
              <OutcomeBadge label={p.outcome} />
              <span className="text-xs text-(--text-secondary) tabular-nums">
                {p.shares.toLocaleString()} {t.pna.activity.shares} · {t.pna.positionHeaders.avg} {fmtMoney(p.avgPrice)}
              </span>
              {p.canClaim ? (
                <span className="inline-flex items-center gap-0.5 py-0.5 px-1.5 rounded text-[10px] font-medium bg-(--accent)/15 text-(--accent)">
                  ● {t.pna.positions.claimable}
                </span>
              ) : null}
            </>
          }
        />
      ),
    },
    {
      key: "current",
      header: t.pna.positionHeaders.current,
      align: "right",
      cell: (p) => <span className="tabular-nums">{fmtMoney(p.currentPrice)}</span>,
      className: "max-md:hidden",
      headerClassName: "max-md:hidden",
    },
    {
      key: "value",
      header: t.pna.positionHeaders.value,
      align: "right",
      cell: (p) => <span className="tabular-nums">{fmtMoney(p.value)}</span>,
    },
    {
      key: "profit",
      header: t.pna.profitLossLabel,
      align: "right",
      cell: (p) => <ProfitCell profit={p.profit} pct={p.profitPct} />,
    },
  ];

  return (
    <DataTable
      data={positions}
      loading={isLoading}
      rowKey={(p) => p.id}
      empty={t.pna.noPositions}
      columns={columns}
    />
  );
}

function ClosedPositions({ targetUserId }: { targetUserId?: string }) {
  const { t } = useTranslation();
  const { positions, isLoading } = useGetClosedPositions({ userId: targetUserId, limit: 100 });

  const columns: DataTableColumn<ClosedPosition>[] = [
    {
      key: "market",
      header: t.pna.positionHeaders.market,
      cell: (p) => (
        <MarketCell
          icon={p.icon}
          title={p.question || p.market}
          eventSlug={p.eventSlug}
          subtitle={<OutcomeBadge label={p.outcome} />}
        />
      ),
    },
    {
      key: "result",
      header: t.pna.positions.result,
      cell: (p) => {
        const won = p.result === "Won";
        return (
          <Badge variant={won ? "default" : "secondary"}>
            {won ? t.pna.positions.won : t.pna.positions.lost}
          </Badge>
        );
      },
    },
    {
      key: "bet",
      header: t.pna.positionHeaders.bet,
      align: "right",
      cell: (p) => <span className="tabular-nums">{fmtMoney(p.totalBet)}</span>,
      className: "max-md:hidden",
      headerClassName: "max-md:hidden",
    },
    {
      key: "won",
      header: t.pna.positions.won,
      align: "right",
      cell: (p) => <span className="tabular-nums">{fmtMoney(p.amountWon)}</span>,
      className: "max-md:hidden",
      headerClassName: "max-md:hidden",
    },
    {
      key: "profit",
      header: t.pna.profitLossLabel,
      align: "right",
      cell: (p) => <ProfitCell profit={p.profit} pct={p.profitPct} />,
    },
    {
      key: "resolved",
      header: t.pna.positions.resolved,
      align: "right",
      cell: (p) => (
        <span className="text-xs text-(--text-secondary)">{fmtUnixDate(p.resolvedAt)}</span>
      ),
      className: "max-md:hidden",
      headerClassName: "max-md:hidden",
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
 * Outcome 徽章 —— 按 outcome 文字语义着色（不是按 profit 正负）。
 * up/YES/over → 绿；down/NO/under → 红；其余中性灰。
 */
function OutcomeBadge({ label }: { label: string }) {
  const tone = outcomeTone(label);
  const cls =
    tone === "positive"
      ? "bg-emerald-500/15 text-emerald-500"
      : tone === "negative"
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

/**
 * 盈亏单元格：profit === 0 时仅显示 "—"，避免 "$0.00 (0.00%)" 视觉噪音。
 */
function ProfitCell({ profit, pct }: { profit: number; pct: number }) {
  if (!Number.isFinite(profit) || profit === 0) {
    return <span className="text-(--text-secondary) tabular-nums">—</span>;
  }
  const positive = profit > 0;
  return (
    <span className={positive ? "text-emerald-500" : "text-red-500"}>
      <span className="tabular-nums">{fmtMoney(profit)}</span>{" "}
      <span className="text-xs opacity-70 tabular-nums">({fmtPct(pct)})</span>
    </span>
  );
}

export { MarketCell };
