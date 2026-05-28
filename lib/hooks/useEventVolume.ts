import useSWR from "swr";
import { getEventVolume, type EventVolumeData } from "@/lib/api";

/**
 * 按 eventId 查询事件交易量(总量 + 24h 增量 + 各市场分解)
 * - SWR 缓存 + 60s 自动刷新,详情页"💰 xxx Volume"实时反映最新交易量
 * - eventId 为空时不发请求(返回 undefined)
 * - 失败/异常返回 undefined,调用方应当回退到 event.volume 静态值
 */
export function useEventVolume(eventId: string | number | undefined | null) {
  const key = eventId ? ["event-volume", String(eventId)] : null;

  const { data, error, isLoading, isValidating, mutate } = useSWR<
    EventVolumeData | undefined
  >(
    key,
    async () => {
      const resp = await getEventVolume(eventId as string | number);
      if (resp?.code === 200 && resp.data) {
        return resp.data;
      }
      return undefined;
    },
    {
      refreshInterval: 30_000, // 30s 轮询
      revalidateOnFocus: true,
      dedupingInterval: 10_000,
      keepPreviousData: true, // 切换 range/重新拉取时保留旧值防闪烁
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating,
    refresh: mutate,
  };
}
