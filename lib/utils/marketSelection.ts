/**
 * 市场选中相关的共享口径。
 *
 * 背景:"是否已结算""默认选哪个市场"这两个判断,之前在 page / OutcomeList /
 * TopHolders / Positions 各写了一份。口径一旦不一致,就会出现"默认选中落到已结算市场,
 * 与列表高亮的活跃市场错位"这类 bug。这里收敛成单一来源,所有地方都用它。
 */

interface ResolvableMarket {
  id?: string | number | null;
  umaResolutionStatus?: string | null;
  status?: string | null;
}

/** 市场是否已结算(后端两种字段口径取或:umaResolutionStatus / status === "RESOLVED")。 */
export function isMarketResolved(
  m: ResolvableMarket | null | undefined
): boolean {
  return m?.umaResolutionStatus === "RESOLVED" || m?.status === "RESOLVED";
}

/**
 * 选默认市场:首个"未结算"市场;全部已结算时回退到首项;空数组返回 undefined。
 *
 * 用于多档事件默认选中 —— 后端常把已结算市场排在数组前面(如按 volume 排序),
 * 直接取 markets[0] 会落到已结算档,导致右侧面板默认显示"已结算结果",
 * 与列表里高亮的活跃市场错位。
 */
export function pickDefaultMarket<T extends ResolvableMarket>(
  markets: T[] | null | undefined
): T | undefined {
  if (!markets || markets.length === 0) return undefined;
  return markets.find((m) => !isMarketResolved(m)) ?? markets[0];
}
