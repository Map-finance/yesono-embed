"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { MarketCell } from "../positions-table";
import useGetOrders from "@/app/pna/hooks/use-get-orders";
import { fmtMoney } from "../formatters";

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
  icon?: string | null;
  eventImage?: string | null;
  eventSlug?: string | null;
}

export function YesNoOrders({ targetUserId }: { targetUserId?: string }) {
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
        <span className="text-xs text-(--text-secondary)">{fmtExpires(o.expiresAt, t)}</span>
      ),
    },
    {
      key: "cancel",
      header: "",
      align: "right",
      // Embed 是只读，没有取消订单接口；保留 X 图标只为对齐原项目视觉。
      cell: () => (
        <button
          type="button"
          aria-label="cancel"
          disabled
          className="text-(--text-secondary) hover:text-(--text-primary) disabled:cursor-not-allowed"
        >
          <X size={14} />
        </button>
      ),
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

function fmtExpires(
  v: number | string | null | undefined,
  t: ReturnType<typeof useTranslation>["t"]
): string {
  if (v === null || v === undefined || v === "") return t.pna.orders.untilCancelled;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return t.pna.orders.untilCancelled;
  const ms = n < 1e12 ? n * 1000 : n;
  const diff = ms - Date.now();
  if (diff <= 0) return t.pna.orders.expired;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return tmpl(t.pna.orders.expiresInSeconds, sec);
  const min = Math.floor(sec / 60);
  if (min < 60) return tmpl(t.pna.orders.expiresInMinutes, min);
  const hr = Math.floor(min / 60);
  if (hr < 24) return tmpl(t.pna.orders.expiresInHours, hr);
  const day = Math.floor(hr / 24);
  return tmpl(t.pna.orders.expiresInDays, day);
}

function tmpl(s: string, n: number): string {
  return s.replace(/\{\{\s*n\s*\}\}/g, String(n));
}

function fmtCents(price: number): string {
  if (!Number.isFinite(price)) return "—";
  if (price > 0 && price < 1) return `${(price * 100).toFixed(0)}¢`;
  return fmtMoney(price);
}
