"use client";

/**
 * 通用"主动触发"hook：包装 cancel / split / merge / redeem / createOrder / createUmaMarket
 * 这些都是用户点击后调用一次的请求，不适合用 useAsyncResource。
 */

import { useCallback, useRef, useState } from "react";

export interface MutationState<TArgs, TResp> {
  data: TResp | null;
  loading: boolean;
  error: string | null;
  /** 主动调用 */
  mutate: (args: TArgs) => Promise<TResp | null>;
  /** 重置状态（清 data / error） */
  reset: () => void;
}

export function useTobMutation<TArgs, TResp>(
  fn: (args: TArgs) => Promise<TResp>
): MutationState<TArgs, TResp> {
  const [data, setData] = useState<TResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const mutate = useCallback(async (args: TArgs): Promise<TResp | null> => {
    setLoading(true);
    setError(null);
    try {
      const r = await fnRef.current(args);
      setData(r);
      return r;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, mutate, reset };
}
