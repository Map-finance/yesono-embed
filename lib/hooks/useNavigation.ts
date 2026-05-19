/**
 * 导航 API 统一缓存 Hook
 * 使用 SWR 避免 Header、Navigation、SearchBox、search 等多处重复请求
 */

import useSWR from "swr";
import { FIXED_NAV_ITEMS, type NavigationItem } from "@/types/home";
import type { ApiResponse } from "@/types/home";
import { useLocale, useTranslation } from "@/lib/i18n";
import { useMemo } from "react";
/** 按点分路径取值（替代 lodash.get）；任何一段为 null/undefined 走 fallback */
function getByPath(obj: unknown, path: string, fallback: string): string {
  const parts = path.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return fallback;
    cur = cur[p];
  }
  return (cur as string | undefined) ?? fallback;
}
import { useNavigationContext } from "@/lib/providers/NavigationProvider";
import { getAuthApiUrl } from "@/lib/config/authApiUrl";

const FIXED_SLUGS = FIXED_NAV_ITEMS.map((item) => item.slug.toLowerCase());

async function fetchNavigationApi([, locale]: [string, string]): Promise<NavigationItem[]> {
  const response = await fetch(getAuthApiUrl("/api/navigation"), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Accept-Language": locale,
    },
  });

  if (!response.ok) {
    return [];
  }

  const result: ApiResponse<NavigationItem[]> = await response.json();
  if (!result.success || !Array.isArray(result.data)) {
    return [];
  }

  return result.data;
}

/**
 * 获取合并后的导航（固定项 + API 动态项，过滤重复 slug）
 */
export function useNavigation() {
  const { locale } = useLocale();
  const { t } = useTranslation();
  const navCtx = useNavigationContext();
  const hasProviderData = Boolean(navCtx?.data);

  const fixedNavItems_t = useMemo(() => {
    return FIXED_NAV_ITEMS.map(item => ({
      ...item,
      label: getByPath(t, item.langKey, item.label),
    }));
  }, [t]);

  const { data: swrItems, isLoading, error, mutate: swrMutate } = useSWR(
    hasProviderData ? null : ["navigation", locale],
    fetchNavigationApi,
    {
      dedupingInterval: 3000,
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const apiItems = (hasProviderData ? navCtx?.data : swrItems) ?? [];
  const dynamicItems =
    apiItems.filter(
      (item) => !FIXED_SLUGS.includes(item.slug?.toLowerCase() ?? "")
    ) ?? [];
  const data = [...fixedNavItems_t, ...dynamicItems];

  const mutate = async (
    newData?: NavigationItem[] | ((d: NavigationItem[] | null) => NavigationItem[] | null)
  ) => {
    if (hasProviderData && navCtx) {
      if (typeof newData === "function") {
        const updated = newData(navCtx.data ?? null);
        navCtx.setData(updated ?? null);
      } else if (Array.isArray(newData)) {
        navCtx.setData(newData);
      }
      return;
    }

    await swrMutate(newData as any);
  };

  return {
    data,
    dynamicItems,
    isLoading: hasProviderData ? false : isLoading,
    error: hasProviderData ? undefined : error,
    mutate,
  };
}
