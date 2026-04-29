import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * shadcn/ui 标配 className 合并工具（§18.3）。
 * `clsx` 处理条件 / 数组 / 对象，`twMerge` 解决冲突 utility（如 `p-2 p-4`）。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
