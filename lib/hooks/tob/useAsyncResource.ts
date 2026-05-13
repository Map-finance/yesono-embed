"use client";

/**
 * 通用异步资源 hook：包装"取数 → loading / error / data → refresh"模式。
 * 配合 To-B 业务 hook 共用，避免每个 hook 重复样板。
 *
 * - 启动时若 `enabled=false`，不发请求；切到 true 自动发一次
 * - `inFlight` 锁防并发；同帧内多次 refresh 复用同一 Promise
 * - `deps` 变化时重新拉
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  fetchedAt: number;
  refresh: () => Promise<T | null>;
}

export interface AsyncOptions<T> {
  /** 是否启用（依赖未就绪可传 false 暂停拉取） */
  enabled?: boolean;
  /** 初始数据（首次渲染立即可见，骨架屏可省） */
  initial?: T | null;
  /** 拉数失败时是否清空 data；默认保留旧数据 */
  resetOnError?: boolean;
}

export function useAsyncResource<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
  options: AsyncOptions<T> = {}
): AsyncState<T> {
  const { enabled = true, initial = null, resetOnError = false } = options;

  const [data, setData] = useState<T | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);

  const inFlight = useRef<Promise<T | null> | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async (): Promise<T | null> => {
    if (inFlight.current) return inFlight.current;
    setLoading(true);
    const p = (async () => {
      try {
        const r = await fetcherRef.current();
        setData(r);
        setFetchedAt(Date.now());
        setError(null);
        return r;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        if (resetOnError) setData(null);
        return null;
      } finally {
        setLoading(false);
        inFlight.current = null;
      }
    })();
    inFlight.current = p;
    return p;
  }, [resetOnError]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, loading, error, fetchedAt, refresh };
}
