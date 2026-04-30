"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { useTranslation } from "@/lib/i18n";
import useAsianMarketRecords, {
  type AsianMarketRecord,
} from "@/app/pna/hooks/use-asian-market-records";
import type { ApiOption } from "@/types/pna";
import { formatHandicap } from "@/utils/handicap";
import { fmtMatchTime } from "../formatters";

const PAGE_SIZE = 10;

export function OpenRecordsView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const { rows, total, isLoading } = useAsianMarketRecords({ page, size: pageSize });

  const columns: DataTableColumn<AsianMarketRecord>[] = [
    {
      key: "sn",
      header: t.pna.asian.serialNumber,
      align: "center",
      cell: (_, i) => (
        <span className="text-xs sm:text-sm tabular-nums text-(--text-primary)">
          {String((page - 1) * pageSize + i + 1).padStart(2, "0")}
        </span>
      ),
    },
    {
      key: "league",
      header: t.pna.asian.leagueName,
      cell: (r) => (
        <span className="text-xs sm:text-sm text-(--text-primary) truncate block max-w-[160px]">
          {leagueOf(r) || "-"}
        </span>
      ),
    },
    {
      key: "event",
      header: t.pna.asian.event,
      cell: (r) => (
        <span className="text-xs sm:text-sm text-(--text-primary) truncate block max-w-[220px]">
          {eventOf(r) || "-"}
        </span>
      ),
    },
    {
      key: "handicapType",
      header: t.pna.asian.handicapType,
      cell: (r) => (
        <span className="text-xs sm:text-sm text-(--text-primary)">
          {handicapTypeOf(r) === "overUnder" ? t.pna.asian.overUnder : t.pna.asian.handicap}
        </span>
      ),
    },
    {
      key: "handicap",
      header: t.pna.asian.handicap,
      align: "center",
      cell: (r) => {
        const raw = handicapOf(r);
        const n = Number(raw);
        return (
          <span className="text-xs sm:text-sm tabular-nums text-(--text-primary)">
            {Number.isFinite(n) ? formatHandicap(n, false) : (raw ?? "-")}
          </span>
        );
      },
    },
    {
      key: "homePool",
      header: t.pna.asian.homeTeamPool,
      align: "right",
      cell: (r) => (
        <span className="text-xs sm:text-sm tabular-nums text-(--text-primary)">
          {homePoolOf(r)}
        </span>
      ),
    },
    {
      key: "awayPool",
      header: t.pna.asian.awayTeamPool,
      align: "right",
      cell: (r) => (
        <span className="text-xs sm:text-sm tabular-nums text-(--text-primary)">
          {awayPoolOf(r)}
        </span>
      ),
    },
    {
      key: "fee",
      header: t.pna.asian.openingFee,
      align: "right",
      cell: (r) => (
        <span className="text-xs sm:text-sm tabular-nums text-(--text-primary)">
          {setupFeeOf(r)}
        </span>
      ),
    },
    {
      key: "createTime",
      header: t.pna.asian.createTime,
      align: "right",
      cell: (r) => {
        const ts = (r as any).createdAt ?? r.createTime;
        return (
          <span className="text-xs text-(--text-secondary) tabular-nums">
            {typeof ts === "number" || (typeof ts === "string" && /^\d+$/.test(ts))
              ? fmtMatchTime(ts)
              : (ts ?? "-")}
          </span>
        );
      },
    },
    {
      key: "eventStatus",
      header: t.pna.asian.eventStatus,
      align: "center",
      cell: (r) => (
        <span className="text-xs sm:text-sm text-(--text-primary)">
          {eventStatusOf(r) || "-"}
        </span>
      ),
    },
    {
      key: "matchResult",
      header: t.pna.asian.matchResult,
      align: "center",
      cell: (r) => (
        <span className="text-xs sm:text-sm tabular-nums text-(--text-primary)">
          {matchResultOf(r) || "- : -"}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      data={rows}
      loading={isLoading}
      rowKey={(r, i) => String(r.id ?? i)}
      empty={t.pna.asian.noOrders}
      columns={columns}
      pagination={{
        page,
        pageSize,
        total,
        onPageChange: setPage,
        onPageSizeChange: setPageSize,
        pageSizeOptions: [10, 20, 50, 100],
      }}
    />
  );
}

// 后端 raw 字段适配器（hook 里没 transform，直接拿 record 用）
function leagueOf(r: AsianMarketRecord): string {
  const raw = r as any;
  return raw.event?.name ?? r.league ?? "";
}
function eventOf(r: AsianMarketRecord): string {
  const raw = r as any;
  if (r.event && typeof r.event === "string") return r.event;
  const opts = raw.event?.options as ApiOption[] | undefined;
  if (opts && opts.length) {
    const home = opts.find((o) => o.code === "1")?.name || "Home";
    const away = opts.find((o) => o.code === "2")?.name || "Away";
    return `${home} vs ${away}`;
  }
  return "";
}
function homePoolOf(r: AsianMarketRecord): string {
  const raw = r as any;
  const opts = raw.options as ApiOption[] | undefined;
  if (opts) {
    const home = opts.find((o) => o.code === "1");
    return (Number(home?.turnover) || 0).toLocaleString();
  }
  return r.homeTeamPool ?? "0";
}
function awayPoolOf(r: AsianMarketRecord): string {
  const raw = r as any;
  const opts = raw.options as ApiOption[] | undefined;
  if (opts) {
    const away = opts.find((o) => o.code === "2");
    return (Number(away?.turnover) || 0).toLocaleString();
  }
  return r.awayTeamPool ?? "0";
}
function setupFeeOf(r: AsianMarketRecord): string {
  const raw = r as any;
  const fee = raw.setupFee;
  const num = fee == null ? 0 : Number(fee);
  return Number.isFinite(num) && num > 0 ? num.toLocaleString() : "0";
}
function matchResultOf(r: AsianMarketRecord): string {
  const raw = r as any;
  const opts = raw.event?.options as ApiOption[] | undefined;
  if (!opts) return r.matchResult || "";
  const home = opts.find((o) => o.code === "1")?.outcomeValue;
  const away = opts.find((o) => o.code === "2")?.outcomeValue;
  if (!home && !away) return "- : -";
  return `${home || "-"}:${away || "-"}`;
}
function handicapTypeOf(r: AsianMarketRecord): string {
  const raw = r as any;
  return raw.mechanism ?? r.handicapType ?? "";
}
function handicapOf(r: AsianMarketRecord): string {
  const raw = r as any;
  return raw.line ?? r.handicap ?? "0";
}
function eventStatusOf(r: AsianMarketRecord): string {
  const raw = r as any;
  return raw.event?.stateName ?? r.eventStatus ?? "";
}
