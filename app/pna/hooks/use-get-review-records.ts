/**
 * 市场审核记录（review_record）—— 用户提交但尚未上链 / 等待 / 被拒的市场。
 * 与 h2-market 原 useGetReviewRecords 对齐，简化为只读：embed 不做继续创建 / 修改。
 *
 * 走 NEXT_PUBLIC_REVIEW_API_HOST/review_api/review/v1/event/review_record/list?wallet=...
 * 接口约定 `tk` header（不是 Authorization Bearer），与 marketService.reviewSportsMarket 一致。
 */

import useSWR from "swr";
import { useEmbed } from "@/lib/embed/EmbedContext";
import { useLocale } from "@/lib/i18n";
import { getLanguageHeaders } from "@/lib/api";

export interface ReviewRecordItem {
  id: number | string;
  wallet?: string;
  status: "pending" | "approved" | "rejected" | string;
  input?: unknown;
  metadata?: {
    image?: string;
    generalCategory?: string;
    marketKeywords?: Record<string, unknown>;
    [k: string]: unknown;
  } | null;
  result?: {
    market_result?: {
      title?: string;
      markets?: Array<{
        id?: string | number;
        title?: string;
        question?: string;
        desc?: string;
        description?: string;
      }>;
    };
    [k: string]: unknown;
  } | null;
  created_time?: string;
  updated_time?: string;
  // 兼容字段（驼峰可能性）
  createdAt?: string;
}

interface ReviewRecordListResponse {
  data: ReviewRecordItem[];
  total: number;
  page?: number;
  page_size?: number;
  total_pages?: number;
}

/**
 * 从 JWT token 解析 walletAddress（与 h2-market aiService.getWalletAddressFromToken 保持一致）
 * JWT payload 例: { id, type, payload: "{\"walletAddress\":\"0x...\"}" }
 */
function walletFromToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded =
      typeof atob !== "undefined" ? atob(padded) : Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(decoded);
    if (payload.payload) {
      const inner =
        typeof payload.payload === "string" ? JSON.parse(payload.payload) : payload.payload;
      if (inner?.walletAddress) return inner.walletAddress as string;
    }
    return null;
  } catch {
    return null;
  }
}

interface UseGetReviewRecordsOptions {
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export default function useGetReviewRecords(opts: UseGetReviewRecordsOptions = {}) {
  const { page = 1, pageSize = 20, enabled = true } = opts;
  // 注意：embed 模式下 lib/stores/authStore 是 stub，user 永远是 {}，accessToken 是占位串。
  // 这里走真正的 embed token（来自 ?token= / postMessage / 开发期 fallback）。
  const { token } = useEmbed();
  const { locale } = useLocale();

  // 钱包地址：JWT payload 内嵌字段（原 aiService.getWalletAddressFromToken 同样路径）。
  // 原项目要求传"真实钱包地址"（walletAddress），不是 smartAccountAddress。
  const wallet = walletFromToken(token);

  const shouldFetch = enabled && Boolean(token) && Boolean(wallet);
  const key = shouldFetch ? (["review-records", wallet, page, pageSize, locale] as const) : null;

  const { data, error, isLoading, mutate } = useSWR<ReviewRecordListResponse>(
    key,
    async () => {
      const reviewHost =
        process.env.NEXT_PUBLIC_REVIEW_API_HOST || "https://review.yesono.trade";
      const params = new URLSearchParams();
      params.set("wallet", wallet!);
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...getLanguageHeaders(),
      };
      if (token) headers["tk"] = token;

      const url = `${reviewHost}/review_api/review/v1/event/review_record/list?${params}`;
      const res = await fetch(url, { method: "GET", headers });
      if (!res.ok) throw new Error(`Review records fetch failed: ${res.status}`);
      const result = await res.json();
      if (result.code !== 2000) {
        throw new Error(result.message || "Review records fetch failed");
      }
      return result.data as ReviewRecordListResponse;
    }
  );

  return {
    records: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    error: (error as Error) ?? null,
    refresh: () => void mutate(),
  };
}
