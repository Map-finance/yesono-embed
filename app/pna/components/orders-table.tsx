"use client";

import { useState } from "react";

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
import useGetOrders from "@/lib/hooks/pna/use-get-orders";
import useAsianOrderBook from "@/lib/hooks/pna/use-asian-order-book";
import { fmtMoney, fmtUnixDateTime } from "./formatters";

interface OrdersTableProps {
  targetUserId?: string;
}

type SubTab = "yesno" | "asian";

export default function OrdersTable({ targetUserId }: OrdersTableProps) {
  const [tab, setTab] = useState<SubTab>("yesno");

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as SubTab)}>
        <TabsList className="bg-(--bg-card) border border-(--border)">
          <TabsTrigger value="yesno">Yes/No</TabsTrigger>
          <TabsTrigger value="asian">Asian Handicap</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "yesno" ? (
        <YesNoOrders targetUserId={targetUserId} />
      ) : (
        <AsianOrders />
      )}
    </div>
  );
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

  if (isLoading) return <RowsSkeleton cols={6} />;
  if (orders.length === 0) return <EmptyRow text="No open Yes/No orders" />;

  return (
    <div className="rounded-md border border-(--border) overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Market</TableHead>
            <TableHead>Side</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Filled</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Expires</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(orders as YesNoOrder[]).map((o, idx) => (
            <TableRow key={String(o.orderId ?? o.id ?? idx)}>
              <TableCell className="min-w-0">
                <div className="truncate font-medium">{o.question || "—"}</div>
                {o.outcome ? (
                  <div className="text-xs text-(--text-secondary) truncate">{o.outcome}</div>
                ) : null}
              </TableCell>
              <TableCell>
                <Badge variant={o.side === "Sell" ? "secondary" : "default"}>
                  {o.side ?? "Buy"}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{fmtMoney(o.price)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {o.filled ?? 0} / {o.shares ?? 0}
              </TableCell>
              <TableCell className="text-right tabular-nums">{fmtMoney(o.total)}</TableCell>
              <TableCell className="text-right text-xs text-(--text-secondary)">
                {typeof o.expiresAt === "number" ? fmtUnixDateTime(o.expiresAt) : (o.expiresAt ?? "—")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AsianOrders() {
  const { rows, isLoading } = useAsianOrderBook({ page: 1, size: 50 });

  if (isLoading) return <RowsSkeleton cols={5} />;
  if (rows.length === 0) return <EmptyRow text="No Asian Handicap orders" />;

  return (
    <div className="rounded-md border border-(--border) overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Market</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((o) => (
            <TableRow key={String(o.id)}>
              <TableCell className="min-w-0 truncate font-medium">
                Market #{o.marketId}
              </TableCell>
              <TableCell>
                <Badge variant={o.type === "stake" ? "default" : "secondary"}>
                  {o.type}
                </Badge>
              </TableCell>
              <TableCell className="text-right tabular-nums">{fmtMoney(o.amount)}</TableCell>
              <TableCell>
                <StatusBadge status={o.status} />
              </TableCell>
              <TableCell className="text-right text-xs text-(--text-secondary)">
                {fmtUnixDateTime(o.chainTimestamp)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusBadge({ status }: { status: "SUCCESS" | "PENDING" | "FAIL" }) {
  const variant: "default" | "secondary" | "outline" =
    status === "SUCCESS" ? "default" : status === "PENDING" ? "outline" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
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
