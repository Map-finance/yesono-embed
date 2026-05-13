/**
 * OrderBookTab 内部纯工具 / 常量。
 * 从 OrderBookTab.tsx 拆出，机械搬运无修改。
 */

export const pageSizeOptions = [5, 10, 20, 50];

/**
 * 动态金额格式化：
 * - 默认保留两位小数；
 * - 如果数值小于 1 且两位小数为 0.00，则继续增加小数位数，直到出现非 0 数字（或达到上限）。
 */
export const formatDynamicAmount = (
  value: string | number,
  maxDecimals: number = 8
): string => {
  if (value === "-" || value === "" || value == null) return "-";

  const num = Number(value);
  if (Number.isNaN(num)) return String(value);

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  // 完全等于 0 的情况，直接显示 "0"
  if (absNum === 0) return "0";

  // 大于等于 1：固定两位小数 + 千分位
  if (absNum >= 1) {
    return (isNegative ? -absNum : absNum).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  // 小于 1：从 2 位开始增加精度，直到不为 0
  let formatted = "0.00";
  for (let decimals = 2; decimals <= maxDecimals; decimals++) {
    const candidate = absNum.toFixed(decimals);
    if (Number(candidate) !== 0) {
      formatted = candidate;
      break;
    }
  }

  // 去掉多余的结尾 0，但至少保留两位小数
  const [intPart, fracPartRaw] = formatted.split(".");
  if (!fracPartRaw) return isNegative ? `-${formatted}` : formatted;

  let fracPart = fracPartRaw;
  while (fracPart.length > 2 && fracPart.endsWith("0")) {
    fracPart = fracPart.slice(0, -1);
  }

  const formattedInt = Number(intPart).toLocaleString();
  const result = `${formattedInt}.${fracPart}`;
  return isNegative ? `-${result}` : result;
};

/** 盈亏颜色 */
export const getPnlColor = (text: string): string => {
  if (text === "-") return "var(--text-secondary)";
  if (text === "0" || text === "0.00") return "var(--yellow)";
  return text.startsWith("-") ? "var(--red)" : "var(--green)";
};
