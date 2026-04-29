"use client";

import Image from "next/image";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { Badge } from "@/components/ui/shadcn/badge";
import useGetOracleResultEvents from "@/lib/hooks/pna/use-get-oracle-result-events";
import { fmtMoney } from "./formatters";

export default function MarketRecordsTable() {
  const { list, isLoading } = useGetOracleResultEvents({ page: 1, size: 50 });

  if (isLoading && list.length === 0) return <RowsSkeleton cols={5} />;
  if (list.length === 0) return <EmptyRow text="No market records" />;

  return (
    <div className="rounded-md border border-(--border) overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Market</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Volume</TableHead>
            <TableHead className="text-right">Liquidity</TableHead>
            <TableHead className="text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((m) => (
            <TableRow key={String(m.id ?? m.slug)}>
              <TableCell>
                <div className="flex items-center gap-2 min-w-0">
                  {m.icon || m.image ? (
                    <Image
                      src={m.icon || m.image || ""}
                      alt=""
                      width={24}
                      height={24}
                      className="rounded shrink-0"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{m.title || m.slug || "—"}</div>
                    {m.category ? (
                      <div className="text-xs text-(--text-secondary) truncate">{m.category}</div>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={m.status} active={m.active} closed={m.closed} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {fmtMoney(parseNumeric(m.volume))}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {fmtMoney(parseNumeric(m.liquidity))}
              </TableCell>
              <TableCell className="text-right text-xs text-(--text-secondary)">
                {fmtIsoShort(m.createdAt)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
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
