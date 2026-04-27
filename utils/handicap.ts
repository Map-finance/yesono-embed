/**
 * 盘口格式化工具（纯步进模式专用）
 *
 * 功能：
 * - 支持让球盘（可为负数）和大小球盘（仅正数）
 * - 自动识别走盘（0.25, 0.75, 1.25...）并格式化为 "0.5/1" 形式
 * - 不包含输入验证和规范化逻辑（由 InputNumber 的 step 属性保证）
 */

/**
 * 格式化小数显示（去除不必要的尾部0）
 * @param value 数值
 * @returns 格式化后的字符串
 *
 * @example
 * formatDecimal(1.0)  => "1"
 * formatDecimal(0.5)  => "0.5"
 * formatDecimal(0.75) => "0.75"
 */
function formatDecimal(value: number): string {
  if (value % 1 === 0) {
    return value.toString(); // 整数不显示小数点
  }
  return value.toFixed(2).replace(/\.?0+$/, ""); // 最多2位小数，去除尾部0
}

/**
 * 格式化盘口显示（核心函数）
 * @param value 盘口值（可为正数或负数）
 * @param forceSign 是否强制显示正号（默认true）
 * @returns 格式化后的字符串
 *
 * @example
 * // 走盘格式
 * formatHandicap(0.75, true)   => "+0.5/1"
 * formatHandicap(-0.75, true)  => "-0.5/1"
 * formatHandicap(1.25, true)   => "+1/1.5"
 *
 * // 单一盘口
 * formatHandicap(0.5, true)    => "+0.5"
 * formatHandicap(-0.5, true)   => "-0.5"
 * formatHandicap(1, true)      => "+1"
 *
 * // 平手盘
 * formatHandicap(0, true)      => "0"
 * formatHandicap(0, false)     => "0"
 *
 * // 不显示正号
 * formatHandicap(0.75, false)  => "0.5/1"
 * formatHandicap(2.5, false)   => "2.5"
 */
export function formatHandicap(
  value: number,
  forceSign: boolean = true
): string {
  const abs = Math.abs(value);
  const isNegative = value < 0;
  const isZero = Math.abs(value) < 0.0001;

  // 平手盘直接返回 "0"
  if (isZero) {
    return "0";
  }

  // 判断是否为走盘（0.25, 0.75, 1.25, 1.75...）
  // 走盘的特征：除以0.5后余数为0.25
  const isHalfStep = Math.abs((abs % 0.5) - 0.25) < 0.0001;

  let formatted: string;

  if (isHalfStep) {
    // 走盘格式：0.75 -> "0.5/1"
    const low = abs - 0.25;
    const high = abs + 0.25;
    formatted = `${formatDecimal(low)}/${formatDecimal(high)}`;
  } else {
    // 单一盘口：0.5 -> "0.5", 1.0 -> "1"
    formatted = formatDecimal(abs);
  }

  // 添加符号
  if (isNegative) {
    return `-${formatted}`;
  } else if (forceSign) {
    return `+${formatted}`;
  } else {
    return formatted;
  }
}
/**
 * 格式化让球盘显示（根据是否为主队自动添加正负号）
 * @param value 盘口值
 * @param isHomeTeam 是否为主队
 * @returns 格式化后的字符串
 */
export function formatHandicapByTeam(value: number, isHomeTeam: boolean): string {
  const numValue = Number(value);
  
  if (numValue === 0) {
    return '0';
  }
  
  // 主队显示正值，客队显示负值
  const displayValue = isHomeTeam ? numValue : -numValue;
  return formatHandicap(displayValue, true);
}

/**
 * 格式化大小球显示（带"大"/"小"文本）
 * @param value 盘口值
 * @param isOver 是否为大球
 * @param overText 大球文本（默认"大"）
 * @param underText 小球文本（默认"小"）
 * @returns 格式化后的字符串
 */
export function formatOverUnderWithText(
  value: number,
  isOver: boolean,
  overText: string = '大',
  underText: string = '小'
): string {
  const formatted = formatHandicap(value, false);
  return isOver ? `${overText}${formatted}` : `${underText}${formatted}`;
}