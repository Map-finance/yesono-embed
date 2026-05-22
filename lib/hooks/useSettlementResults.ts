import { useEffect, useState } from "react";
import { getMarketSettlementResult } from "@/lib/api";

/**
 * 进程内缓存:同一 marketId 的结算结果只请求一次,跨组件共享。
 * 结算结果是终态(结算后不再变化),整页生命周期内缓存安全。
 */
const cache = new Map<string, number | null>();
const inflight = new Map<string, Promise<number | null>>();

async function fetchOne(id: string): Promise<number | null> {
  if (cache.has(id)) return cache.get(id) as number | null;
  const existing = inflight.get(id);
  if (existing) return existing;

  const p = getMarketSettlementResult(id)
    .then((resp) =>
      resp && resp.success && resp.data !== null && resp.data !== undefined
        ? Number(resp.data)
        : null
    )
    .catch(() => null)
    .then((v) => {
      cache.set(id, v);
      inflight.delete(id);
      return v;
    });

  inflight.set(id, p);
  return p;
}

/**
 * 批量获取多个已结算 market 的结算结果(YES 侧赔付比例)。
 *
 * - 只为传入的 marketId 发请求,调用方应只传已结算(isResolved)的 id。
 * - 进程内缓存 + in-flight 去重:OutcomeList 与详情页右侧面板取同一 id 时只发一次网络请求。
 *
 * @returns `{ [marketId]: number | null }`,值为 YES 侧赔付比例;尚未拉到或无结果时该 key 缺省/为 null。
 */
export function useSettlementResults(
  marketIds: Array<string | number | undefined | null>
): Record<string, number | null> {
  // 去重 + 规整为 string;join 作为 effect 依赖,避免数组引用变化触发重复请求
  const ids = Array.from(
    new Set(marketIds.filter(Boolean).map((id) => String(id)))
  );
  const key = ids.join(",");

  const [results, setResults] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (!ids.length) return;
    let cancelled = false;
    Promise.all(
      ids.map(async (id) => [id, await fetchOne(id)] as const)
    ).then((entries) => {
      if (cancelled) return;
      setResults((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return results;
}
