"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/shadcn/badge";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import useGetOrders from "@/lib/hooks/pna/use-get-orders";
import useAsianOrderBook from "@/lib/hooks/pna/use-asian-order-book";
import type { UserOrder } from "@/lib/api";
import { fmtMoney, fmtUnixDateTime } from "./formatters";

interface OrdersTableProps {
  targetUserId?: string;
  mode: "yesNo" | "asian";
}

const ASIAN_PAGE_SIZE = 25;

export default function OrdersTable({ targetUserId, mode }: OrdersTableProps) {
  if (mode === "yesNo") return <YesNoOrders targetUserId={targetUserId} />;
  return <AsianOrders />;
}

interface YesNoOrder {
  orderId?: string | number;
  id?: string | number;
  question?: string;
  side?: "Buy" | "Sell";
  outcome?: string;
  price?: number;
  filled?: number;
  shares?: number;
  total?: number;
  expiresAt?: number | string;
}

function YesNoOrders({ targetUserId }: { targetUserId?: string }) {
  const { orders, isLoading } = useGetOrders({ userId: targetUserId });

  return (
    <DataTable
      data={orders as YesNoOrder[]}
      loading={isLoading}
      rowKey={(o, i) => String(o.orderId ?? o.id ?? i)}
      empty="No open Yes/No orders"
      columns={YESNO_COLUMNS}
    />
  );
}

function AsianOrders() {
  const [page, setPage] = useState(1);
  const { rows, total, isLoading } = useAsianOrderBook({
    page,
    size: ASIAN_PAGE_SIZE,
  });

  return (
    <DataTable
      data={rows}
      loading={isLoading}
      rowKey={(o) => String(o.id)}
      empty="No Asian Handicap orders"
      columns={ASIAN_COLUMNS}
      pagination={{
        page,
        pageSize: ASIAN_PAGE_SIZE,
        total,
        onPageChange: setPage,
      }}
    />
  );
}

const YESNO_COLUMNS: DataTableColumn<YesNoOrder>[] = [
  {
    key: "market",
    header: "Market",
    cell: (o) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{o.question || "—"}</div>
        {o.outcome ? <div className="text-xs text-(--text-secondary) truncate">{o.outcome}</div> : null}
      </div>
    ),
  },
  {
    key: "side",
    header: "Side",
    cell: (o) => <Badge variant={o.side === "Sell" ? "secondary" : "default"}>{o.side ?? "Buy"}</Badge>,
  },
  { key: "price", header: "Price", align: "right", cell: (o) => <span className="tabular-nums">{fmtMoney(o.price)}</span> },
  {
    key: "filled",
    header: "Filled",
    align: "right",
    cell: (o) => (
      <span className="tabular-nums">{o.filled ?? 0} / {o.shares ?? 0}</span>
    ),
  },
  { key: "total", header: "Total", align: "right", cell: (o) => <span className="tabular-nums">{fmtMoney(o.total)}</span> },
  {
    key: "expires",
    header: "Expires",
    align: "right",
    cell: (o) => (
      <span className="text-xs text-(--text-secondary)">
        {typeof o.expiresAt === "number" ? fmtUnixDateTime(o.expiresAt) : (o.expiresAt ?? "—")}
      </span>
    ),
  },
];

const ASIAN_COLUMNS: DataTableColumn<UserOrder>[] = [
  { key: "market", header: "Market", cell: (o) => <span className="truncate font-medium">Market #{o.marketId}</span> },
  {
    key: "type",
    header: "Type",
    cell: (o) => <Badge variant={o.type === "stake" ? "default" : "secondary"}>{o.type}</Badge>,
  },
  { key: "amount", header: "Amount", align: "right", cell: (o) => <span className="tabular-nums">{fmtMoney(o.amount)}</span> },
  { key: "status", header: "Status", cell: (o) => <StatusBadge status={o.status} /> },
  {
    key: "when",
    header: "When",
    align: "right",
    cell: (o) => <span className="text-xs text-(--text-secondary)">{fmtUnixDateTime(o.chainTimestamp)}</span>,
  },
];

function StatusBadge({ status }: { status: "SUCCESS" | "PENDING" | "FAIL" }) {
  const variant: "default" | "secondary" | "outline" =
    status === "SUCCESS" ? "default" : status === "PENDING" ? "outline" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}
