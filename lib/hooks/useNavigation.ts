/**
 * 导航 API 统一缓存 Hook
 * 使用 SWR 避免 Header、Navigation、SearchBox、search 等多处重复请求
 */

import useSWR from "swr";
import { FIXED_NAV_ITEMS, type NavigationItem } from "@/types/home";
import type { ApiResponse } from "@/types/home";
import { useLocale, useTranslation } from "@/lib/i18n";
import { useMemo, useEffect } from "react";
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

// last-good 缓存:成功的导航按 locale 存 localStorage;客户端 fetch 偶发失败时
// 回退上次成功的导航,避免动态分类(Sports/政治/加密货币/金融)凭空消失。
const NAV_CACHE_PREFIX = "nav_cache_v1_";
function readNavCache(locale: string): NavigationItem[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(NAV_CACHE_PREFIX + locale);
    if (!raw) return undefined;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0 ? (arr as NavigationItem[]) : undefined;
  } catch {
    return undefined;
  }
}
function writeNavCache(locale: string, items: NavigationItem[]): void {
  if (typeof window === "undefined") return;
  try {
    // 只缓存非空,避免用空数组覆盖上次的好结果
    if (Array.isArray(items) && items.length > 0) {
      localStorage.setItem(NAV_CACHE_PREFIX + locale, JSON.stringify(items));
    }
  } catch {
    /* localStorage 不可用 / 配额满,忽略 */
  }
}

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

  // 读 last-good 缓存作为 fallbackData:首屏/失败时也有动态分类可显示
  const cachedItems = useMemo(() => readNavCache(locale), [locale]);

  const { data: swrItems, isLoading, error, mutate: swrMutate } = useSWR(
    hasProviderData ? null : ["navigation", locale],
    fetchNavigationApi,
    {
      dedupingInterval: 3000,
      // 切回标签页 / 重连时自动重取 —— fetch 失败后能自愈(原 false 失败就一直空)
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      keepPreviousData: true,
      // fetch 未回/失败时回退上次成功的导航,避免动态分类消失
      fallbackData: cachedItems,
    }
  );

  // fetch 成功(非空)即写入 last-good 缓存
  useEffect(() => {
    if (!error && Array.isArray(swrItems) && swrItems.length > 0) {
      writeNavCache(locale, swrItems);
    }
  }, [swrItems, error, locale]);

  const apiItems = (hasProviderData ? navCtx?.data : (swrItems ?? cachedItems)) ?? [];
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
