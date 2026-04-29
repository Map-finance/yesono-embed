"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { Badge } from "@/components/ui/shadcn/badge";
import ProxyImage from "@/components/common/ProxyImage";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import useGetPositions from "@/lib/hooks/pna/use-get-positions";
import useGetClosedPositions from "@/lib/hooks/pna/use-get-closed-positions";
import type { Position } from "@/lib/hooks/pna/use-get-positions";
import type { ClosedPosition } from "@/lib/hooks/pna/use-get-closed-positions";
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
    cell: (p) => <MarketCell icon={p.icon} title={p.question || p.market} outcome={p.outcome} />,
  },
  { key: "shares", header: "Shares", align: "right", cell: (p) => <span className="tabular-nums">{p.shares}</span> },
  { key: "avg", header: "Avg", align: "right", cell: (p) => <span className="tabular-nums">{fmtMoney(p.avgPrice)}</span> },
  { key: "current", header: "Current", align: "right", cell: (p) => <span className="tabular-nums">{fmtMoney(p.currentPrice)}</span> },
  { key: "value", header: "Value", align: "right", cell: (p) => <span className="tabular-nums">{fmtMoney(p.value)}</span> },
  { key: "profit", header: "Profit", align: "right", cell: (p) => <ProfitCell profit={p.profit} pct={p.profitPct} /> },
];

const CLOSED_COLUMNS: DataTableColumn<ClosedPosition>[] = [
  {
    key: "market",
    header: "Market",
    cell: (p) => <MarketCell icon={p.icon} title={p.question || p.market} outcome={p.outcome} />,
  },
  {
    key: "result",
    header: "Result",
    cell: (p) => <Badge variant={p.result === "Won" ? "default" : "secondary"}>{p.result}</Badge>,
  },
  { key: "bet", header: "Bet", align: "right", cell: (p) => <span className="tabular-nums">{fmtMoney(p.totalBet)}</span> },
  { key: "won", header: "Won", align: "right", cell: (p) => <span className="tabular-nums">{fmtMoney(p.amountWon)}</span> },
  { key: "profit", header: "Profit", align: "right", cell: (p) => <ProfitCell profit={p.profit} pct={p.profitPct} /> },
  {
    key: "resolved",
    header: "Resolved",
    align: "right",
    cell: (p) => <span className="text-xs text-(--text-secondary)">{fmtUnixDate(p.resolvedAt)}</span>,
  },
];

function MarketCell({ icon, title, outcome }: { icon: string | null; title: string; outcome: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {icon ? (
        <ProxyImage src={icon} alt="" className="size-6 rounded shrink-0 object-cover" />
      ) : null}
      <div className="min-w-0">
        <div className="truncate font-medium">{title}</div>
        <Badge variant="outline" className="mt-1 text-xs">
          {outcome}
        </Badge>
      </div>
    </div>
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
