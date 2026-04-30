"use client";

import { useState } from "react";
import { DataTablePagination } from "@/components/common/data-table/pagination";
import { useTranslation } from "@/lib/i18n";
import useAsianOrderBook from "@/app/pna/hooks/use-asian-order-book";
import { OrderBookCard } from "./order-book-card";

const PAGE_SIZE = 10;

export function OrderBookView() {
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
