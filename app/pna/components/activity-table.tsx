"use client";

import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink } from "lucide-react";

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
import useGetActivity from "@/lib/hooks/pna/use-get-activity";
import useGetChainTransactions from "@/lib/hooks/pna/use-get-chain-transactions";
import { fmtMoney, fmtUnixDateTime } from "./formatters";

interface ActivityTableProps {
  targetUserId?: string;
}

type SubTab = "trades" | "chain";

export default function ActivityTable({ targetUserId }: ActivityTableProps) {
  const [tab, setTab] = useState<SubTab>("trades");

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as SubTab)}>
        <TabsList className="bg-(--bg-card) border border-(--border)">
          <TabsTrigger value="trades">Trades</TabsTrigger>
          <TabsTrigger value="chain">Chain Tx</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "trades" ? (
        <TradesList targetUserId={targetUserId} />
      ) : (
        <ChainTxList targetUserId={targetUserId} />
      )}
    </div>
  );
}

function TradesList({ targetUserId }: { targetUserId?: string }) {
  const { activities, isLoading } = useGetActivity({ userId: targetUserId, limit: 50 });

  if (isLoading) return <RowsSkeleton cols={5} />;
  if (activities.length === 0) return <EmptyRow text="No activity" />;

  return (
    <div className="rounded-md border border-(--border) overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Market</TableHead>
            <TableHead className="text-right">Shares</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.map((a, idx) => (
            <TableRow key={`${a.txHash}-${idx}`}>
              <TableCell>
                <ActivityTypeBadge type={a.type} />
              </TableCell>
              <TableCell className="min-w-0">
                <div className="truncate font-medium">{a.market || "—"}</div>
                {a.outcomeName ? (
                  <div className="text-xs text-(--text-secondary) truncate">{a.outcomeName}</div>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">{a.shares ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtMoney(a.price)}</TableCell>
              <TableCell className="text-right tabular-nums">{fmtMoney(a.amount)}</TableCell>
              <TableCell className="text-right text-xs text-(--text-secondary)">
                {fmtUnixDateTime(a.timestamp)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ChainTxList({ targetUserId }: { targetUserId?: string }) {
  const { transactions, isLoading, isLoadingMore, hasMore, loadMore } =
    useGetChainTransactions({ userId: targetUserId, pageSize: 25 });

  const rows = useMemo(() => transactions, [transactions]);

  if (isLoading && rows.length === 0) return <RowsSkeleton cols={4} />;
  if (rows.length === 0) return <EmptyRow text="No chain transactions" />;

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-(--border) overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Market</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((tx, idx) => (
              <TableRow key={`${tx.txHash ?? "tx"}-${idx}`}>
                <TableCell>
                  <ActivityTypeBadge type={tx.type} />
                </TableCell>
                <TableCell className="truncate font-medium">{tx.market || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtMoney(tx.amount)}</TableCell>
                <TableCell className="text-right text-xs text-(--text-secondary)">
                  <span className="inline-flex items-center gap-1">
                    {fmtUnixDateTime(tx.timestamp)}
                    {tx.txHash ? <ExternalLink className="size-3 opacity-50" /> : null}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="px-4 py-1.5 text-xs rounded border border-(--border) hover:bg-(--bg-secondary) transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}

function ActivityTypeBadge({ type }: { type: string }) {
  const variant: "default" | "secondary" | "outline" = type === "Buy"
    ? "default"
    : type === "Sell"
      ? "secondary"
      : "outline";

  const Icon =
    type === "DEPOSIT"
      ? ArrowDownToLine
      : type === "WITHDRAW"
        ? ArrowUpFromLine
        : null;

  return (
    <Badge variant={variant} className="gap-1">
      {Icon ? <Icon className="size-3" /> : null}
      {type}
    </Badge>
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
