"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/shadcn/badge";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { useTranslation } from "@/lib/i18n";
import { MarketCell } from "./positions-table";
import useGetOracleResultEvents, {
  type MarketCreatedRecord,
} from "@/lib/hooks/pna/use-get-oracle-result-events";
import { fmtMoney } from "./formatters";

const PAGE_SIZE = 25;

export default function MarketRecordsTable() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { list, total, isLoading } = useGetOracleResultEvents({
    page,
    size: PAGE_SIZE,
  });

  const columns: DataTableColumn<MarketCreatedRecord>[] = [
    {
      key: "market",
      header: t.pna.marketCreation.market,
      cell: (m) => (
        <MarketCell
          icon={m.icon || m.image || null}
          title={m.title || m.slug || "—"}
          eventSlug={m.slug ?? null}
          subtitle={
            m.category ? (
              <span className="text-xs text-(--text-secondary)">{m.category}</span>
            ) : null
          }
        />
      ),
    },
    {
      key: "status",
      header: t.pna.marketCreation.status,
      cell: (m) => <StatusBadge status={m.status} active={m.active} closed={m.closed} />,
    },
    {
      key: "volume",
      header: t.pna.sort.value,
      align: "right",
      cell: (m) => <span className="tabular-nums">{fmtMoney(parseNumeric(m.volume))}</span>,
      className: "max-md:hidden",
      headerClassName: "max-md:hidden",
    },
    {
      key: "liquidity",
      header: t.pna.sort.bet,
      align: "right",
      cell: (m) => <span className="tabular-nums">{fmtMoney(parseNumeric(m.liquidity))}</span>,
      className: "max-md:hidden",
      headerClassName: "max-md:hidden",
    },
    {
      key: "created",
      header: t.pna.marketCreation.createdAt,
      align: "right",
      cell: (m) => <span className="text-xs text-(--text-secondary)">{fmtIsoShort(m.createdAt)}</span>,
    },
  ];

  return (
    <DataTable
      data={list}
      loading={isLoading}
      rowKey={(m) => String(m.id ?? m.slug)}
      empty={t.pna.marketCreation.noRecords}
      columns={columns}
      pagination={{
        page,
        pageSize: PAGE_SIZE,
        total,
        onPageChange: setPage,
      }}
    />
  );
}

function StatusBadge({
  status,
  active,
  closed,
}: {
  status?: string;
  active?: boolean;
  closed?: boolean;
}) {
  if (closed) return <Badge variant="secondary">Closed</Badge>;
  if (active) return <Badge variant="default">Active</Badge>;
  return <Badge variant="outline">{status || "—"}</Badge>;
}

function parseNumeric(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmtIsoShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}
