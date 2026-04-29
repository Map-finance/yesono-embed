"use client";

import { useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { Badge } from "@/components/ui/shadcn/badge";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { cn } from "@/lib/utils";
import { MarketCell } from "./positions-table";
import useGetOrders from "@/lib/hooks/pna/use-get-orders";
import useAsianOrderBook from "@/lib/hooks/pna/use-asian-order-book";
import useAsianTransactions from "@/lib/hooks/pna/use-asian-transactions";
import useAsianMarketRecords, {
  type AsianMarketRecord,
} from "@/lib/hooks/pna/use-asian-market-records";
import type { UserOrder } from "@/lib/api";
import type { ApiTransactionRecord } from "@/types/pna";
import { fmtMoney, fmtUnixDateTime } from "./formatters";

interface OrdersTableProps {
  targetUserId?: string;
  mode: "yesNo" | "asian";
}

const PAGE_SIZE = 25;

export default function OrdersTable({ targetUserId, mode }: OrdersTableProps) {
  if (mode === "yesNo") return <YesNoOrders targetUserId={targetUserId} />;
  return <AsianOrders />;
}

// ────────────────────────────────────────────────────────────
// Yes/No 模式
// ────────────────────────────────────────────────────────────

interface YesNoOrder {
  orderId?: string | number;
  id?: string | number;
  question?: string;
  side?: "Buy" | "Sell";
  outcome?: string;
  outComeUnionKey?: string;
  price?: number;
  orderPrice?: number;
  filled?: number;
  filledSize?: number;
  shares?: number;
  placedSize?: number;
  total?: number;
  placedAmount?: number;
  expiresAt?: number | string;
  // 下面这几个原 API 返回但旧 interface 没声明
  icon?: string | null;
  eventImage?: string | null;
  eventSlug?: string | null;
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

const YESNO_COLUMNS: DataTableColumn<YesNoOrder>[] = [
  {
    key: "market",
    header: "Market",
    cell: (o) => {
      const side = o.side ?? "Buy";
      const outcomeLabel = o.outcome ?? o.outComeUnionKey;
      const price = o.price ?? o.orderPrice;
      return (
        <MarketCell
          icon={o.eventImage ?? o.icon ?? null}
          title={o.question || "—"}
          eventSlug={o.eventSlug ?? null}
          subtitle={
            <>
              <span
                className={cn(
                  "text-xs font-medium capitalize",
                  side === "Sell" ? "text-red-500" : "text-emerald-500"
                )}
              >
                {side}
              </span>
              {outcomeLabel ? (
                <span className="py-0.5 px-2 rounded text-xs font-medium bg-(--bg-secondary) text-(--text-primary)">
                  {outcomeLabel}
                  {price ? ` · ${fmtCents(price)}` : ""}
                </span>
              ) : null}
            </>
          }
        />
      );
    },
  },
  {
    key: "filled",
    header: "Filled",
    align: "right",
    cell: (o) => (
      <span className="tabular-nums">
        {o.filled ?? o.filledSize ?? 0} / {o.shares ?? o.placedSize ?? 0}
      </span>
    ),
    className: "max-md:hidden",
    headerClassName: "max-md:hidden",
  },
  {
    key: "total",
    header: "Total",
    align: "right",
    cell: (o) => <span className="tabular-nums">{fmtMoney(o.total ?? o.placedAmount)}</span>,
  },
  {
    key: "expires",
    header: "Expires",
    align: "right",
    cell: (o) => (
      <span className="text-xs text-(--text-secondary)">
        {typeof o.expiresAt === "number" ? fmtUnixDateTime(o.expiresAt) : (o.expiresAt ?? "—")}
      </span>
    ),
    className: "max-md:hidden",
    headerClassName: "max-md:hidden",
  },
];

/** 价格 cents 格式：0.65 → "65¢"；其他保留 2 位 */
function fmtCents(price: number): string {
  if (!Number.isFinite(price)) return "—";
  if (price > 0 && price < 1) return `${(price * 100).toFixed(0)}¢`;
  return fmtMoney(price);
}

// ────────────────────────────────────────────────────────────
// Asian 模式：3 个子 tab（订单簿 / 交易记录 / 开盘记录）
// ────────────────────────────────────────────────────────────

type AsianSubTab = "orderbook" | "transactions" | "records";

function AsianOrders() {
  const [tab, setTab] = useState<AsianSubTab>("orderbook");

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as AsianSubTab)}>
        <TabsList className="bg-(--bg-card) border border-(--border)">
          <TabsTrigger value="orderbook">Order Book</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="records">Open Records</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "orderbook" && <AsianOrderBookView />}
      {tab === "transactions" && <AsianTransactionsView />}
      {tab === "records" && <AsianOpenRecordsView />}
    </div>
  );
}

function AsianOrderBookView() {
  const [page, setPage] = useState(1);
  const { rows, total, isLoading } = useAsianOrderBook({ page, size: PAGE_SIZE });

  return (
    <DataTable
      data={rows}
      loading={isLoading}
      rowKey={(o) => String(o.id)}
      empty="No Asian Handicap orders"
      columns={ORDERBOOK_COLUMNS}
      pagination={{ page, pageSize: PAGE_SIZE, total, onPageChange: setPage }}
    />
  );
}

function AsianTransactionsView() {
  const [page, setPage] = useState(1);
  const { rows, total, isLoading } = useAsianTransactions({ page, size: PAGE_SIZE });

  return (
    <DataTable
      data={rows}
      loading={isLoading}
      rowKey={(t) => String(t.id)}
      empty="No transactions"
      columns={TRANSACTION_COLUMNS}
      pagination={{ page, pageSize: PAGE_SIZE, total, onPageChange: setPage }}
    />
  );
}

function AsianOpenRecordsView() {
  const [page, setPage] = useState(1);
  const { rows, total, isLoading } = useAsianMarketRecords({ page, size: PAGE_SIZE });

  return (
    <DataTable
      data={rows}
      loading={isLoading}
      rowKey={(r, i) => String(r.id ?? r.serialNumber ?? i)}
      empty="No open records"
      columns={OPEN_RECORDS_COLUMNS}
      pagination={{ page, pageSize: PAGE_SIZE, total, onPageChange: setPage }}
    />
  );
}

// ────────────────────────────────────────────────────────────
// Asian 子 tab 列定义
// ────────────────────────────────────────────────────────────

const ORDERBOOK_COLUMNS: DataTableColumn<UserOrder>[] = [
  { key: "market", header: "Market", cell: (o) => <span className="truncate font-medium">Market #{o.marketId}</span> },
  {
    key: "type",
    header: "Type",
    cell: (o) => <Badge variant={o.type === "stake" ? "default" : "secondary"}>{o.type}</Badge>,
  },
  { key: "amount", header: "Amount", align: "right", cell: (o) => <span className="tabular-nums">{fmtMoney(o.amount)}</span> },
  { key: "status", header: "Status", cell: (o) => <OrderStatusBadge status={o.status} /> },
  {
    key: "when",
    header: "When",
    align: "right",
    cell: (o) => <span className="text-xs text-(--text-secondary)">{fmtUnixDateTime(o.chainTimestamp)}</span>,
  },
];

const TRANSACTION_COLUMNS: DataTableColumn<ApiTransactionRecord>[] = [
  {
    key: "event",
    header: "Event",
    cell: (t) => <span className="truncate font-medium">{t.eventName || `Market #${t.marketId}`}</span>,
  },
  { key: "type", header: "Type", cell: (t) => <Badge variant="outline">{t.type ?? "—"}</Badge> },
  { key: "amount", header: "Amount", align: "right", cell: (t) => <span className="tabular-nums">{fmtMoney(t.amount)}</span> },
  {
    key: "status",
    header: "Status",
    cell: (t) => <Badge variant={t.status === "SUCCESS" ? "default" : "secondary"}>{t.status ?? "—"}</Badge>,
  },
  {
    key: "when",
    header: "When",
    align: "right",
    cell: (t) => <span className="text-xs text-(--text-secondary)">{fmtUnixDateTime(t.chainTimestamp || t.createdAt)}</span>,
  },
];

const OPEN_RECORDS_COLUMNS: DataTableColumn<AsianMarketRecord>[] = [
  {
    key: "event",
    header: "Event",
    cell: (r) => (
      <div className="min-w-0">
        <div className="truncate font-medium">{r.event || "—"}</div>
        {r.league ? <div className="text-xs text-(--text-secondary) truncate">{r.league}</div> : null}
      </div>
    ),
  },
  {
    key: "handicap",
    header: "Handicap",
    cell: (r) => (
      <span className="text-xs">
        {r.handicapType ? <span className="text-(--text-secondary) mr-1">{r.handicapType}</span> : null}
        <span className="tabular-nums">{r.handicap || "—"}</span>
      </span>
    ),
  },
  {
    key: "pool",
    header: "Pool (H/A)",
    align: "right",
    cell: (r) => (
      <span className="tabular-nums text-xs">
        {r.homeTeamPool ?? "—"} / {r.awayTeamPool ?? "—"}
      </span>
    ),
  },
  { key: "fee", header: "Fee", align: "right", cell: (r) => <span className="tabular-nums">{r.setupFee || "—"}</span> },
  {
    key: "status",
    header: "Status",
    cell: (r) => <Badge variant="outline">{r.eventStatus || "—"}</Badge>,
  },
  {
    key: "when",
    header: "Created",
    align: "right",
    cell: (r) => (
      <span className="text-xs text-(--text-secondary)">
        {typeof r.createTime === "number" ? fmtUnixDateTime(r.createTime) : (r.createTime ?? "—")}
      </span>
    ),
  },
];

function OrderStatusBadge({ status }: { status: "SUCCESS" | "PENDING" | "FAIL" }) {
  const variant: "default" | "secondary" | "outline" =
    status === "SUCCESS" ? "default" : status === "PENDING" ? "outline" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}
