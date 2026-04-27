
import useSWR from "swr";
import { getPriceHistory } from "@/lib/api";
import { useMemo } from "react";
import { Fidelity } from "@/lib/types";

export type TimeRange = "1H" | "1D" | "1W" | "1M" | "6M" | "ALL";

interface ChartDataPoint {
  date: number; // timestamp
  [marketId: string]: number; // dynamic keys for values
}

// 辅助函数：根据 TimeRange 计算请求参数
const getRangeParams = (range: TimeRange): { startTs: number; fidelity: Fidelity } => {
  const now = Math.floor(Date.now() / 1000);
  let startTs: number;
  let fidelity: Fidelity; // 粒度

  switch (range) {
    case "1H":
      startTs = now - 3600;
      fidelity = "1MIN"; 
      break;
    case "1D":
      startTs = now - 86400;
      fidelity = "5MINS"; 
      break;
    case "1W":
      startTs = now - 7 * 86400;
      fidelity = "1HOUR"; 
      break;
    case "1M":
      startTs = now - 30 * 86400;
      fidelity = "4HOURS"; 
      break;
    case "6M":
      startTs = now - 180 * 86400;
      fidelity = "1DAY"; 
      break;
    case "ALL":
      startTs = 0; // 从头开始
      fidelity = "1DAY"; 
      break;
    default:
      startTs = now - 86400;
      fidelity = "1HOUR";
  }
  return { startTs, fidelity };
};

// 数据标准化与合并
const normalizeData = (responses: any[], marketIds: string[]): ChartDataPoint[] => {
  if (!responses.length) return [];

  // 获取所有唯一的时间点 (假设 API 返回 [{t, v}, ...])
  // 需根据实际 API 返回结构调整。假设结构为 { history: [{ t: number, p: number }] }
  // 下面代码做防御性兼容
  const timeMap = new Map<number, ChartDataPoint>();

  responses.forEach((res, index) => {
    const marketId = marketIds[index];
    // 假设 res.data 是历史数据数组，或者是 res 本身
    const history = Array.isArray(res) ? res : (res?.data || res?.history || []);
    
    if (Array.isArray(history)) {
      history.forEach((point:any) => {
        // API 字段可能是 t/time/timestamp 和 p/price/value
        const t = point?.t || point?.timestamp || point?.time; 
        const v = point?.p || point?.v || point?.price || point?.value; // value

        if (t !== undefined && v !== undefined) {
          /* 如果是秒级时间戳，转毫秒以便前端 chart 使用? Recharts 通常无所谓，但 Date 需毫秒 */
          // 这里保持原样或统一转毫秒
          const date = t > 10000000000 ? t : t * 1000; 
          
          if (!timeMap.has(date)) {
            timeMap.set(date, { date });
          }
          const entry = timeMap.get(date)!;
          entry[marketId] = v;
        }
      });
    }
  });

  return Array.from(timeMap.values()).sort((a, b) => a.date - b.date);
};

export default function useMarketChartLineData(
  marketIds: string | string[],
  range: TimeRange = "1D",
  refreshInterval: number = 5000 // 默认 5s 轮询
) {
  // 统一转为数组
  let ids = Array.isArray(marketIds) ? marketIds : [marketIds];
  ids = ids.slice(0, 5); // 限制最多5个市场，防止请求过多
  // 确保ID稳定，用于 SWR key
  const idsKey = ids.sort().join(",");

  const { startTs, fidelity } = useMemo(() => getRangeParams(range), [range]);

  const fetcher = async () => {
    if (!ids.length) return [];
    
    // 并行请求所有市场数据
    const promises = ids.map(id => getPriceHistory(id, startTs, fidelity));
    const results = await Promise.all(promises);
    
    return normalizeData(results, ids);
  };

  const { data, error, isLoading, isValidating } = useSWR(
    ids.length ? ["marketChart", idsKey, range] : null,
    fetcher,
    {
      refreshInterval: refreshInterval,
      revalidateOnFocus: true,
      dedupingInterval: 2000, 
      keepPreviousData: true // 切换 range 时保留旧数据防止闪烁
    }
  );

  return {
    data: data || [],
    loading: isLoading,
    isValidating,
    error,
    marketIds: ids
  };
}
