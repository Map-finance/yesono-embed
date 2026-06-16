/**
 * useTagTree Hook - 子标签树数据管理(SWR)
 * 基于 docs/API_HOME.md 文档
 *
 * 用 SWR 做「缓存 + 保鲜」:
 *  - 切回/重挂时从缓存秒返(不卡骨架,不再因标签未就绪把网格 gate 进骨架)
 *  - revalidateOnMount/onFocus 后台自动重拉、拿到新数据再更新(不会"一直吃旧缓存")
 *  - dedupingInterval 防短时间内重复打;keepPreviousData 切语言时不闪空
 */

import useSWR from "swr";
import { getTagTree, isHorizontalTagTree } from "@/lib/services/homeService";
import { TagTreeNode } from "@/types/home";
import { useLocale } from "@/lib/i18n";

export interface UseTagTreeOptions {
  slug?: string;
  category?: string;
  withCount?: boolean;
  enabled?: boolean;
  initialTags?: TagTreeNode[];
}

export interface UseTagTreeReturn {
  tags: TagTreeNode[];
  isLoading: boolean;
  error: string | null;
  isHorizontal: boolean;
  refresh: () => Promise<void>;
}

export function useTagTree({
  slug,
  category,
  withCount = false,
  enabled = true,
  initialTags,
}: UseTagTreeOptions): UseTagTreeReturn {
  const { locale } = useLocale();

  const { data, isLoading, error, mutate } = useSWR<TagTreeNode[]>(
    // key 含 slug/withCount/category/locale;不含 token(标签是公共结构)
    enabled ? ["tagtree", slug ?? "", withCount, category ?? "", locale] : null,
    () => getTagTree(slug, withCount, category),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      revalidateIfStale: true, // 命中缓存也在后台重拉,保证相对实时
      dedupingInterval: 5000, // 5s 内同 key 不重复打(防抖),超过即后台保鲜
      keepPreviousData: true, // 切语言等 key 变化时先用旧数据,避免闪空
      fallbackData:
        initialTags && initialTags.length > 0 ? initialTags : undefined,
    }
  );

  const tags = data ?? initialTags ?? [];

  return {
    tags,
    // 仅在「无任何数据且首次加载」时为 true → 切回有缓存时不出骨架
    isLoading: enabled ? isLoading && tags.length === 0 : false,
    error: error
      ? error instanceof Error
        ? error.message
        : String(error)
      : null,
    isHorizontal: isHorizontalTagTree(tags),
    refresh: async () => {
      await mutate();
    },
  };
}

export default useTagTree;
