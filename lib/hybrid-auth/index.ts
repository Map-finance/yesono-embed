/**
 * yesono-embed stub：无 Privy / 无 Alchemy 智能账户
 *
 * embed 场景下不跑钱包，所有链上动作委托给后端。CreateMarketNew 里只用到
 * `useHybridSmartAccount().smartAccount?.address` 来拼接回退用户地址，这里
 * 返回 undefined 即可让它走 `backendUser.walletAddress` 分支。
 */

"use client";

export function useHybridSmartAccount() {
  return {
    smartAccount: undefined as
      | { address?: `0x${string}` }
      | undefined,
    isLoading: false,
    error: null as Error | null,
  };
}
