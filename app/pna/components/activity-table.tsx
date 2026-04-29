"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  GitMerge,
  Split,
  CircleDollarSign,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { Badge } from "@/components/ui/shadcn/badge";
import { Button } from "@/components/ui/shadcn/button";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { cn } from "@/lib/utils";
import { getBasescanUrl } from "@/lib/config";
import { useTranslation } from "@/lib/i18n";
import useGetActivity, { type Activity } from "@/lib/hooks/pna/use-get-activity";
import useGetChainTransactions, {
  type ChainTransaction,
} from "@/lib/hooks/pna/use-get-chain-transactions";
import { fmtMoney, fmtRelativeTime } from "./formatters";
import { MarketCell } from "./positions-table";

interface ActivityTableProps {
  targetUserId?: string;
}

type SubTab = "trades" | "chain";

export default function ActivityTable({ targetUserId }: ActivityTableProps) {
  const [tab, setTab] = useState<SubTab>("trades");

  return (
    <div className="space-y-3">
      <Tabs value={tab} onValueChange={(v) => setTab(v as SubTab)}>
        <TabsList className="bg-(--bg-card) border border-(--border)">
          <TabsTrigger value="trades">Trades</TabsTrigger>
          <TabsTrigger value="chain">Chain Tx</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "trades" ? (
        <TradesList targetUserId={targetUserId} />
      ) : (
        <ChainTxList targetUserId={targetUserId} />
      )}
    </div>
  );
}

function TradesList({ targetUserId }: { targetUserId?: string }) {
  const { activities, isLoading } = useGetActivity({ userId: targetUserId, limit: 100 });

  return (
    <DataTable
      data={activities}
      loading={isLoading}
      rowKey={(a, i) => `${a.txHash}-${i}`}
      empty="No activity"
      columns={TRADE_COLUMNS}
    />
  );
}

function ChainTxList({ targetUserId }: { targetUserId?: string }) {
  const { transactions, isLoading, isLoadingMore, hasMore, loadMore } =
    useGetChainTransactions({ userId: targetUserId, pageSize: 25 });

  return (
    <DataTable
      data={transactions}
      loading={isLoading}
      rowKey={(tx, i) => `${tx.txHash ?? "tx"}-${i}`}
      empty="No chain transactions"
      columns={CHAIN_COLUMNS}
      footer={
        hasMore ? (
          <div className="flex justify-center p-2 border-t border-(--border)">
            <Button
              variant="outline"
              size="sm"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="h-7 text-xs"
            >
              {isLoadingMore ? "Loading…" : "Load more"}
            </Button>
          </div>
        ) : null
      }
    />
  );
}

const TRADE_COLUMNS: DataTableColumn<Activity>[] = [
  {
    key: "type",
    header: "Type",
    cell: (a) => <ActivityTypeBadge type={a.type} />,
    // 移动端隐藏：Type 在 Market 副标题里有移动版徽章
    className: "max-md:hidden",
    headerClassName: "max-md:hidden",
  },
  {
    key: "market",
    header: "Market",
    cell: (a) => (
      <MarketCell
        icon={a.icon ?? null}
        title={a.question || a.market || "—"}
        eventSlug={a.eventSlug ?? null}
        subtitle={
          <>
            <span className="md:hidden">
              <ActivityTypeBadge type={a.type} />
            </span>
            {a.outcomeName ? (
              <>
                <span
                  className={cn(
                    "py-0.5 px-2 rounded text-xs font-medium whitespace-nowrap",
                    isCreditSide(a.type)
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-red-500/15 text-red-500"
                  )}
                >
                  {a.outcomeName}
                  {a.price ? ` ${fmtMoney(a.price)}` : ""}
                </span>
                <span className="text-xs text-(--text-secondary) tabular-nums">
                  {(a.shares ?? 0).toLocaleString()} shares
                </span>
              </>
            ) : a.marketId ? (
              <span className="text-xs text-(--text-secondary)">ID: {a.marketId}</span>
            ) : null}
          </>
        }
      />
    ),
  },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    cell: (a) => <AmountWithTime amount={a.amount} timestamp={a.timestamp} txHash={a.txHash} />,
  },
];

const CHAIN_COLUMNS: DataTableColumn<ChainTransaction>[] = [
  {
    key: "type",
    header: "Type",
    cell: (tx) => <ActivityTypeBadge type={tx.type} />,
    className: "max-md:hidden",
    headerClassName: "max-md:hidden",
  },
  {
    key: "market",
    header: "Market",
    cell: (tx) => (
      <MarketCell
        icon={tx.icon ?? null}
        title={tx.question || tx.market || "—"}
        eventSlug={tx.eventSlug ?? null}
        subtitle={
          <>
            <span className="md:hidden">
              <ActivityTypeBadge type={tx.type} />
            </span>
            {tx.marketId ? (
              <span className="text-xs text-(--text-secondary) font-mono">ID: {tx.marketId}</span>
            ) : null}
          </>
        }
      />
    ),
  },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    cell: (tx) => <AmountWithTime amount={tx.amount} timestamp={tx.timestamp} txHash={tx.txHash} />,
  },
];

/**
 * Amount + 相对时间 + 区块浏览器外链 — 三件叠成一列右对齐。
 * 与原 h2-market /pna 一致。
 */
function AmountWithTime({
  amount,
  timestamp,
  txHash,
}: {
  amount: number | null | undefined;
  timestamp: number | string | null | undefined;
  txHash: string | null | undefined;
}) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="font-semibold tabular-nums">{fmtMoney(amount)}</span>
      <div className="flex items-center gap-1 text-[11px] text-(--text-secondary) whitespace-nowrap">
        {timestamp ? <span>{fmtRelativeTime(timestamp)}</span> : null}
        {txHash ? (
          <a
            href={getBasescanUrl.transaction(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            title={txHash}
            className="hover:text-(--text-primary) transition-colors shrink-0"
          >
            <ExternalLink size={11} />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function ActivityTypeBadge({ type }: { type: string }) {
  const { t } = useTranslation();
  const meta = TYPE_META[type.toUpperCase()] ?? TYPE_META[type] ?? DEFAULT_META;
  const Icon = meta.icon;
  // i18n key 在 t.pna.activity.* 下，缺失时回退英文 label
  const i18nLabel = meta.i18nKey
    ? (t.pna?.activity as Record<string, string> | undefined)?.[meta.i18nKey]
    : undefined;
  const label = i18nLabel || meta.label;
  return (
    <Badge variant="outline" className={cn("gap-1 border-current", meta.color)}>
      {Icon ? <Icon className="size-3" /> : null}
      {label}
    </Badge>
  );
}

interface TypeMeta {
  label: string;
  i18nKey?: "buy" | "sell" | "merge" | "redeem" | "deposit" | "withdraw" | "split";
  icon?: typeof ArrowDown;
  color: string;
}

const TYPE_META: Record<string, TypeMeta> = {
  BUY:      { label: "Buy",      i18nKey: "buy",      icon: ArrowDown,        color: "text-emerald-500" },
  Buy:      { label: "Buy",      i18nKey: "buy",      icon: ArrowDown,        color: "text-emerald-500" },
  SELL:     { label: "Sell",     i18nKey: "sell",     icon: ArrowUp,          color: "text-red-500" },
  Sell:     { label: "Sell",     i18nKey: "sell",     icon: ArrowUp,          color: "text-red-500" },
  REDEEM:   { label: "Redeem",   i18nKey: "redeem",   icon: CircleDollarSign, color: "text-emerald-500" },
  MERGE:    { label: "Merge",    i18nKey: "merge",    icon: GitMerge,         color: "text-(--text-secondary)" },
  SPLIT:    { label: "Split",    i18nKey: "split",    icon: Split,            color: "text-(--text-secondary)" },
  DEPOSIT:  { label: "Deposit",  i18nKey: "deposit",  icon: ArrowDownToLine,  color: "text-emerald-500" },
  WITHDRAW: { label: "Withdraw", i18nKey: "withdraw", icon: ArrowUpFromLine,  color: "text-red-500" },
};

const DEFAULT_META: TypeMeta = { label: "—", color: "text-(--text-secondary)" };

function isCreditSide(type: string): boolean {
  // 视觉色：买入 / 赎回 / 入账 都是"获得"侧 → 绿；卖出 / 转出 → 红
  return type === "Buy" || type === "REDEEM" || type === "DEPOSIT";
}
