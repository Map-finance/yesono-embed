/**
 * useTagTree Hook - 子标签树数据管理
 * 基于 docs/API_HOME.md 文档
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getTagTree, isHorizontalTagTree } from '@/lib/services/homeService';
import { TagTreeNode } from '@/types/home';
import { useLocale } from '@/lib/i18n';

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
  const [tags, setTags] = useState<TagTreeNode[]>(initialTags || []);
  const hasInitialData = Array.isArray(initialTags) && initialTags.length > 0;
  const [isLoading, setIsLoading] = useState<boolean>(
    // 如果没有初始 tags 且启用了数据请求，则开始为 loading
    !hasInitialData && enabled
  );
  const hasFetchedOnce = useRef<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isHorizontal, setIsHorizontal] = useState(true);

  const fetchTags = useCallback(async (opts?: { background?: boolean }) => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    const isBackground = Boolean(opts?.background);

    // 如果是第一次且有初始数据，我们以后台方式请求，不覆盖当前 isLoading
    if (!isBackground) {
      // 普通（手动或非后台）请求显示 loading
      setIsLoading(true);
    }

    setError(null);

    try {
      const data = await getTagTree(slug, withCount, category);
      setTags(data);
      setIsHorizontal(isHorizontalTagTree(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tags');
      setTags([]);
    } finally {
      hasFetchedOnce.current = true;
      if (!isBackground) {
        setIsLoading(false);
      }
    }
  }, [slug, withCount, category, enabled]);

  useEffect(() => {
    // 如果有初始数据且尚未请求过，则以后台方式请求一次；否则正常请求
    if (hasInitialData && !hasFetchedOnce.current) {
      // 不阻塞初始渲染
      fetchTags({ background: true });
      return;
    }

    fetchTags();
  }, [fetchTags, locale, hasInitialData]);

  // 如果外部传入 initialTags，保持同步（prop 变化时更新）
  useEffect(() => {
    if (initialTags) {
      setTags(initialTags);
      // 重置已请求标记以便新的 initialTags 可触发后台刷新
      hasFetchedOnce.current = false;
    }
  }, [initialTags]);

  const refresh = useCallback(async () => {
    await fetchTags();
  }, [fetchTags]);

  return {
    tags,
    isLoading,
    error,
    isHorizontal,
    refresh,
  };
}

export default useTagTree;
