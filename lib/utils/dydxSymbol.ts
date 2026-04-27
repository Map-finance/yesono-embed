/**
 * dYdX CTF symbol / tradingPair 解析与校验工具
 *
 * 背景（审计加固）：
 * - 原代码用 `input.replace(/-USDT$/, "")` 派生 token 标识，输入格式不符时静默放行
 * - 异常后端数据 / 脚本调用可能把不合规字符串带入 bridge / CTF 调用
 * - 下游最坏情况可能让资产走错 token 路径
 *
 * 设计策略（"完全不影响功能"）：
 * - 对明显非法（非字符串 / 空串）抛错：这些场景当前代码本身也会炸
 * - 对格式不匹配的字符串：打 warning，但仍按旧 `.replace` 行为返回值
 * - 这样正常流程零影响，异常数据产生可定位的日志而非被静默吞掉
 *
 * dYdX CTF 命名约定：
 * - tradingPair: `<marketNumericId>-<YES|NO>-USDT`
 *   例：`"2022500566731030530-YES-USDT"`
 * - marketId 还可能是纯 tokenId（uint256 数字串，78 位以内）
 */

/**
 * 允许格式：纯数字 tokenId 或 `<digits>-<YES|NO>(-USDT)?`
 * - 下注 / 市场查询时 marketId 可能是两者之一
 */
const MARKET_ID_OR_TRADING_PAIR = /^\d+(?:-(?:YES|NO)(?:-USDT)?)?$/;

/**
 * 严格 dYdX CTF tradingPair
 * - redeem / merge 的 token 必须是完整格式
 */
const DYDX_CTF_TRADING_PAIR = /^(\d+)-(YES|NO)-USDT$/;

/**
 * 从 dYdX market 标识中去掉 -USDT 后缀
 *
 * - 非字符串 / 空串 → 抛错
 * - 格式不符合预期 → console.warn（便于排查），按旧逻辑返回
 */
export function stripDydxUsdtSuffix(input: unknown, context = "unknown"): string {
  if (typeof input !== "string") {
    throw new Error(`[dydxSymbol] expected string for ${context}, got ${typeof input}`);
  }
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error(`[dydxSymbol] empty input for ${context}`);
  }
  if (!MARKET_ID_OR_TRADING_PAIR.test(trimmed)) {
    console.warn(`[dydxSymbol] unexpected format for ${context}:`, trimmed);
  }
  return trimmed.replace(/-USDT$/, "");
}

export interface DydxCtfPairInfo {
  marketNumericId: string;
  outcome: "YES" | "NO";
  stripped: string; // 去掉 -USDT 后的 symbol，如 "123-YES"
}

/**
 * 解析 dYdX CTF tradingPair，严格匹配 `<digits>-(YES|NO)-USDT`
 *
 * - 成功 → 返回解析结果（marketNumericId / outcome / stripped）
 * - 失败（格式不符 / 非字符串 / 空串）→ 返回 null，同时 console.warn
 *
 * 调用方拿到 null 时可以选择 throw（严格）或 fallback（旧行为），
 * 便于按场景分级处理。
 */
export function parseDydxCtfTradingPair(
  input: unknown,
  context = "unknown"
): DydxCtfPairInfo | null {
  if (typeof input !== "string") {
    console.warn(
      `[dydxSymbol] expected string tradingPair for ${context}, got ${typeof input}`
    );
    return null;
  }
  const trimmed = input.trim();
  const m = trimmed.match(DYDX_CTF_TRADING_PAIR);
  if (!m) {
    console.warn(`[dydxSymbol] invalid tradingPair format for ${context}:`, trimmed);
    return null;
  }
  return {
    marketNumericId: m[1],
    outcome: m[2] as "YES" | "NO",
    stripped: trimmed.replace(/-USDT$/, ""),
  };
}
