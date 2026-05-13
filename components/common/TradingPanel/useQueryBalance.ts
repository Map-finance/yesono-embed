import { useState, useEffect, useCallback, useRef } from "react";
import { useTradingStore } from "@/lib/store/tradingStore";
import { useEmbed } from "@/lib/embed/EmbedContext";
// yesono-embed 不引入 viem；inline 6-decimal parseUnits
function parseUnits(value: string, decimals: number): bigint {
  const [whole = "0", frac = ""] = String(value).split(".");
  const padded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(padded || "0");
}
import { getUserCtfBalance } from "@/lib/api";

/**
 * Hook: 聚合查询 dYdX 和 BAC (主链) 的余额信息
 * 包括：USDT, YES, NO
 */
export function useQueryBalance() {
  const { market } = useTradingStore();
  // 未登录时跳过：未 authed 调 ctf-balance 会被 axios 拦截器跳过 Authorization 注入，
  // 后端返回 401/空，还会污染日志。等 authed 才开轮询。
  const { status: embedStatus } = useEmbed();
  const isAuthed = embedStatus === "authed";

  // 状态定义
  const [bacYes, setBacYes] = useState<bigint>(0n);
  const [bacNo, setBacNo] = useState<bigint>(0n);
  const [loading, setLoading] = useState(false);

  // generation counter: 防止过期请求覆盖新结果
  const generationRef = useRef(0);

  // 获取所有平台的 YES/NO 余额 (通过后端综合 API)
  const fetchAllCtfBalances = useCallback(async () => {
    if (!market) return;
    if (!isAuthed) return;

    const outcomes = market.marketOutcomes || [];

    if (outcomes.length === 0) {
      setBacYes(0n);
      setBacNo(0n);
      return;
    }

    // 递增 generation，标记当前请求批次
    const currentGen = ++generationRef.current;

    try {
      let nextYes = 0n;
      let nextNo = 0n;
      await Promise.all(
        outcomes.map(async (outcome) => {
          if (!outcome.unionKey) return;
          const resp = await getUserCtfBalance(outcome.unionKey);
          if (resp.success && resp.data !== undefined && resp.data !== null) {
            const data = resp.data as any;
            const balanceNum = parseFloat(String(data));
            if (!Number.isFinite(balanceNum)) return;
            const balance = parseUnits(balanceNum.toFixed(6), 6);

            const isNo = Number(outcome?.originalIndex) === 1;

            if (isNo) {
              nextNo = balance;
            } else {
              nextYes = balance;
            }
          }
        })
      );
      // 仅当本批次仍为最新时才更新状态，丢弃过期结果
      if (generationRef.current === currentGen) {
        setBacYes(nextYes);
        setBacNo(nextNo);
      }
    } catch (e) {
      console.error("Fetch all CTF balance error", e);
    }
  }, [market, isAuthed]);

  const refetch = useCallback(async () => {
    setLoading(true);
    await fetchAllCtfBalances();
    setLoading(false);
  }, [fetchAllCtfBalances]);

  useEffect(() => {
    refetch();
    const timer = setInterval(refetch, 10000);
    return () => clearInterval(timer);
  }, [refetch]);

  return {
    bacYes,
    bacNo,
    totalYes: bacYes,
    totalNo: bacNo,
    loading,
    refetch,
  };
}
