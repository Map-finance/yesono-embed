"use client";

/**
 * 公用 DataTable
 *   - 包 shadcn Table 提供统一外观（圆角、border、hover、sticky header）
 *   - 内置 loading / empty 态
 *   - 可选分页 footer（page/size 模式）
 *   - 不做 sort / filter（spec §18.2 推荐 TanStack Table，按需再升级）
 */

import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { cn } from "@/lib/utils";

import { DataTablePagination } from "./pagination";
import type { DataTableColumn, PagePagination } from "./types";

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  empty?: ReactNode;
  rowKey: (row: T, index: number) => string | number;
  /** 分页（可选）；不传则不显示 footer */
  pagination?: PagePagination;
  /** 自定义 footer slot（pagination 之外的额外底部内容，如 loadMore 按钮） */
  footer?: ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  empty,
  rowKey,
  pagination,
  footer,
  className,
}: DataTableProps<T>) {
  return (
    <div
      className={cn(
        "rounded-md border border-(--border) bg-(--bg-card) overflow-hidden",
        className
      )}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-(--bg-secondary) hover:bg-(--bg-secondary)">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    "text-xs font-medium uppercase tracking-wide text-(--text-secondary)",
                    alignClass(col.align),
                    col.headerClassName
                  )}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && data.length === 0 ? (
              <TableSkeleton columns={columns} />
            ) : data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-(--text-secondary)"
                >
                  {empty ?? <DefaultEmpty />}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, idx) => (
                <TableRow key={rowKey(row, idx)} className="hover:bg-(--bg-secondary)/40">
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={cn(alignClass(col.align), col.className)}
                    >
                      {col.cell(row, idx)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pagination ? (
        <DataTablePagination
          {...pagination}
          currentRowCount={data.length}
        />
      ) : null}

      {footer}
    </div>
  );
}

function TableSkeleton<T>({ columns }: { columns: DataTableColumn<T>[] }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIdx) => (
        <TableRow key={rowIdx} className="hover:bg-transparent">
          {columns.map((col) => (
            <TableCell key={col.key} className={alignClass(col.align)}>
              <Skeleton className="h-4 w-3/4 mx-0" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

function DefaultEmpty() {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-(--text-secondary)">
      <Inbox className="size-8 opacity-40" />
      <span>No data</span>
    </div>
  );
}

function alignClass(align?: "left" | "right" | "center") {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "";
}

export type { DataTableColumn, PagePagination } from "./types";
