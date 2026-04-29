"use client";

import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ExternalLink } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { Badge } from "@/components/ui/shadcn/badge";
import { Button } from "@/components/ui/shadcn/button";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import useGetActivity, { type Activity } from "@/lib/hooks/pna/use-get-activity";
import useGetChainTransactions, {
  type ChainTransaction,
} from "@/lib/hooks/pna/use-get-chain-transactions";
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
  const { activities, isLoading } = useGetActivity({ userId: targetUserId, limit: 100 });

  return (
    <DataTable
      data={activities}
      loading={isLoading}
      rowKey={(a, i) => `${a.txHash}-${i}`}
      empty="No activity"
      columns={TRADE_COLUMNS}
    />
  );
}

function ChainTxList({ targetUserId }: { targetUserId?: string }) {
  const { transactions, isLoading, isLoadingMore, hasMore, loadMore } =
    useGetChainTransactions({ userId: targetUserId, pageSize: 25 });

  return (
    <DataTable
      data={transactions}
      loading={isLoading}
      rowKey={(tx, i) => `${tx.txHash ?? "tx"}-${i}`}
      empty="No chain transactions"
      columns={CHAIN_COLUMNS}
      footer={
        hasMore ? (
          <div className="flex justify-center p-2 border-t border-(--border)">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="h-7 text-xs"
            >
              {isLoadingMore ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null
      }
    />
  );
}

const TRADE_COLUMNS: DataTableColumn<Activity>[] = [
  { key: "type", header: "Type", cell: (a) => <ActivityTypeBadge type={a.type} /> },
  {
    key: "market",
    header: "Market",
    cell: (a) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{a.market || "—"}</div>
        {a.outcomeName ? (
          <div className="text-xs text-(--text-secondary) truncate">{a.outcomeName}</div>
        ) : null}
      </div>
    ),
  },
  { key: "shares", header: "Shares", align: "right", cell: (a) => <span className="tabular-nums">{a.shares ?? "—"}</span> },
  { key: "price", header: "Price", align: "right", cell: (a) => <span className="tabular-nums">{fmtMoney(a.price)}</span> },
  { key: "amount", header: "Amount", align: "right", cell: (a) => <span className="tabular-nums">{fmtMoney(a.amount)}</span> },
  { key: "when", header: "When", align: "right", cell: (a) => <span className="text-xs text-(--text-secondary)">{fmtUnixDateTime(a.timestamp)}</span> },
];

const CHAIN_COLUMNS: DataTableColumn<ChainTransaction>[] = [
  { key: "type", header: "Type", cell: (tx) => <ActivityTypeBadge type={tx.type} /> },
  { key: "market", header: "Market", cell: (tx) => <span className="truncate font-medium">{tx.market || "—"}</span> },
  { key: "amount", header: "Amount", align: "right", cell: (tx) => <span className="tabular-nums">{fmtMoney(tx.amount)}</span> },
  {
    key: "when",
    header: "When",
    align: "right",
    cell: (tx) => (
      <span className="inline-flex items-center gap-1 text-xs text-(--text-secondary)">
        {fmtUnixDateTime(tx.timestamp)}
        {tx.txHash ? <ExternalLink className="size-3 opacity-50" /> : null}
      </span>
    ),
  },
];

function ActivityTypeBadge({ type }: { type: string }) {
  const variant: "default" | "secondary" | "outline" =
    type === "Buy" ? "default" : type === "Sell" ? "secondary" : "outline";
  const Icon = type === "DEPOSIT" ? ArrowDownToLine : type === "WITHDRAW" ? ArrowUpFromLine : null;
  return (
    <Badge variant={variant} className="gap-1">
      {Icon ? <Icon className="size-3" /> : null}
      {type}
    </Badge>
  );
}
