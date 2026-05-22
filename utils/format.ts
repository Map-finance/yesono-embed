/**
 * 格式化工具函数 - 精简版
 */

/**
 * 格式化文件大小
 */
export const formatFileSize = (bytes: number, decimals: number = 2): string => {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

/**
 * 格式化时间
 */
export const formatTime = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

/**
 * 格式化数字（添加千分位分隔符）
 */
export const formatNumber = (num: number, locale: string = "zh-CN"): string => {
  return num.toLocaleString(locale);
};

/**
 * 余额类金额"向下截断"到固定小数位（默认 2 位）。
 * 不变量：**显示值永远 ≤ 真实值**。
 *
 * 为什么必须 truncate 不能 toFixed：
 * - toFixed(2) 是四舍五入，4.99671 → "5.00"
 * - 用户看到 5.00 输入 5 提现，后端 cash 实际 4.99671 → "Insufficient balance"
 * - truncate 后 4.99671 → "4.99"，前端直接拦截
 */
export const truncateBalance = (
  amount: number,
  decimals: number = 2
): string => {
  if (!Number.isFinite(amount)) return (0).toFixed(decimals);
  const factor = Math.pow(10, decimals);
  return (Math.floor(amount * factor) / factor).toFixed(decimals);
};

/**
 * 格式化百分比
 */
export const formatPercentage = (
  value: number,
  total: number,
  decimals: number = 2
): string => {
  if (total === 0) return "0%";
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(decimals)}%`;
};

/**
 * 格式化货币
 */
export const formatCurrency = (
  amount: number,
  currency: string = "CNY",
  locale: string = "zh-CN"
): string => {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);
};

/**
 * 缩写格式化货币，例如：1200 -> $1k, 1500000 -> $2m
 * 规则：使用 1000 为单位缩写（k, m, b, t），保留整数并四舍五入，负号放在 $ 之前（"-$1k"）。
 */
export const formatAbbreviatedCurrency = (
  amount: number,
  currencySymbol: string = '$'
): string => {
  const sign = amount < 0 ? '-' : '';
  let n = Math.abs(Math.round(amount));

  if (n < 1000) {
    return `${sign}${currencySymbol}${n.toLocaleString()}`;
  }

  const units = ['k', 'm', 'b', 't'];
  let unitIndex = -1;
  while (n >= 1000 && unitIndex < units.length - 1) {
    n = Math.round(n / 1000);
    unitIndex += 1;
  }

  const unit = units[unitIndex] || '';
  return `${sign}${currencySymbol}${n}${unit}`;
};

/**
 * 使用 Intl.DateTimeFormat 按 locale 格式化日期字符串或 Date
 */
export const formatDate = (
  input: string | number | Date,
  locale: string = "en-US",
  options?: Intl.DateTimeFormatOptions
): string => {
  const d =
    typeof input === "string" || typeof input === "number"
      ? new Date(input)
      : input;
  try {
    return new Intl.DateTimeFormat(locale, options).format(d);
  } catch (err) {
    return d.toLocaleDateString();
  }
};

/**
 * 格式化地址（隐藏中间部分）
 */
export const maskAddress = (
  address: string,
  start: number = 6,
  end: number = 4
): string => {
  if (!address || address.length < start + end) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
};

/**
 * 内部 helper：raw 概率（0-1 ratio）→ clamp 后的百分比 number
 * 先 round 到目标精度，再 clamp 到 [10^-fd, 100-10^-fd]
 */
function _clampedProbability(
  rawPrice: number | string | null | undefined,
  fractionDigits: number,
): number | null {
  if (rawPrice == null || rawPrice === "") return null;
  const num = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
  if (!Number.isFinite(num)) return null;
  const factor = Math.pow(10, fractionDigits);
  const rounded = Math.round(num * 100 * factor) / factor;
  const minVal = 1 / factor;
  const maxVal = 100 - minVal;
  return Math.max(minVal, Math.min(maxVal, rounded));
}

/**
 * 预测市场 outcome 概率显示（cents，"XX.X¢"），未结算市场 clamp 到 [0.1¢, 99.9¢]。
 * 避免 toFixed 四舍五入造成 100.0¢/0.0¢ 误导成"绝对发生/不发生"。
 * 仅用于"概率"显示；订单簿挂单 / 成交价等"事实"数据请保留原 toFixed。
 */
export function formatOutcomeProbabilityCents(
  rawPrice: number | string | null | undefined,
  fractionDigits: number = 1,
): string {
  const v = _clampedProbability(rawPrice, fractionDigits);
  return v == null ? "—" : `${v.toFixed(fractionDigits)}¢`;
}

/**
 * 一组 outcome 价格，如果**整组全为 0 / null**（市场无流动性、后端没价格），
 * 把每个价格替换成"平分概率"（二元 0.5、三元 0.333、N 元 1/N）；否则原样返回。
 *
 * 用法：caller 拿到一组 outcome.price[] 后，在 formatOutcomeProbabilityCents
 * 之前调一下：
 *   const filled = fillEvenSplitWhenAllZero(outcomes.map(o => o.price));
 *   filled.map(p => formatOutcomeProbabilityCents(p));
 *
 * 注意：**只有整组全 0 才平分**，部分 0 不会被改（那些 0 仍走 clamp 显示 0.1¢
 * 或调用方原本的逻辑），避免单条没流动性的 outcome 把概率盘吹偏。
 */
export function fillEvenSplitWhenAllZero(
  rawPrices: (number | string | null | undefined)[],
): (number | null)[] {
  const nums: (number | null)[] = rawPrices.map((p) => {
    if (p == null || p === "") return null;
    const n = typeof p === "number" ? p : Number(p);
    return Number.isFinite(n) ? n : null;
  });
  if (nums.length === 0) return nums;
  const allZero = nums.every((n) => n == null || n === 0);
  if (allZero) {
    const share = 1 / nums.length;
    return nums.map(() => share);
  }
  return nums;
}

/**
 * 预测市场 outcome 概率显示（% 后缀，"XX%"）。共用底层 clamp。
 */
export function formatOutcomeProbabilityPercent(
  rawPrice: number | string | null | undefined,
  fractionDigits: number = 0,
): string {
  const v = _clampedProbability(rawPrice, fractionDigits);
  return v == null ? "—" : `${v.toFixed(fractionDigits)}%`;
}

/**
 * 拿 clamp 后的百分比 number（不带后缀），用于参与 chart Y 轴 / 进度条 width 等数值计算。
 * 失败兜底返回 50（中性概率）。
 */
export function clampOutcomeProbabilityPercent(
  rawPrice: number | string | null | undefined,
  fractionDigits: number = 0,
): number {
  const v = _clampedProbability(rawPrice, fractionDigits);
  return v == null ? 50 : v;
}

/**
 * 获取对应加密货币的品牌主题色
 */
export function getAssetColor(symbol?: string): string {
  if (!symbol) return "#F5A524"; // Default Bitcoin Orange
  const s = symbol.toLowerCase();

  if (s.includes("eth")) return "#637FEB";
  if (s.includes("sol")) return "#9945FF";
  if (s.includes("xrp")) return "#028CFF";

  // Default to BTC orange
  return "#FF9900";
}
