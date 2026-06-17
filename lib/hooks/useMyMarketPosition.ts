"use client";

/**
 * useMyMarketPosition - 当前市场「我的持仓」(走 legacy router/positions/active)
 *
 * 接口:GET ${LEGACY_ROUTER_BASE_URL}/positions/active?marketId=...
 * 同市场返 0-2 条记录(YES/NO 侧),按 outcome 名拆开。
 *
 * 轮询策略:5s silent refresh(只更新数据,不翻 loading),WS 推送上线后可去掉。
 * embed authStore stub 适配:不用 useShallow 选择器,直接 useAuthStore() 取对象。
 */

import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { useAuthStore } from "@/lib/stores/authStore";
import { getPositionsActiveRouter } from "@/lib/api";
import type { Position } from "@/app/pna/hooks/use-get-positions";

const refreshTriggers = new Set<() => void>();

export function triggerMarketPositionRefresh() {
  refreshTriggers.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn("[useMyMarketPosition] refresh trigger error", e);
    }
  });
}

export interface MyMarketPositionSide {
  shares: number;
  avgPrice: number | null;
  currentPrice: number | null;
  value: number | null;
  profit: number | null;
  profitPct: number | null;
  raw: Position | null;
}

export interface UseMyMarketPositionResult {
  hasPosition: boolean;
  yes: MyMarketPositionSide;
  no: MyMarketPositionSide;
  isLoading: boolean;
  /** @deprecated 兼容老调用,等于 isLoading */
  isLoadingBalance: boolean;
  /** @deprecated 兼容老调用,等于 isLoading */
  isLoadingPnl: boolean;
  refresh: () => Promise<void>;
}

const EMPTY_SIDE: MyMarketPositionSide = {
  shares: 0,
  avgPrice: null,
  currentPrice: null,
  value: null,
  profit: null,
  profitPct: null,
  raw: null,
};

const YES_PATTERNS = ["yes", "up"];
const NO_PATTERNS = ["no", "down"];
function matchesOutcome(p: Position, patterns: string[]): boolean {
  const o = String(p.outcome || "").toLowerCase();
  return patterns.some((pat) => o === pat || o.startsWith(pat));
}

function buildSide(positions: Position[], side: "yes" | "no"): MyMarketPositionSide {
  const patterns = side === "yes" ? YES_PATTERNS : NO_PATTERNS;
  let match = positions.find((p) => matchesOutcome(p, patterns));
  // 单条记录兜底:仅当 outcome 方向无法判定(既不像 yes/up 也不像 no/down)时,默认归 YES
  if (!match && positions.length === 1 && side === "yes") {
    const only = positions[0];
    if (!matchesOutcome(only, YES_PATTERNS) && !matchesOutcome(only, NO_PATTERNS)) {
      match = only;
    }
  }
  if (!match) return EMPTY_SIDE;
  const shares = Number(match.shares) || 0;
  const avgPrice = Number.isFinite(Number(match.avgPrice)) ? Number(match.avgPrice) : null;
  const currentPrice = Number.isFinite(Number(match.currentPrice))
    ? Number(match.currentPrice)
    : null;
  const bValue = Number.isFinite(Number(match.value)) ? Number(match.value) : null;
  const value =
    bValue != null && bValue > 0
      ? bValue
      : currentPrice != null
        ? shares * currentPrice
        : null;
  // profit/profitPct 一律由 value − 成本 推导(不信后端 profit:胜方常返 0)
  const cost = avgPrice != null ? shares * avgPrice : null;
  const profit = value != null && cost != null ? value - cost : null;
  const profitPct =
    cost != null && cost > 0 && profit != null ? (profit / cost) * 100 : null;
  return { shares, avgPrice, currentPrice, value, profit, profitPct, raw: match };
}

export function useMyMarketPosition(marketId: string | undefined): UseMyMarketPositionResult {
  const { isAuthenticated } = useAuthStore();

  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const generationRef = useRef(0);
  const lastFetchedMarketIdRef = useRef<string | undefined>(undefined);

  const fetch = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (!isAuthenticated || !marketId) {
        setPositions([]);
        lastFetchedMarketIdRef.current = undefined;
        return;
      }
      if (lastFetchedMarketIdRef.current !== marketId) {
        setPositions([]);
        lastFetchedMarketIdRef.current = marketId;
      }
      const gen = ++generationRef.current;
      if (!silent) setIsLoading(true);
      try {
        const resp = await getPositionsActiveRouter({ marketId, limit: 50 });
        if (gen !== generationRef.current) return;
        if ((resp.code === 0 || resp.code === 200) && Array.isArray(resp.data)) {
          // 客户端兜底过滤:接口可能返全量(后端 marketId 未生效时)
          const target = String(marketId);
          const matched = (resp.data as Position[]).filter((p) => {
            const a = String(p.marketNumericId ?? "");
            const b = String(p.marketId ?? "");
            return a === target || b === target;
          });
          setPositions(matched);
        }
      } catch (e) {
        console.warn("[useMyMarketPosition] fetch failed", e);
      } finally {
        if (!silent && gen === generationRef.current) setIsLoading(false);
      }
    },
    [isAuthenticated, marketId]
  );

  useEffect(() => {
    void fetch();
    refreshTriggers.add(fetch);
    // 5s 静默轮询:currentPrice/value/profit 随市价波动,WS 不推这种;切市场/未登录时
    // fetch 内部 guard 直接 no-op,所以不必清理 interval 之外的额外条件
    const pollId =
      isAuthenticated && marketId
        ? setInterval(() => void fetch({ silent: true }), 5_000)
        : null;
    return () => {
      refreshTriggers.delete(fetch);
      if (pollId) clearInterval(pollId);
    };
  }, [fetch, isAuthenticated, marketId]);

  const yes = useMemo(() => buildSide(positions, "yes"), [positions]);
  const no = useMemo(() => buildSide(positions, "no"), [positions]);

  return {
    hasPosition: yes.shares > 0 || no.shares > 0,
    yes,
    no,
    isLoading,
    isLoadingBalance: isLoading,
    isLoadingPnl: isLoading,
    refresh: fetch,
  };
}
