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
 * unix 时间戳（毫秒或秒，自动判断）→ "2026/04/22 20:38"
 * 24 小时制，零填充。用于亚盘开盘记录这种需要紧凑数字时间戳的场景。
 */
export function fmtMatchTime(unix: number | string | null | undefined): string {
  const ms = toMillis(unix, /* assumeSeconds */ false);
  if (ms === null) return "—";
  const d = new Date(ms);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}/${mm}/${dd} ${hh}:${mi}`;
}

export interface RelativeTimeI18n {
  minutesAgo: string;
  hourAgo: string;
  hoursAgo: string;
  dayAgo: string;
  daysAgo: string;
}

/**
 * unix 时间戳 → "5 分钟前" / "3 小时前" / "4 天前"，超 30 天回退到日期。
 * 与 h2-market 原 ActivityTable 一致，单数/复数走 i18n 字段（hourAgo vs hoursAgo）。
 */
export function fmtRelativeTime(
  unix: number | string | null | undefined,
  i18n?: RelativeTimeI18n
): string {
  const ms = toMillis(unix, /* assumeSeconds */ false);
  if (ms === null) return "—";
  const diff = Date.now() - ms;
  const minutesAgo = i18n?.minutesAgo ?? "minutes ago";
  const hourAgo = i18n?.hourAgo ?? "hour ago";
  const hoursAgo = i18n?.hoursAgo ?? "hours ago";
  const dayAgo = i18n?.dayAgo ?? "day ago";
  const daysAgo = i18n?.daysAgo ?? "days ago";
  if (diff < 0) {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(ms));
  }
  if (diff < 60_000) return `<1 ${minutesAgo}`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} ${minutesAgo}`;
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000);
    return `${h} ${h === 1 ? hourAgo : hoursAgo}`;
  }
  if (diff < 30 * 86_400_000) {
    const d = Math.floor(diff / 86_400_000);
    return `${d} ${d === 1 ? dayAgo : daysAgo}`;
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(ms));
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
