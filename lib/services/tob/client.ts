/**
 * To-B HTTP 客户端公用层
 * - 统一 base path 拼接
 * - 统一从 R<T> 壳里 unwrap data
 * - 统一暴露 USE_MOCK 开关给各 service
 *
 * 不直接调 axios，走 lib/request.ts 复用 Authorization 注入 + 401 重放（FR-2.3）。
 */

import { http } from "@/lib/request";
import type { TobApiResp } from "./types";

/** mock 总开关：env `NEXT_PUBLIC_TOB_USE_MOCK=1` */
export const USE_MOCK = process.env.NEXT_PUBLIC_TOB_USE_MOCK === "1";

/** tob 后端基地址；默认走同源 */
export const BASE = (() => {
  const raw = process.env.NEXT_PUBLIC_TOB_API_BASE_URL || "";
  return raw ? raw.replace(/\/+$/, "") : "";
})();

/** 拼绝对路径 */
export function url(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  return BASE + path;
}

/**
 * 解开后端统一 R<T> 壳；兼容两种返回：
 *   - 真实后端返回 R<T>，data 在 .data
 *   - axios 拦截器后再读一次 .data
 *   - 直接已是 T 形态
 */
export async function unwrap<T>(p: Promise<unknown>): Promise<T> {
  const r = (await p) as TobApiResp<T> & { data?: TobApiResp<T> };
  // axios http.get 返回 ApiResponse<T>；http 拦截器又给了一层 data
  // 兼容三层 unwrap
  const inner = (r?.data as unknown as TobApiResp<T>) ?? r;
  // 失败可能是 { success:false, msg }(如被限流)信封,无 code 字段,响应拦截器不会 reject。
  // 这里显式判定并抛出,避免上层把失败当成功处理(对应 h2-market 4885698)。
  if (
    inner &&
    typeof inner === "object" &&
    (inner as { success?: boolean }).success === false
  ) {
    const m =
      (inner as { msg?: string }).msg ||
      (inner as { message?: string }).message ||
      "Request failed";
    throw new Error(m);
  }
  if (
    inner &&
    typeof inner === "object" &&
    "data" in inner &&
    "code" in inner
  ) {
    return inner.data as T;
  }
  return inner as T;
}

/** 把 query 对象拼成 ?a=b&c=d；undefined / null 跳过；数组用同名重复 key */
export function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (Array.isArray(v)) {
      v.forEach((vi) => sp.append(k, String(vi)));
    } else {
      sp.set(k, String(v));
    }
  });
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** GET helper */
export async function get<T>(
  path: string,
  params?: Record<string, unknown>
): Promise<T> {
  return unwrap<T>(http.get(url(path) + (params ? qs(params) : "")));
}

/** POST helper */
export async function post<T>(path: string, body?: unknown): Promise<T> {
  return unwrap<T>(http.post(url(path), body));
}
