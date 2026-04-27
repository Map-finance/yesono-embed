/**
 * 这里封装“USDT 合约传参金额裁剪”的通用工具。
 *
 * 你的明确诉求（中文注释尽量详细）：
 * - 下注 / 开盘 这种智能账户交易，在发交易前需要把合约方法里传入的数量（stake/bet）裁剪到合适范围；
 * - 必须保证：交易扣完业务金额后，智能账户 USDT 余额仍然至少保留 0.01 USDT；
 * - 这一步只关心“合约方法参数金额”，不掺入 gas 的估算折算（否则会导致金额被过度扣小，与你的诉求不一致）。
 */

/**
 * 默认“余额底线”：0.01 USDT（6 位精度）= 10_000 quantums
 *
 * 说明（按你的要求“别复杂”）：
 * - 这个常量不导出，不让组件侧传参/感知
 * - 以后要改底线，只改这里即可
 */
export const RESERVE_QUANTUMS = 10_000n;
const MIN_REMAINING_USDT_QUANTUMS = RESERVE_QUANTUMS;

/**
 * capC2cSpendQuantums
 *
 * 中文注释（这就是你要的“别复杂”的版本）：
 * - 输入：余额 balance、用户输入 desired、可选预留 reserve（开盘要预留 bond，下注 reserve=0）
 * - 输出：应该传给合约方法的最终金额 final（quantums）
 * - 内部默认保证：扣完（reserve + final）之后，余额仍 >= 0.01 USDT
 *
 * 公式（全部使用 USDT quantums）：
 * - maxSpend = max(balance - reserve - 0.01, 0)
 * - final = min(desired, maxSpend)
 */
export function capC2cSpendQuantums(
  balanceQuantums: bigint,
  desiredSpendQuantums: bigint,
  reserveQuantums: bigint = 0n
): { maxSpendQuantums: bigint; finalSpendQuantums: bigint } {
  const maxSpendQuantums =
    balanceQuantums > reserveQuantums + MIN_REMAINING_USDT_QUANTUMS
      ? balanceQuantums - reserveQuantums - MIN_REMAINING_USDT_QUANTUMS
      : 0n;

  const finalSpendQuantums =
    desiredSpendQuantums > maxSpendQuantums ? maxSpendQuantums : desiredSpendQuantums;

  return { maxSpendQuantums, finalSpendQuantums };
}

