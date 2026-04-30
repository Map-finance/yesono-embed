"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/shadcn/badge";
import { DataTable, type DataTableColumn } from "@/components/common/data-table";
import { useTranslation } from "@/lib/i18n";
import useAsianTransactions from "@/app/pna/hooks/use-asian-transactions";
import type { ApiTransactionRecord } from "@/types/pna";
import { fmtMatchTime } from "../formatters";
import { TxHashLink } from "./tx-hash-link";

const PAGE_SIZE = 10;

export function TransactionsView() {
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
