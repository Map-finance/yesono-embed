"use client";

import { useState } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { Badge } from "@/components/ui/shadcn/badge";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
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
  const { t } = useTranslation();
  const { orders, isLoading } = useGetOrders({ userId: targetUserId });

  const columns: DataTableColumn<YesNoOrder>[] = [
    {
      key: "market",
      header: t.pna.orders.market,
      cell: (o) => {
        const side = o.side ?? "Buy";
        const outcomeLabel = o.outcome ?? o.outComeUnionKey;
        const price = o.price ?? o.orderPrice;
        const sideLabel = side === "Sell" ? t.pna.activity.sell : t.pna.activity.buy;
        return (
          <MarketCell
            icon={o.eventImage ?? o.icon ?? null}
            title={o.question || "—"}
            eventSlug={o.eventSlug ?? null}
            subtitle={
              <>
                <span
                  className={cn(
                    "text-xs font-medium",
                    side === "Sell" ? "text-red-500" : "text-emerald-500"
                  )}
                >
                  {sideLabel}
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
      header: t.pna.orders.filled,
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
      header: t.pna.orders.amount,
      align: "right",
      cell: (o) => <span className="tabular-nums">{fmtMoney(o.total ?? o.placedAmount)}</span>,
    },
    {
      key: "expires",
      header: t.pna.orders.expiration,
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

  return (
    <DataTable
      data={orders as YesNoOrder[]}
      loading={isLoading}
      rowKey={(o, i) => String(o.orderId ?? o.id ?? i)}
      empty={t.pna.orders.noOrders}
      columns={columns}
    />
  );
}

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
  const { t } = useTranslation();
  const [tab, setTab] = useState<AsianSubTab>("orderbook");

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as AsianSubTab)}>
        <TabsList variant="line">
          <TabsTrigger value="orderbook">{t.pna.tabs.asianHandicapOrders}</TabsTrigger>
          <TabsTrigger value="transactions">{t.pna.activity.transactionHistory}</TabsTrigger>
          <TabsTrigger value="records">{t.pna.tabs.marketCreation}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "orderbook" && <AsianOrderBookView />}
      {tab === "transactions" && <AsianTransactionsView />}
      {tab === "records" && <AsianOpenRecordsView />}
    </div>
  );
}

function AsianOrderBookView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { rows, total, isLoading } = useAsianOrderBook({ page, size: PAGE_SIZE });

  const columns: DataTableColumn<UserOrder>[] = [
    {
      key: "market",
      header: t.pna.orders.market,
      cell: (o) => <span className="truncate font-medium">Market #{o.marketId}</span>,
    },
    {
      key: "type",
      header: t.pna.activity.type,
      cell: (o) => <Badge variant={o.type === "stake" ? "default" : "secondary"}>{o.type}</Badge>,
    },
    {
      key: "amount",
      header: t.pna.activity.amount,
      align: "right",
      cell: (o) => <span className="tabular-nums">{fmtMoney(o.amount)}</span>,
    },
    {
      key: "status",
      header: t.pna.orders.status,
      cell: (o) => <OrderStatusBadge status={o.status} />,
    },
    {
      key: "when",
      header: t.pna.orders.expiration,
      align: "right",
      cell: (o) => <span className="text-xs text-(--text-secondary)">{fmtUnixDateTime(o.chainTimestamp)}</span>,
    },
  ];

  return (
    <DataTable
      data={rows}
      loading={isLoading}
      rowKey={(o) => String(o.id)}
      empty={t.pna.orders.noOrders}
      columns={columns}
      pagination={{ page, pageSize: PAGE_SIZE, total, onPageChange: setPage }}
    />
  );
}

function AsianTransactionsView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { rows, total, isLoading } = useAsianTransactions({ page, size: PAGE_SIZE });

  const columns: DataTableColumn<ApiTransactionRecord>[] = [
    {
      key: "event",
      header: t.pna.activity.market,
      cell: (tx) => <span className="truncate font-medium">{tx.eventName || `Market #${tx.marketId}`}</span>,
    },
    {
      key: "type",
      header: t.pna.activity.type,
      cell: (tx) => <Badge variant="outline">{tx.type ?? "—"}</Badge>,
    },
    {
      key: "amount",
      header: t.pna.activity.amount,
      align: "right",
      cell: (tx) => <span className="tabular-nums">{fmtMoney(tx.amount)}</span>,
    },
    {
      key: "status",
      header: t.pna.orders.status,
      cell: (tx) => <Badge variant={tx.status === "SUCCESS" ? "default" : "secondary"}>{tx.status ?? "—"}</Badge>,
    },
    {
      key: "when",
      header: t.pna.orders.expiration,
      align: "right",
      cell: (tx) => <span className="text-xs text-(--text-secondary)">{fmtUnixDateTime(tx.chainTimestamp || tx.createdAt)}</span>,
    },
  ];

  return (
    <DataTable
      data={rows}
      loading={isLoading}
      rowKey={(tx) => String(tx.id)}
      empty={t.pna.noActivity}
      columns={columns}
      pagination={{ page, pageSize: PAGE_SIZE, total, onPageChange: setPage }}
    />
  );
}

function AsianOpenRecordsView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { rows, total, isLoading } = useAsianMarketRecords({ page, size: PAGE_SIZE });

  const columns: DataTableColumn<AsianMarketRecord>[] = [
    {
      key: "event",
      header: t.pna.auditRecords.event,
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{r.event || "—"}</div>
          {r.league ? <div className="text-xs text-(--text-secondary) truncate">{r.league}</div> : null}
        </div>
      ),
    },
    {
      key: "handicap",
      header: t.pna.positionHeaders.outcome,
      cell: (r) => (
        <span className="text-xs">
          {r.handicapType ? <span className="text-(--text-secondary) mr-1">{r.handicapType}</span> : null}
          <span className="tabular-nums">{r.handicap || "—"}</span>
        </span>
      ),
    },
    {
      key: "pool",
      header: t.pna.positionHeaders.bet,
      align: "right",
      cell: (r) => (
        <span className="tabular-nums text-xs">
          {r.homeTeamPool ?? "—"} / {r.awayTeamPool ?? "—"}
        </span>
      ),
    },
    {
      key: "fee",
      header: t.pna.activity.amount,
      align: "right",
      cell: (r) => <span className="tabular-nums">{r.setupFee || "—"}</span>,
    },
    {
      key: "status",
      header: t.pna.orders.status,
      cell: (r) => <Badge variant="outline">{r.eventStatus || "—"}</Badge>,
    },
    {
      key: "when",
      header: t.pna.marketCreation.createdAt,
      align: "right",
      cell: (r) => (
        <span className="text-xs text-(--text-secondary)">
          {typeof r.createTime === "number" ? fmtUnixDateTime(r.createTime) : (r.createTime ?? "—")}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      data={rows}
      loading={isLoading}
      rowKey={(r, i) => String(r.id ?? r.serialNumber ?? i)}
      empty={t.pna.marketCreation.noRecords}
      columns={columns}
      pagination={{ page, pageSize: PAGE_SIZE, total, onPageChange: setPage }}
    />
  );
}

function OrderStatusBadge({ status }: { status: "SUCCESS" | "PENDING" | "FAIL" }) {
  const variant: "default" | "secondary" | "outline" =
    status === "SUCCESS" ? "default" : status === "PENDING" ? "outline" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}
