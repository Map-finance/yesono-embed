"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle, Clock, XCircle } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import ProxyImage from "@/components/common/ProxyImage";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import useGetOracleResultEvents, {
  type MarketCreatedRecord,
} from "@/app/pna/hooks/use-get-oracle-result-events";
import useGetReviewRecords, {
  type ReviewRecordItem,
} from "@/app/pna/hooks/use-get-review-records";

const PAGE_SIZE = 20;

type SubTab = "creation" | "audit";

export default function MarketRecordsTable() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SubTab>("creation");

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as SubTab)}>
        <TabsList variant="line">
          <TabsTrigger value="creation">{t.pna.tabs.marketCreation}</TabsTrigger>
          <TabsTrigger value="audit">{t.pna.tabs.marketAudit}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "creation" ? <CreationRecords /> : <AuditRecords />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 创建记录
// ────────────────────────────────────────────────────────────

function CreationRecords() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const { list, total, isLoading } = useGetOracleResultEvents({ page, size: pageSize });

  const columns: DataTableColumn<MarketCreatedRecord>[] = [
    {
      key: "market",
      header: t.pna.marketCreation.market,
      cell: (m) => (
        <MarketRow
          icon={m.icon || m.image || null}
          title={m.title || m.slug || "—"}
          slug={m.slug ?? null}
          category={m.category ?? null}
          marketsCount={Array.isArray(m.markets) ? m.markets.length : 0}
        />
      ),
    },
    {
      key: "status",
      header: t.pna.marketCreation.status,
      cell: (m) => <CreationStatusBadge status={m.status} />,
    },
    {
      key: "created",
      header: t.pna.marketCreation.createdAt,
      align: "right",
      cell: (m) => (
        <span className="text-xs text-(--text-secondary) tabular-nums">
          {fmtCreatedAt(m.createdAt)}
        </span>
      ),
    },
    {
      key: "action",
      header: t.pna.marketCreation.action,
      align: "right",
      cell: (m) => {
        const status = (m.status || "").toUpperCase();
        if (status === "ACTIVE" && m.slug) {
          return (
            <Link
              href={`/market/${m.slug}`}
              className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium border border-(--border) text-(--text-primary) hover:bg-(--bg-secondary) transition-colors"
            >
              {t.pna.marketCreation.viewMarket}
            </Link>
          );
        }
        return <span className="text-(--text-secondary)">—</span>;
      },
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
        pageSize,
        total,
        onPageChange: setPage,
        onPageSizeChange: setPageSize,
        pageSizeOptions: [10, 20, 50, 100],
      }}
    />
  );
}

// ────────────────────────────────────────────────────────────
// 审核记录
// ────────────────────────────────────────────────────────────

function AuditRecords() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const { records, total, isLoading } = useGetReviewRecords({
    page,
    pageSize,
  });

  const columns: DataTableColumn<ReviewRecordItem>[] = [
    {
      key: "market",
      header: t.pna.auditRecords.event,
      cell: (r) => {
        const markets = r.result?.market_result?.markets ?? [];
        const title =
          r.result?.market_result?.title ||
          markets[0]?.title ||
          markets[0]?.question ||
          (typeof r.input === "string" ? r.input : "") ||
          "—";
        const subQuestion =
          markets[0]?.question || markets[0]?.title || markets[0]?.description || null;
        const marketsCount = markets.length;
        const image = (r.metadata?.image as string | undefined) ?? null;
        return (
          <AuditMarketRow
            icon={image}
            title={title}
            marketsCount={marketsCount}
            subQuestion={subQuestion}
          />
        );
      },
    },
    {
      key: "status",
      header: t.pna.auditRecords.status,
      cell: (r) => <ReviewStatusBadge status={r.status} />,
    },
    {
      key: "created",
      header: t.pna.auditRecords.createdAt,
      align: "right",
      cell: (r) => (
        <span className="text-xs text-(--text-secondary) tabular-nums">
          {fmtCreatedAt(r.created_time ?? r.createdAt)}
        </span>
      ),
    },
    {
      key: "action",
      header: t.pna.auditRecords.action,
      align: "right",
      cell: (r) =>
        r.status === "pending" ? (
          <span className="text-xs text-(--text-secondary)">
            {t.pna.auditRecords.pendingHint}
          </span>
        ) : (
          <span className="text-(--text-secondary)">—</span>
        ),
    },
  ];

  return (
    <DataTable
      data={records}
      loading={isLoading}
      rowKey={(r) => String(r.id)}
      empty={t.pna.auditRecords.noRecords}
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

// ────────────────────────────────────────────────────────────
// 共用：行 + 状态徽章
// ────────────────────────────────────────────────────────────

function MarketRow({
  icon,
  title,
  slug,
  category,
  marketsCount,
}: {
  icon: string | null;
  title: string;
  slug: string | null;
  category: string | null;
  marketsCount: number;
}) {
  const titleNode = slug ? (
    <Link href={`/market/${slug}`} className="font-medium truncate hover:underline" title={title}>
      {title}
    </Link>
  ) : (
    <span className="font-medium truncate" title={title}>
      {title}
    </span>
  );

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="size-8 shrink-0 rounded overflow-hidden bg-(--bg-secondary)">
        {icon ? (
          <ProxyImage src={icon} alt="" className="w-full h-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0 flex flex-col">
        {titleNode}
        <div className="flex items-center gap-1 text-xs text-(--text-secondary) truncate">
          {category ? <span className="capitalize">{category}</span> : null}
          {category && marketsCount > 0 ? <span>·</span> : null}
          {marketsCount > 0 ? (
            <span className="tabular-nums">
              {marketsCount} {marketsCount === 1 ? "market" : "markets"}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AuditMarketRow({
  icon,
  title,
  marketsCount,
  subQuestion,
}: {
  icon: string | null;
  title: string;
  marketsCount: number;
  subQuestion: string | null;
}) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      <div className="size-8 mt-0.5 shrink-0 rounded overflow-hidden bg-(--bg-secondary)">
        {icon ? <ProxyImage src={icon} alt="" className="w-full h-full object-cover" /> : null}
      </div>
      <div className="min-w-0 flex flex-col">
        <span className="font-medium truncate" title={title}>
          {title}
        </span>
        {(marketsCount > 0 || subQuestion) && (
          <div className="flex items-center gap-1 text-xs text-(--text-secondary) truncate">
            {marketsCount > 0 ? (
              <span className="tabular-nums shrink-0">
                {marketsCount} {marketsCount === 1 ? "market" : "markets"}
              </span>
            ) : null}
            {marketsCount > 0 && subQuestion ? <span className="shrink-0">·</span> : null}
            {subQuestion ? <span className="truncate">{subQuestion}</span> : null}
          </div>
        )}
      </div>
    </div>
  );
}

const CREATION_STATUS_TONE: Record<string, string> = {
  ACTIVE: "border-emerald-500/40 text-emerald-500",
  DEPLOYED: "border-blue-500/40 text-blue-500",
  PROPOSED: "border-blue-500/40 text-blue-500",
  DRAFT: "border-amber-500/40 text-amber-500",
  DEPLOYING: "border-amber-500/40 text-amber-500",
  DEPLOY_FAILED: "border-amber-500/40 text-amber-500",
  SETTLED: "border-(--border) text-(--text-secondary)",
  RESOLVED: "border-(--border) text-(--text-secondary)",
  VOIDED: "border-red-500/40 text-red-500",
  CANCELLED: "border-red-500/40 text-red-500",
};

function CreationStatusBadge({ status }: { status?: string }) {
  const upper = (status || "").toUpperCase();
  const tone = CREATION_STATUS_TONE[upper] ?? "border-(--border) text-(--text-secondary)";
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border bg-transparent",
        tone
      )}
    >
      {upper || "—"}
    </span>
  );
}

function ReviewStatusBadge({ status }: { status?: string }) {
  const tone =
    status === "approved"
      ? "border-emerald-500/40 text-emerald-500"
      : status === "rejected"
        ? "border-red-500/40 text-red-500"
        : "border-amber-500/40 text-amber-500";
  const Icon = status === "approved" ? CheckCircle : status === "rejected" ? XCircle : Clock;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border bg-transparent",
        tone
      )}
    >
      <Icon size={12} />
      {(status || "pending").toUpperCase()}
    </span>
  );
}

function fmtCreatedAt(ts?: string | number | null): string {
  if (!ts) return "—";
  const n = typeof ts === "string" ? Number(ts) : ts;
  let d: Date;
  if (Number.isFinite(n) && n > 0) {
    d = new Date(n > 1e12 ? n : n * 1000);
  } else {
    d = new Date(String(ts));
  }
  if (Number.isNaN(d.getTime())) return "—";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}/${mm}/${dd} ${hh}:${mi}`;
}
