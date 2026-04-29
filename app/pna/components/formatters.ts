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
export function fmtUnixDate(unixSec: number | string | null | undefined): string {
  const ms = toMillis(unixSec, /* assumeSeconds */ true);
  if (ms === null) return "—";
  return dateFmt.format(new Date(ms));
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
export function fmtUnixDateTime(unix: number | string | null | undefined): string {
  const ms = toMillis(unix, /* assumeSeconds */ false);
  if (ms === null) return "—";
  return dateTimeFmt.format(new Date(ms));
}

/**
 * unix 时间戳 → "5m ago" / "3h ago" / "4d ago" / 超 30 天回退到日期
 */
export function fmtRelativeTime(unix: number | string | null | undefined): string {
  const ms = toMillis(unix, /* assumeSeconds */ false);
  if (ms === null) return "—";
  const diff = Date.now() - ms;
  if (diff < 0) return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(ms));
  if (diff < 60_000) return "<1m";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(ms));
}

/**
 * 防御式把任意"时间戳样"输入转为毫秒。
 * 处理：null / undefined / "" / NaN / 字符串 / 秒 vs 毫秒判定 / 非法 Date。
 */
function toMillis(
  v: number | string | null | undefined,
  assumeSeconds: boolean
): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  // > 1e12 视为毫秒（约 2001 年起）；否则按秒乘 1000；
  // assumeSeconds 用于已知是"秒"的字段（比如 closed-positions.resolvedAt）。
  const ms = assumeSeconds ? n * 1000 : n < 1e12 ? n * 1000 : n;
  // 最后一道防线：Date 越界（极大极小）会得 NaN
  if (Number.isNaN(new Date(ms).getTime())) return null;
  return ms;
}
