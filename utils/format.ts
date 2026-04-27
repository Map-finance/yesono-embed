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
