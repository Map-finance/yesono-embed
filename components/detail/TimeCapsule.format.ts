/**
 * TimeCapsule 时间 / 时区 / 路由格式化工具。
 * 从 TimeCapsule.tsx 拆出，机械搬运。同时清理了三个 dead helper：
 * `formatEndDateLabel` / `formatDualTimezone` / `getTimeLeftLabel`
 * （已被本文件的 Localized 系列函数取代，原文件中无调用方）。
 */

// ---------------------------------------------------------------- 内部常量 / 工具

/** 获取 Intl 格式化结果的特定字段 */
function getPart(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((p) => p.type === type)?.value || "";
}

const ET_TIME_ZONE = "America/New_York";
const UTC_TIME_ZONE = "UTC";

function getCalendarDayIndex(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);

  const year = Number(getPart(parts, "year"));
  const month = Number(getPart(parts, "month"));
  const day = Number(getPart(parts, "day"));

  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function formatLocalizedTime(
  date: Date,
  locale: string,
  options: { timeZone: string; includeMinutes: boolean }
): string {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: options.timeZone,
    hour: "numeric",
    ...(options.includeMinutes ? { minute: "2-digit" as const } : {}),
    hour12: true,
  }).formatToParts(date);

  return parts
    .map((part, index) => {
      if (part.type !== "dayPeriod") return part.value;

      const prev = parts[index - 1];
      const next = parts[index + 1];
      const prefix = prev && prev.type !== "literal" ? " " : "";
      const suffix = next && next.type !== "literal" ? " " : "";
      return `${prefix}${part.value}${suffix}`;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function formatLocalizedMonthDay(
  date: Date,
  locale: string,
  timeZone: string
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatLocalizedMonthDayYear(
  date: Date,
  locale: string,
  timeZone: string
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

// ---------------------------------------------------------------- 对外导出

/** 默认 i18n 兜底文案。 */
export const DEFAULT_TIME_CAPSULE_TEXT = {
  eventEnded: "Event has ended",
  more: "More",
  timeLeftMin: (m: number) => `${m} Min${m > 1 ? "s" : ""} left`,
  timeLeftHr: (h: number) => `${h} Hr${h > 1 ? "s" : ""} left`,
  timeLeftHrMin: (h: number, m: number) => `${h} Hr ${m} Min left`,
};

/** 从 `/market/<slug>/<suffix>` 路径解析 slug 与 suffix。 */
export function getMarketRouteMeta(pathname: string) {
  const match = pathname.match(/^\/market\/([^/]+)(\/.*)?$/);
  return {
    slug: match?.[1] ?? "",
    suffix: match?.[2] ?? "",
  };
}

export interface LocalizedFormattedEndDate {
  timeLabel: string;
  relativeDay: string;
  fullStr: string;
}

/**
 * 根据频率标签格式化 endDate（ET 时区）。
 * - 5m/15m → h:mm AM (如 5:50 AM)
 * - 1h/4h  → h AM (如 6 AM)
 * - showRelativeDay = true 时: 追加 Today/Tomorrow/Yesterday/Mar 1
 * - showRelativeDay = false 时: 不同于今日追加 Mar 1
 */
export function formatLocalizedEndDateLabel(
  endDate: number | string,
  frequencySlug: string,
  locale: string,
  showRelativeDay: boolean = false
): LocalizedFormattedEndDate {
  const date = new Date(Number(endDate));
  const now = new Date();
  const diffDays =
    getCalendarDayIndex(date, ET_TIME_ZONE) -
    getCalendarDayIndex(now, ET_TIME_ZONE);

  // daily/weekly：每期一个、结算时刻固定，时间是冗余信息 →
  // 一律只显示绝对日期（不含时间、也不用"今天/明天"），靠日期区分
  const isDateOnlyFreq = /^(daily|weekly|\d+D|\d+W)$/i.test(frequencySlug);
  if (isDateOnlyFreq) {
    const dateLabel = formatLocalizedMonthDay(date, locale, ET_TIME_ZONE);
    return { timeLabel: dateLabel, relativeDay: "", fullStr: dateLabel };
  }

  const isMinuteFreq = /^\d+M$/i.test(frequencySlug);
  const timeLabel = formatLocalizedTime(date, locale, {
    timeZone: ET_TIME_ZONE,
    includeMinutes: isMinuteFreq,
  });

  let relativeDay = "";
  if (showRelativeDay) {
    if (diffDays >= -1 && diffDays <= 1) {
      relativeDay = new Intl.RelativeTimeFormat(locale, {
        numeric: "auto",
      }).format(diffDays, "day");
    } else {
      relativeDay = formatLocalizedMonthDay(date, locale, ET_TIME_ZONE);
    }
  } else if (diffDays !== 0) {
    relativeDay = formatLocalizedMonthDay(date, locale, ET_TIME_ZONE);
  }

  return {
    timeLabel,
    relativeDay,
    fullStr: relativeDay ? `${timeLabel} ${relativeDay}` : timeLabel,
  };
}

/** 双时区一行文本：{ etDate, etTime, utcDate, utcTime }。 */
export function formatLocalizedDualTimezone(
  endDate: number | string,
  locale: string
) {
  const date = new Date(Number(endDate));

  return {
    etDate: formatLocalizedMonthDayYear(date, locale, ET_TIME_ZONE),
    etTime: formatLocalizedTime(date, locale, {
      timeZone: ET_TIME_ZONE,
      includeMinutes: true,
    }),
    utcDate: formatLocalizedMonthDayYear(date, locale, UTC_TIME_ZONE),
    utcTime: formatLocalizedTime(date, locale, {
      timeZone: UTC_TIME_ZONE,
      includeMinutes: true,
    }),
  };
}

/** 剩余时间描述：X Min(s) / Hr(s) / Hr Min left（已本地化）。 */
export function getLocalizedTimeLeftLabel(
  endDate: number | string,
  currentTime: number,
  timeCapsuleText: typeof DEFAULT_TIME_CAPSULE_TEXT
): string {
  const diff = Number(endDate) - currentTime;
  if (diff <= 0) return "";

  const totalMins = Math.ceil(diff / 60000);
  if (totalMins < 60) return timeCapsuleText.timeLeftMin(totalMins);

  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (mins === 0) return timeCapsuleText.timeLeftHr(hours);

  return timeCapsuleText.timeLeftHrMin(hours, mins);
}
