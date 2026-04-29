import type { ReactNode } from "react";

/**
 * 公用 DataTable 列定义。
 * 不引入 TanStack Table（spec §18.2 推荐但暂未需要 sort/filter/group），
 * 保持最轻：只描述"如何把一行数据渲染成单元格"。
 */
export interface DataTableColumn<T> {
  /** 列唯一 id（也用作 key） */
  key: string;
  /** 表头文本 / 节点 */
  header: ReactNode;
  /** 单元格渲染函数 */
  cell: (row: T, rowIndex: number) => ReactNode;
  /** 文本对齐，默认左对齐 */
  align?: "left" | "right" | "center";
  /** 单元格 className，方便控制 width / 隐藏等 */
  className?: string;
  /** 表头 className */
  headerClassName?: string;
}

/** 严格分页（page/size，需要 total） */
export interface PagePagination {
  page: number;
  pageSize: number;
  total?: number; // 不传则退化成无总数模式：仅按当前页是否满推断 hasNext
  onPageChange: (nextPage: number) => void;
  /** 可选：每页大小切换。传了 onPageSizeChange + pageSizeOptions 才会渲染下拉 */
  onPageSizeChange?: (nextSize: number) => void;
  pageSizeOptions?: number[];
}
