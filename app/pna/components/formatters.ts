/**
 * /pna 表格共用格式化工具。
 * 不放业务逻辑，只做"数据 → 字符串"的纯转换。
 */

const moneyFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return moneyFmt.format(n);
}

export function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * unix 时间戳（秒）→ "Mar 5, 2026"
 */
export function fmtUnixDate(unixSec: number | null | undefined): string {
  if (!unixSec) return "—";
  return dateFmt.format(new Date(unixSec * 1000));
}

const dateTimeFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * unix 时间戳（毫秒或秒，自动判断）→ "Mar 5, 14:30"
 */
export function fmtUnixDateTime(unix: number | null | undefined): string {
  if (!unix) return "—";
  const ms = unix < 1e12 ? unix * 1000 : unix;
  return dateTimeFmt.format(new Date(ms));
}
