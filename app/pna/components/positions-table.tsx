"use client";

import { useState } from "react";
import Image from "next/image";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { Badge } from "@/components/ui/shadcn/badge";
import useGetPositions from "@/lib/hooks/pna/use-get-positions";
import useGetClosedPositions from "@/lib/hooks/pna/use-get-closed-positions";
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
  const { positions, isLoading } = useGetPositions({ userId: targetUserId, limit: 50 });

  if (isLoading) return <RowsSkeleton cols={6} />;
  if (positions.length === 0) return <EmptyRow text="No active positions" />;

  return (
    <div className="rounded-md border border-(--border) overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Market</TableHead>
            <TableHead className="text-right">Shares</TableHead>
            <TableHead className="text-right">Avg</TableHead>
            <TableHead className="text-right">Current</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="text-right">Profit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <div className="flex items-center gap-2 min-w-0">
                  {p.icon ? (
                    <Image
                      src={p.icon}
                      alt=""
                      width={24}
                      height={24}
                      className="rounded shrink-0"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.question || p.market}</div>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {p.outcome}
                    </Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{p.shares}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtMoney(p.avgPrice)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtMoney(p.currentPrice)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtMoney(p.value)}</TableCell>
              <TableCell className="text-right tabular-nums">
                <ProfitCell profit={p.profit} pct={p.profitPct} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ClosedPositions({ targetUserId }: { targetUserId?: string }) {
  const { positions, isLoading } = useGetClosedPositions({ userId: targetUserId, limit: 50 });

  if (isLoading) return <RowsSkeleton cols={5} />;
  if (positions.length === 0) return <EmptyRow text="No closed positions" />;

  return (
    <div className="rounded-md border border-(--border) overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Market</TableHead>
            <TableHead>Result</TableHead>
            <TableHead className="text-right">Bet</TableHead>
            <TableHead className="text-right">Won</TableHead>
            <TableHead className="text-right">Profit</TableHead>
            <TableHead className="text-right">Resolved</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((p, idx) => (
            <TableRow key={`${p.eventSlug ?? "p"}-${idx}`}>
              <TableCell>
                <div className="flex items-center gap-2 min-w-0">
                  {p.icon ? (
                    <Image src={p.icon} alt="" width={24} height={24} className="rounded shrink-0" />
                  ) : null}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.question || p.market}</div>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {p.outcome}
                    </Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={p.result === "Won" ? "default" : "secondary"}>{p.result}</Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{fmtMoney(p.totalBet)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtMoney(p.amountWon)}</TableCell>
              <TableCell className="text-right tabular-nums">
                <ProfitCell profit={p.profit} pct={p.profitPct} />
              </TableCell>
              <TableCell className="text-right text-(--text-secondary) text-xs">
                {fmtUnixDate(p.resolvedAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ProfitCell({ profit, pct }: { profit: number; pct: number }) {
  const positive = profit >= 0;
  return (
    <span className={positive ? "text-emerald-500" : "text-red-500"}>
      {fmtMoney(profit)} <span className="text-xs opacity-70">({fmtPct(pct)})</span>
    </span>
  );
}

function RowsSkeleton({ cols }: { cols: number }) {
  return (
    <div className="space-y-2 p-4 border border-(--border) rounded-md">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((__, j) => (
            <Skeleton key={j} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-(--border) p-8 text-center text-sm text-(--text-secondary)">
      {text}
    </div>
  );
}
