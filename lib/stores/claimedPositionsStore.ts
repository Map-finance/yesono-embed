import { create } from "zustand";

/**
 * 已领取/已清仓的持仓(按 conditionId)—— 跨组件乐观状态。
 *
 * 背景:redeem 是链上操作,后端 / indexer 把 canClaim 翻成 false 有延迟。
 * 右栏 ClaimWinningsPanel 和详情页 MyPositionsTable 是两个独立组件,各自靠后端
 * canClaim 判断会出现「一处点了领取、另一处还显示可领」的不同步。
 *
 * 改成共享:任一处 redeem 成功就 markClaimed(conditionId),两处都读这个集合,
 * 命中即视为已领取(隐藏按钮 / 显示已领取),不再等后端 canClaim 翻转。
 */
interface ClaimedPositionsState {
  claimed: Set<string>;
  markClaimed: (conditionId: string) => void;
  isClaimed: (conditionId: string | null | undefined) => boolean;
}

export const useClaimedPositionsStore = create<ClaimedPositionsState>((set, get) => ({
  claimed: new Set<string>(),
  markClaimed: (conditionId) =>
    set((s) => {
      if (!conditionId || s.claimed.has(conditionId)) return s;
      const next = new Set(s.claimed);
      next.add(conditionId);
      return { claimed: next };
    }),
  isClaimed: (conditionId) => !!conditionId && get().claimed.has(conditionId),
}));
