/**
 * yesono-embed 版 usePortfolio
 *
 * 复用旧后端的 GET /api/user/portfolio（user 说过"除 tob 外其余接口沿用旧接口"）。
 * 差别于 h2-market：
 *  - 身份判断改用 `useEmbedAuth().status === "authed"`（embed 场景没有 Privy）
 *  - 不依赖 useHybridSmartAccount（embed 没有智能账户；以"认证即查"为触发条件）
 */

"use client";

import { useEffect } from "react";
import useSWR, { mutate } from "swr";
import { authFetch } from "@/lib/api";
import { usePortfolioStore } from "@/lib/stores/portfolioStore";
import { useEmbed } from "@/lib/embed/EmbedContext";

const AUTH_BASE_URL = `${process.env.NEXT_PUBLIC_AUTH_API_URL!}/api`;
const SWR_KEY = "user-portfolio";

async function fetchPortfolio() {
  const res = await authFetch(`${AUTH_BASE_URL}/user/portfolio`);
  if (!res.ok) {
    throw new Error(`Portfolio fetch failed: ${res.status}`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.message || json.msg || "Failed to fetch portfolio");
  }
  return json.data as { cash: number; portfolio: number; items?: any[] };
}

/** 全局刷新：成交后立即触发 */
export function refreshPortfolio() {
  return mutate((key) => Array.isArray(key) && key[0] === SWR_KEY);
}

export function usePortfolio() {
  const { status } = useEmbed();
  const isAuthed = status === "authed";
  const { setPortfolioData, setLoading } = usePortfolioStore();

  const { data, error, isLoading, isValidating } = useSWR(
    isAuthed ? [SWR_KEY] : null,
    fetchPortfolio,
    {
      refreshInterval: 5_000,
      revalidateOnFocus: true,
      dedupingInterval: 3_000,
      keepPreviousData: false,
    }
  );

  useEffect(() => {
    if (data) {
      setPortfolioData({
        cash: Number(data.cash) || 0,
        portfolio: Number(data.portfolio) || 0,
        items: (data.items as any[]) || [],
      });
    }
  }, [data, setPortfolioData]);

  useEffect(() => {
    setLoading(isLoading || isValidating);
  }, [isLoading, isValidating, setLoading]);

  return { data, error, isLoading, isValidating };
}
