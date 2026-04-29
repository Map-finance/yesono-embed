"use client";

import { useState } from "react";
import Link from "next/link";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { Badge } from "@/components/ui/shadcn/badge";
import ProxyImage from "@/components/common/ProxyImage";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { cn } from "@/lib/utils";
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
  const [tab, setTab] = useState<SubTab>("active");

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as SubTab)}>
        <TabsList className="bg-(--bg-card) border border-(--border)">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
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
  const { positions, isLoading } = useGetPositions({ userId: targetUserId, limit: 100 });

  return (
    <DataTable
      data={positions}
      loading={isLoading}
      rowKey={(p) => p.id}
      empty="No active positions"
      columns={ACTIVE_COLUMNS}
    />
  );
}

function ClosedPositions({ targetUserId }: { targetUserId?: string }) {
  const { positions, isLoading } = useGetClosedPositions({ userId: targetUserId, limit: 100 });

  return (
    <DataTable
      data={positions}
      loading={isLoading}
      rowKey={(p, i) => `${p.eventSlug ?? "p"}-${i}`}
      empty="No closed positions"
      columns={CLOSED_COLUMNS}
    />
  );
}

const ACTIVE_COLUMNS: DataTableColumn<Position>[] = [
  {
    key: "market",
    header: "Market",
    cell: (p) => (
      <MarketCell
        icon={p.icon}
        title={p.question || p.market}
        eventSlug={p.eventSlug}
        subtitle={
          <>
            <OutcomeBadge label={p.outcome} positive={p.profit >= 0} />
            <span className="text-xs text-(--text-secondary) tabular-nums">
              {p.shares.toLocaleString()} shares · avg {fmtMoney(p.avgPrice)}
            </span>
            {p.canClaim ? (
              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                Claimable
              </Badge>
            ) : null}
          </>
        }
      />
    ),
  },
  {
    key: "current",
    header: "Current",
    align: "right",
    cell: (p) => <span className="tabular-nums">{fmtMoney(p.currentPrice)}</span>,
    className: "max-md:hidden",
    headerClassName: "max-md:hidden",
  },
  {
    key: "value",
    header: "Value",
    align: "right",
    cell: (p) => <span className="tabular-nums">{fmtMoney(p.value)}</span>,
  },
  {
    key: "profit",
    header: "Profit",
    align: "right",
    cell: (p) => <ProfitCell profit={p.profit} pct={p.profitPct} />,
  },
];

const CLOSED_COLUMNS: DataTableColumn<ClosedPosition>[] = [
  {
    key: "market",
    header: "Market",
    cell: (p) => (
      <MarketCell
        icon={p.icon}
        title={p.question || p.market}
        eventSlug={p.eventSlug}
        subtitle={<OutcomeBadge label={p.outcome} positive={p.result === "Won"} />}
      />
    ),
  },
  {
    key: "result",
    header: "Result",
    cell: (p) => (
      <Badge variant={p.result === "Won" ? "default" : "secondary"}>{p.result}</Badge>
    ),
  },
  {
    key: "bet",
    header: "Bet",
    align: "right",
    cell: (p) => <span className="tabular-nums">{fmtMoney(p.totalBet)}</span>,
    className: "max-md:hidden",
    headerClassName: "max-md:hidden",
  },
  {
    key: "won",
    header: "Won",
    align: "right",
    cell: (p) => <span className="tabular-nums">{fmtMoney(p.amountWon)}</span>,
    className: "max-md:hidden",
    headerClassName: "max-md:hidden",
  },
  { key: "profit", header: "Profit", align: "right", cell: (p) => <ProfitCell profit={p.profit} pct={p.profitPct} /> },
  {
    key: "resolved",
    header: "Resolved",
    align: "right",
    cell: (p) => (
      <span className="text-xs text-(--text-secondary)">{fmtUnixDate(p.resolvedAt)}</span>
    ),
    className: "max-md:hidden",
    headerClassName: "max-md:hidden",
  },
];

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

function OutcomeBadge({ label, positive }: { label: string; positive: boolean }) {
  return (
    <span
      className={cn(
        "py-0.5 px-2 rounded text-xs font-medium whitespace-nowrap",
        positive ? "bg-emerald-500/15 text-emerald-500" : "bg-red-500/15 text-red-500"
      )}
    >
      {label}
    </span>
  );
}

function ProfitCell({ profit, pct }: { profit: number; pct: number }) {
  const positive = profit >= 0;
  return (
    <span className={positive ? "text-emerald-500" : "text-red-500"}>
      <span className="tabular-nums">{fmtMoney(profit)}</span>{" "}
      <span className="text-xs opacity-70 tabular-nums">({fmtPct(pct)})</span>
    </span>
  );
}

export { MarketCell };
