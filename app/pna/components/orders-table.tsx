"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Copy, X } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { Badge } from "@/components/ui/shadcn/badge";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { DataTablePagination } from "@/components/common/data-table/pagination";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import { MarketCell } from "./positions-table";
import useGetOrders from "@/lib/hooks/pna/use-get-orders";
import useAsianOrderBook from "@/lib/hooks/pna/use-asian-order-book";
import useAsianTransactions from "@/lib/hooks/pna/use-asian-transactions";
import useAsianMarketRecords, {
  type AsianMarketRecord,
} from "@/lib/hooks/pna/use-asian-market-records";
import type {
  ApiOrderBookRecord,
  ApiOrderDetail,
  ApiTransactionRecord,
  ApiOption,
} from "@/types/pna";
import {
  getMatchStateByCode,
  isMatchEnded,
  MatchMark,
  MatchState,
} from "@/types/match-state";
import { formatHandicap } from "@/utils/handicap";
import { getBasescanUrl } from "@/lib/config";
import { fmtMoney, fmtUnixDateTime, fmtMatchTime } from "./formatters";

interface OrdersTableProps {
  targetUserId?: string;
  mode: "yesNo" | "asian";
}

const PAGE_SIZE = 10;

export default function OrdersTable({ targetUserId, mode }: OrdersTableProps) {
  if (mode === "yesNo") return <YesNoOrders targetUserId={targetUserId} />;
  return <AsianOrders />;
}

// ────────────────────────────────────────────────────────────
// Yes/No 模式（保留原实现）
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

/**
 * 过期时间格式化：传 unix 毫秒/秒；按 i18n 模板填 {{n}} 出：
 *   "12 小时后过期" / "in 12h" / "GTC" / "已过期"
 * 与 h2-market 原 OpenOrdersTab 行为对齐。
 */
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
          <TabsTrigger value="orderbook">{t.pna.asian.orderBook}</TabsTrigger>
          <TabsTrigger value="transactions">{t.pna.asian.transactionRecords}</TabsTrigger>
          <TabsTrigger value="records">{t.pna.asian.openRecords}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "orderbook" && <AsianOrderBookView />}
      {tab === "transactions" && <AsianTransactionsView />}
      {tab === "records" && <AsianOpenRecordsView />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 1) 订单簿（OrderBook）—— 富卡片，可展开 orderDetails
// ────────────────────────────────────────────────────────────

function AsianOrderBookView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const { rows, total, isLoading } = useAsianOrderBook({ page, size: pageSize });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div>
      {isLoading && rows.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[88px] rounded-xl animate-pulse bg-(--text-primary)/[0.05]"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-(--text-secondary)">
          <span className="text-3xl">📋</span>
          <span className="text-sm">{t.pna.asian.noOrders}</span>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((record) => (
            <OrderBookCard
              key={String(record.id)}
              record={record}
              expanded={expanded.has(String(record.id))}
              onToggle={() => toggle(String(record.id))}
            />
          ))}
        </div>
      )}

      <div className="mt-4 rounded-md border border-(--border) bg-(--bg-card)">
        <DataTablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 20, 50, 100]}
          currentRowCount={rows.length}
        />
      </div>
    </div>
  );
}

function OrderBookCard({
  record,
  expanded,
  onToggle,
}: {
  record: ApiOrderBookRecord;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const homeTeam = record.options?.find((o) => o.code === "1");
  const awayTeam = record.options?.find((o) => o.code === "2");
  const homeName = homeTeam?.name || "Home";
  const awayName = awayTeam?.name || "Away";
  const matchTime = fmtUnixDateTime(record.eventTime);

  // 比分
  const matchResult = isMatchEnded(record.state)
    ? `${homeTeam?.outcomeValue || "-"} : ${awayTeam?.outcomeValue || "-"}`
    : "- : -";

  // 比赛状态
  const stateObj = getMatchStateByCode(record.state);
  const statusLabel = (() => {
    if (!stateObj) return "";
    if (stateObj.mark === MatchMark.END) {
      if (stateObj === MatchState.CANCELLED) return t.pna.asian.canceled;
      return t.pna.asian.finished;
    }
    if (stateObj.mark === MatchMark.RUN) return t.pna.asian.inProgress;
    if (stateObj.mark === MatchMark.HOLD) return t.pna.asian.notStarted;
    return stateObj.label;
  })();

  const totalStake = (Number(record.totalStakeAmount) || 0).toLocaleString();
  const profitLoss = record.totalProfitLoss
    ? (Number(record.totalProfitLoss) || 0).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "-";
  const claimable =
    parseFloat(record.totalClaimableAmount) > 0
      ? formatDynamicAmount(record.totalClaimableAmount)
      : "-";

  const hasChildren = record.orderDetails?.length > 0;

  return (
    <div
      className={cn(
        "rounded-xl border border-(--border) bg-(--bg-card) overflow-hidden transition-shadow",
        expanded ? "shadow-md" : ""
      )}
    >
      <div
        className="px-3 py-3 cursor-pointer select-none"
        onClick={hasChildren ? onToggle : undefined}
      >
        {/* 顶部行：chevron + 左侧（联赛/队名/时间）+ 右侧桌面端横排 stats，移动端只剩状态 */}
        <div className="flex flex-row items-start sm:items-center gap-2">
          <span
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-(--text-secondary) mt-0.5 sm:mt-0"
            style={{ opacity: hasChildren ? 1 : 0.25 }}
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>

          {/* 左侧：联赛 + 队名 + 时间 */}
          <div className="flex-1 min-w-0 mr-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2 py-0.5 rounded font-medium bg-(--bg-secondary) text-(--text-secondary) flex-shrink-0">
                {record.name || t.pna.asian.league}
              </span>
              <span className="text-[15px] font-semibold truncate flex items-center gap-1 text-(--text-primary)">
                <span>{homeName}</span>
                <span className="text-xs font-normal px-1 text-(--text-secondary) opacity-60">
                  vs
                </span>
                <span>{awayName}</span>
              </span>
            </div>
            {/* 资金池 + 占比 */}
            {((record.option1Turnover && record.option1Turnover !== "0") ||
              (record.option2Turnover && record.option2Turnover !== "0")) && (
              <div className="mt-0.5 text-[11px] tabular-nums text-(--text-secondary)">
                {homeName} ${(parseFloat(record.option1Turnover) || 0).toLocaleString()} :{" "}
                {awayName} ${(parseFloat(record.option2Turnover) || 0).toLocaleString()}
                {parseFloat(record.ownSideStakeRatio || "0") > 0 && (
                  <>
                    {" · "}
                    {t.pna.asian.myShare}{" "}
                    <span className="text-(--accent)">
                      {fmtRatio(record.ownSideStakeRatio)}
                    </span>
                  </>
                )}
              </div>
            )}
            <div className="mt-1 text-xs tabular-nums text-(--text-secondary)">
              {matchTime}
            </div>
          </div>

          {/* 移动端右上角：只显示状态（节省空间） */}
          <span className="sm:hidden text-[11px] font-medium text-(--text-primary) flex-shrink-0 px-1.5 py-0.5 rounded bg-(--bg-secondary)">
            {statusLabel}
          </span>

          {/* 桌面端右侧：5 个 stat 横排 */}
          <div className="hidden sm:flex sm:flex-row sm:items-center sm:gap-4 sm:ml-2 sm:flex-shrink-0 sm:justify-end">
            <Stat label={t.pna.asian.betAmount} value={totalStake} />
            <Stat
              label={t.pna.asian.matchResult}
              value={matchResult}
              valueClass={
                matchResult === "- : -" ? "text-(--text-secondary)" : "text-(--accent)"
              }
            />
            <Stat
              label={t.pna.asian.status}
              value={statusLabel}
              valueClass="text-(--text-primary)"
            />
            <Stat
              label={t.pna.asian.profitLoss}
              value={
                profitLoss === "-"
                  ? "-"
                  : profitLoss.startsWith("-")
                    ? profitLoss
                    : profitLoss === "0.00"
                      ? profitLoss
                      : `+${profitLoss}`
              }
              valueClass={pnlColor(profitLoss)}
            />
            <Stat
              label={t.pna.asian.claimableAmount}
              value={claimable}
              valueClass={
                claimable === "-" ? "text-(--text-secondary)" : "text-emerald-500"
              }
            />
          </div>
        </div>

        {/* 移动端：4 项 stat 在头部下方 2x2 排，状态已经放到右上角 */}
        <div className="grid grid-cols-2 gap-y-2 gap-x-3 mt-3 pl-7 sm:hidden">
          <MobileStat label={t.pna.asian.betAmount} value={totalStake} />
          <MobileStat
            label={t.pna.asian.matchResult}
            value={matchResult}
            valueClass={
              matchResult === "- : -" ? "text-(--text-secondary)" : "text-(--accent)"
            }
          />
          <MobileStat
            label={t.pna.asian.profitLoss}
            value={
              profitLoss === "-"
                ? "-"
                : profitLoss.startsWith("-")
                  ? profitLoss
                  : profitLoss === "0.00"
                    ? profitLoss
                    : `+${profitLoss}`
            }
            valueClass={pnlColor(profitLoss)}
          />
          <MobileStat
            label={t.pna.asian.claimableAmount}
            value={claimable}
            valueClass={
              claimable === "-" ? "text-(--text-secondary)" : "text-emerald-500"
            }
          />
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="bg-(--bg-secondary) border-t border-(--border)">
          <div className="hidden lg:grid grid-cols-9 gap-x-4 px-4 py-2.5 border-b border-(--border) bg-(--bg-card)">
            {[
              t.pna.asian.handicapType,
              t.pna.asian.betSelection,
              t.pna.asian.betAmount,
              t.pna.asian.profitLoss,
              t.pna.asian.claimableAmount,
              t.pna.asian.totalVolume,
              t.pna.asian.myShare,
              t.pna.asian.transactionHash,
              t.pna.asian.claimStatus,
            ].map((h) => (
              <span key={h} className="text-xs font-medium text-(--text-secondary)">
                {h}
              </span>
            ))}
          </div>
          {record.orderDetails.map((detail, idx) => (
            <OrderDetailRow
              key={`${detail.txHash || idx}`}
              detail={detail}
              homeName={homeName}
              awayName={awayName}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  valueClass,
  className,
}: {
  label: string;
  value: string;
  valueClass?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <span className="text-[11px] mb-0.5 text-(--text-secondary)">{label}</span>
      <span className={cn("text-[15px] font-semibold tabular-nums text-(--text-primary)", valueClass)}>
        {value}
      </span>
    </div>
  );
}

/**
 * 移动端 stat：label 和 value 横排（左对齐 + 紧凑），节省高度。
 */
function MobileStat({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs min-w-0">
      <span className="text-(--text-secondary) shrink-0">{label}</span>
      <span className={cn("font-semibold tabular-nums text-(--text-primary) truncate text-right", valueClass)}>
        {value}
      </span>
    </div>
  );
}

function OrderDetailRow({
  detail,
  homeName,
  awayName,
}: {
  detail: ApiOrderDetail;
  homeName: string;
  awayName: string;
}) {
  const { t } = useTranslation();
  const isHome = detail.code === "1";
  const teamName = isHome ? homeName : detail.code === "2" ? awayName : "—";
  const lineRaw = detail.line;
  const lineNum = Number(lineRaw);

  let lineDisplay = "-";
  if (detail.mechanism === "overUnder") {
    const formatted = Number.isFinite(lineNum) ? formatHandicap(lineNum, false) : (lineRaw ?? "-");
    lineDisplay = (isHome ? t.pna.asian.over : t.pna.asian.under) + formatted;
  } else if (lineRaw && lineRaw !== "-") {
    const display = isHome ? lineNum : -lineNum;
    lineDisplay = formatHandicap(display, true);
  }

  const selLabel =
    detail.mechanism === "overUnder" ? lineDisplay : `${teamName} ${lineDisplay}`;

  const profitLoss = detail.profitLoss
    ? parseFloat(detail.profitLoss).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "-";
  const claimable =
    parseFloat(detail.claimableAmount) > 0
      ? formatDynamicAmount(detail.claimableAmount)
      : "-";

  const totalVol =
    detail.option1Turnover && detail.option2Turnover
      ? `$${(parseFloat(detail.option1Turnover) + parseFloat(detail.option2Turnover)).toLocaleString()}`
      : "-";

  const claimStatusLabel = (() => {
    switch (detail.claimStatus) {
      case 0:
        return "-";
      case 1:
        return t.pna.asian.notClaimed;
      case 2:
        return t.pna.asian.claimed;
      case 3:
        return t.pna.asian.claimableAmountZero;
      default:
        return t.pna.asian.unknownStatus;
    }
  })();

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-x-4 gap-y-3 px-4 py-4 border-b border-dashed border-(--border) last:border-0"
    >
      <DetailCell mobileLabel={t.pna.asian.handicapType}>
        <span className="text-sm text-(--text-primary)">
          {detail.mechanism === "overUnder" ? t.pna.asian.overUnder : t.pna.asian.handicap}
        </span>
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.betSelection}>
        <span className="text-xs font-medium text-(--text-primary)">{selLabel}</span>
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.betAmount}>
        <span className="text-sm tabular-nums text-(--text-primary)">
          {(Number(detail.stakeAmount) || 0).toLocaleString()}
        </span>
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.profitLoss}>
        <span className={cn("text-sm tabular-nums font-semibold", pnlColor(profitLoss))}>
          {profitLoss}
        </span>
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.claimableAmount}>
        <span className="text-sm tabular-nums text-(--text-primary)">{claimable}</span>
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.totalVolume}>
        <span className="text-sm tabular-nums text-(--text-primary)">{totalVol}</span>
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.myShare}>
        <span
          className={cn(
            "text-sm tabular-nums",
            parseFloat(detail.ownSideStakeRatio || "0") > 0
              ? "text-(--accent)"
              : "text-(--text-secondary)"
          )}
        >
          {parseFloat(detail.ownSideStakeRatio || "0") > 0
            ? fmtRatio(detail.ownSideStakeRatio)
            : "-"}
        </span>
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.transactionHash}>
        <TxHashLink hash={detail.transactionHash || detail.txHash} />
      </DetailCell>
      <DetailCell mobileLabel={t.pna.asian.claimStatus}>
        <span className="text-xs px-2 py-0.5 rounded text-(--text-secondary) bg-(--bg-card)">
          {claimStatusLabel}
        </span>
      </DetailCell>
    </div>
  );
}

function DetailCell({
  mobileLabel,
  children,
}: {
  mobileLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs lg:hidden text-(--text-secondary)">{mobileLabel}</span>
      {children}
    </div>
  );
}

function TxHashLink({ hash }: { hash?: string }) {
  const { t } = useTranslation();
  if (!hash) return <span className="text-xs text-(--text-secondary)">{t.pna.asian.none}</span>;
  const short = `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  return (
    <div className="flex items-center gap-1">
      <a
        href={hash.startsWith("0x") ? getBasescanUrl.transaction(hash) : "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-mono text-(--accent) hover:underline"
        title={hash}
        onClick={(e) => e.stopPropagation()}
      >
        {short}
      </a>
      <button
        type="button"
        className="text-(--text-secondary) hover:text-(--text-primary)"
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard?.writeText(hash);
        }}
        aria-label="Copy"
      >
        <Copy size={12} />
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 2) 交易记录（Transactions）
// ────────────────────────────────────────────────────────────

function AsianTransactionsView() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const { rows, total, isLoading } = useAsianTransactions({ page, size: pageSize });

  const columns: DataTableColumn<ApiTransactionRecord>[] = [
    {
      key: "type",
      header: t.pna.activity.type,
      cell: (tx) => (
        <span className="text-xs sm:text-sm text-(--text-primary)">
          {tx.type === "claim" ? t.pna.asian.claim : t.pna.asian.stake}
        </span>
      ),
    },
    {
      key: "league",
      header: t.pna.asian.leagueName,
      cell: (tx) => (
        <span className="text-xs sm:text-sm text-(--text-primary) truncate block max-w-[160px]">
          {tx.eventName || "-"}
        </span>
      ),
    },
    {
      key: "direct",
      header: t.pna.asian.direct,
      cell: (tx) => (
        <span className="text-xs sm:text-sm text-(--text-primary) truncate block max-w-[160px]">
          {tx.option?.name || "-"}
        </span>
      ),
    },
    {
      key: "amount",
      header: t.pna.asian.betAmount,
      align: "right",
      cell: (tx) => (
        <span className="tabular-nums text-(--text-primary)">
          {(Number(tx.amount) || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: "status",
      header: t.pna.asian.status,
      cell: (tx) => <TxStatusBadge status={txStatusOf(tx)} />,
    },
    {
      key: "when",
      header: t.pna.asian.createTime,
      align: "right",
      cell: (tx) => (
        <span className="text-xs text-(--text-secondary) tabular-nums">
          {fmtMatchTime(tx.chainTimestamp || tx.createdAt)}
        </span>
      ),
    },
    {
      key: "tx",
      header: t.pna.asian.transactionHash,
      cell: (tx) => <TxHashLink hash={tx.txHash} />,
    },
  ];

  return (
    <DataTable
      data={rows}
      loading={isLoading}
      rowKey={(tx) => String(tx.id)}
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

function txStatusOf(tx: ApiTransactionRecord): "SUCCESS" | "PENDING" | "FAIL" {
  if (tx.txHash && tx.txHash.length > 0) return "SUCCESS";
  return "PENDING";
}

function TxStatusBadge({ status }: { status: "SUCCESS" | "PENDING" | "FAIL" }) {
  const { t } = useTranslation();
  if (status === "SUCCESS") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/15">
        {t.pna.asian.success}
      </Badge>
    );
  }
  if (status === "FAIL") {
    return (
      <Badge className="bg-red-500/15 text-red-500 hover:bg-red-500/15">
        {t.pna.asian.failed}
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-500/15 text-amber-500 hover:bg-amber-500/15">
      {t.pna.asian.processing}
    </Badge>
  );
}

// ────────────────────────────────────────────────────────────
// 3) 开盘记录（Open Records）
// ────────────────────────────────────────────────────────────

function AsianOpenRecordsView() {
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

// ────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────

function pnlColor(text: string): string {
  if (text === "-") return "text-(--text-secondary)";
  if (text === "0" || text === "0.00") return "text-amber-500";
  return text.startsWith("-") ? "text-red-500" : "text-emerald-500";
}

function fmtRatio(raw?: string): string {
  const r = parseFloat(raw || "0");
  if (!Number.isFinite(r) || r <= 0) return "-";
  return r >= 1 ? `${(r * 100).toFixed(0)}%` : `${(r * 100).toFixed(1)}%`;
}

/** 小额自适应小数位（来自原 OrderBookTab） */
function formatDynamicAmount(value: string | number, maxDecimals = 8): string {
  if (value === "-" || value === "" || value == null) return "-";
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  const isNeg = num < 0;
  const abs = Math.abs(num);
  if (abs === 0) return "0";
  if (abs >= 1) {
    return (isNeg ? -abs : abs).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  let formatted = "0.00";
  for (let d = 2; d <= maxDecimals; d++) {
    const cand = abs.toFixed(d);
    if (Number(cand) !== 0) {
      formatted = cand;
      break;
    }
  }
  const [intPart, fracPartRaw] = formatted.split(".");
  if (!fracPartRaw) return isNeg ? `-${formatted}` : formatted;
  let frac = fracPartRaw;
  while (frac.length > 2 && frac.endsWith("0")) frac = frac.slice(0, -1);
  const result = `${Number(intPart).toLocaleString()}.${frac}`;
  return isNeg ? `-${result}` : result;
}

