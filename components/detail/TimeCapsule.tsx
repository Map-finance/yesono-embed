"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { useTranslation } from "@/lib/i18n";
import {
  getCryptoEndDates,
  CryptoEndDateItem,
} from "@/lib/services/homeService";


/**
 * SWR fetcher：key 格式为 "crypto-end-dates:<sorted-slugs-json>"
 * 模块级缓存保证同一 key 在 5 分钟内跨组件挂载只发起一次网络请求
 */
async function endDatesFetcher(key: string): Promise<CryptoEndDateItem[]> {
  const prefix = "crypto-end-dates:";
  const slugs = JSON.parse(key.slice(prefix.length)) as string[];
  if (!slugs.length) return [];
  return getCryptoEndDates(slugs);
}

const END_DATES_EXHAUSTED_REVALIDATE_COOLDOWN_MS = 30000;

interface TagItem {
  id: string;
  label: string;
  slug: string;
}

interface TimeCapsuleProps {
  /** 当前事件从 /api/event/{slug} 返回的 tags 数组 */
  tags?: TagItem[];
  needTimeTagTags?: string[];
  /** 当前事件的 endDate（毫秒时间戳） */
  eventEndDate?: number;
  /** liveSlug 变化时回调父组件，用于 LivePriceHeader 的"Go to live market"跳转 */
  onLiveSlugChange?: (slug: string) => void;
}

const CaretDownIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12px"
    height="12px"
    viewBox="0 0 12 12"
    className="text-[var(--text-primary)] transition-transform duration-200"
  >
    <polyline
      points="1.75 4.25 6 8.5 10.25 4.25"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);

// ============== 时间格式化工具 ==============

/** 获取 Intl 格式化结果的特定字段 */
function getPart(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((p) => p.type === type)?.value || "";
}

/** ET 时区选项 */
const ET_TZ: Intl.DateTimeFormatOptions = { timeZone: "America/New_York" };
const UTC_TZ: Intl.DateTimeFormatOptions = { timeZone: "UTC" };
const ET_TIME_ZONE = "America/New_York";
const UTC_TIME_ZONE = "UTC";

const DEFAULT_TIME_CAPSULE_TEXT = {
  eventEnded: "Event has ended",
  more: "More",
  timeLeftMin: (m: number) => `${m} Min${m > 1 ? "s" : ""} left`,
  timeLeftHr: (h: number) => `${h} Hr${h > 1 ? "s" : ""} left`,
  timeLeftHrMin: (h: number, m: number) => `${h} Hr ${m} Min left`,
};

function getMarketRouteMeta(pathname: string) {
  const match = pathname.match(/^\/market\/([^/]+)(\/.*)?$/);
  return {
    slug: match?.[1] ?? "",
    suffix: match?.[2] ?? "",
  };
}

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

interface LocalizedFormattedEndDate {
  timeLabel: string;
  relativeDay: string;
  fullStr: string;
}

/**
 * 根据频率标签格式化 endDate（ET 时区）
 * - 5m/15m → h:mm AM (如 5:50 AM)
 */
interface FormattedEndDate {
  /** "5:50" 或 "6" */
  timeBase: string;
  /** "AM" 或 "PM" */
  /** "Today" 或 "Mar 1" 等 */
  period: string;
  relativeDay: string;
  /** 之前拼接好的完整字符串，保持向下兼容 */
  fullStr: string;
}

/**
 * 根据频率标签格式化 endDate（ET 时区）
 * - 5m/15m → h:mm AM (如 5:50 AM)
 * - 1h/4h  → h AM (如 6 AM)
 * - showRelativeDay = true 时: 追加 Today/Tomorrow/Yesterday/Mar 1
 * - showRelativeDay = false 时: 不同于今日追加 Mar 1
 */
function formatEndDateLabel(
  endDate: number | string,
  frequencySlug: string,
  locale: string,
  showRelativeDay: boolean = false
): FormattedEndDate {
  const ts = Number(endDate);
  const d = new Date(ts);
  const now = new Date();

  // 获取 ET 时区的 MM/DD/YYYY 字符串以便计算天数差异
  const formatter = new Intl.DateTimeFormat("en-US", {
    ...ET_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const etNowStr = formatter.format(now);
  const etEventStr = formatter.format(d);

  // 解析格式后的日期字符串计算相差天数
  const etNowDate = new Date(etNowStr);
  const etEventDate = new Date(etEventStr);
  const diffDays = Math.round(
    (etEventDate.getTime() - etNowDate.getTime()) / 86400000
  );

  const etParts = new Intl.DateTimeFormat("en-US", {
    ...ET_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatToParts(d);

  const hour = getPart(etParts, "hour");
  const minute = getPart(etParts, "minute");
  const dayPeriod = getPart(etParts, "dayPeriod");
  const month = getPart(etParts, "month");
  const day = getPart(etParts, "day");

  const isMinuteFreq = /^\d+M$/.test(frequencySlug);

  const timeBase = isMinuteFreq ? `${hour}:${minute}` : hour;
  let relativeDay = "";

  if (showRelativeDay) {
    if (diffDays === 0) relativeDay = "Today";
    else if (diffDays === 1) relativeDay = "Tomorrow";
    else if (diffDays === -1) relativeDay = "Yesterday";
    else relativeDay = `${month} ${day}`;
  } else {
    // 原胶囊按钮逻辑：与今日不同即显示具体日期
    if (diffDays !== 0) {
      relativeDay = `${month} ${day}`;
    }
  }

  const fullStr = relativeDay
    ? `${timeBase} ${dayPeriod} ${relativeDay}`
    : `${timeBase} ${dayPeriod}`;

  return { timeBase, period: dayPeriod, relativeDay, fullStr };
}

/** 格式化一行双时区展示文本：{ etDate, etTime, utcDate, utcTime } */
function formatDualTimezone(endDate: number | string) {
  const ts = Number(endDate);
  const d = new Date(ts);

  const etFmt = new Intl.DateTimeFormat("en-US", {
    ...ET_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);

  const utcFmt = new Intl.DateTimeFormat("en-US", {
    ...UTC_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d);

  return {
    etDate: `${getPart(etFmt, "month")} ${getPart(etFmt, "day")}, ${getPart(
      etFmt,
      "year"
    )}`,
    etTime: `${getPart(etFmt, "hour")}:${getPart(etFmt, "minute")} ${getPart(
      etFmt,
      "dayPeriod"
    )}`,
    utcDate: `${getPart(utcFmt, "month")} ${getPart(utcFmt, "day")}, ${getPart(
      utcFmt,
      "year"
    )}`,
    utcTime: `${getPart(utcFmt, "hour")}:${getPart(utcFmt, "minute")} ${getPart(
      utcFmt,
      "dayPeriod"
    )}`,
  };
}

/** 计算剩余时间描述：X Min(s) left */
function getTimeLeftLabel(
  endDate: number | string,
  currentTime: number
): string {
  const diff = Number(endDate) - currentTime;
  if (diff <= 0) return "";
  const totalMins = Math.ceil(diff / 60000);
  if (totalMins < 60) return `${totalMins} Min${totalMins > 1 ? "s" : ""} left`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (mins === 0) return `${hours} Hr${hours > 1 ? "s" : ""} left`;
  return `${hours} Hr ${mins} Min left`;
}

// ============== Tooltip 组件 ==============

function formatLocalizedEndDateLabel(
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

function formatLocalizedDualTimezone(endDate: number | string, locale: string) {
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

function getLocalizedTimeLeftLabel(
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

interface CapsuleTooltipProps {
  endDate: number | string;
  isLive: boolean;
  isEnded: boolean;
  currentTime: number;
}

const CapsuleTooltip: React.FC<CapsuleTooltipProps> = ({
  endDate,
  isLive,
  isEnded,
  currentTime,
}) => {
  const { t, locale } = useTranslation();
  const timeCapsuleText =
    (t.market as any).timeCapsule ?? DEFAULT_TIME_CAPSULE_TEXT;
  const tz = formatLocalizedDualTimezone(endDate, locale);
  // 使用传入的 currentTime 参数（由父组件通过 liveTick 触发更新）
  const timeLeft = !isEnded
    ? getLocalizedTimeLeftLabel(endDate, currentTime, timeCapsuleText)
    : "";

  return (
    <div className="w-64 p-3">
      {/* 状态行 */}
      <div className="flex items-center justify-between mb-2">
        {isEnded ? (
          <span className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {timeCapsuleText.eventEnded}
          </span>
        ) : isLive ? (
          <>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-[#FF453A]">
              <div className="relative flex items-center justify-center w-3 h-3">
                <div className="absolute inset-0 rounded-full bg-[#FF453A]/40"></div>
                <div className="absolute inset-0 rounded-full bg-[#FF453A] animate-ping opacity-75"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF453A] relative z-10"></div>
              </div>
              {t.market.event.live}
            </span>
            {timeLeft && (
              <span className="text-sm text-[var(--text-secondary)]">
                {timeLeft}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {timeLeft}
          </span>
        )}
      </div>

      {/* Resolution Time */}
      <div className="text-xs text-[var(--text-tertiary)] mb-1.5">
        {t.market.chart.resolutionTime}
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-blue-400 font-medium">ET</span>
          <span className="text-[var(--text-secondary)]">{tz.etDate}</span>
          <span className="text-[var(--text-primary)] font-semibold">
            {tz.etTime}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-green-400 font-medium">UTC</span>
          <span className="text-[var(--text-secondary)]">{tz.utcDate}</span>
          <span className="text-[var(--text-primary)] font-semibold">
            {tz.utcTime}
          </span>
        </div>
      </div>
    </div>
  );
};

// ============== 主组件 ==============

const TimeCapsule: React.FC<TimeCapsuleProps> = ({
  tags,
  needTimeTagTags,
  eventEndDate,
  onLiveSlugChange,
}) => {
  const pathname = usePathname();
  const { t, locale } = useTranslation();
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeCapsuleText =
    (t.market as any).timeCapsule ?? DEFAULT_TIME_CAPSULE_TEXT;
  const routeMeta = useMemo(() => getMarketRouteMeta(pathname), [pathname]);
  const buildHref = useCallback(
    (slug: string) => `/market/${slug}${routeMeta.suffix}`,
    [routeMeta.suffix]
  );

  // 当 URL 变化时（Link 客户端导航成功），清除 fallback 定时器
  useEffect(() => {
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, [pathname]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    };
  }, []);

  /**
   * 混合导航：Link 做客户端跳转，若 RSC 长时间无响应则降级到 window.location.href。
   * 若目标 slug 与当前路径相同，不设置 fallback（避免对同页面触发硬刷新）。
   */
  const handleNavClick = useCallback(
    (slug: string) => {
      setShowPast(false);
      setShowMore(false);

      // 目标与当前页面相同，直接返回，不设置 fallback 定时器
      if (routeMeta.slug === slug) return;

      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    },
    [routeMeta.slug]
  );
  // 1. 判断是否需要显示组件
  const matchedFreqSlug = useMemo(() => {
    if (!tags || tags.length === 0) return null;
    if (!needTimeTagTags || needTimeTagTags.length === 0) return null;
    const found = tags.find((tag) => needTimeTagTags.includes(tag.slug));
    return found ? found.slug : null;
  }, [needTimeTagTags, tags]);

  // 2. 接口数据
  // 将 tags 序列化为稳定 key，防止父组件每次渲染产生新引用导致重复请求
  const tagsKey = useMemo(
    () => JSON.stringify((tags ?? []).map((t) => t.slug).sort()),
    [tags]
  );

  // SWR key：matchedFreqSlug 或 tags 为空时传 null，SWR 跳过请求
  // 同一 key 在 dedupingInterval（5 分钟）内跨组件挂载只发起一次网络请求
  // 同一币种的不同市场切换时 tagsKey 不变，直接命中内存缓存，无额外请求
  const swrKey =
    matchedFreqSlug && tags && tags.length > 0
      ? `crypto-end-dates:${tagsKey}`
      : null;

  const {
    data: allEndDates = [],
    isLoading: loading,
    isValidating,
    mutate: revalidateEndDates,
  } = useSWR(
    swrKey,
    endDatesFetcher,
    {
      dedupingInterval: 5 * 60 * 1000, // 5 分钟内相同 key 不重复发请求
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  // 使用 ref 存储当前时间，避免触发重新渲染
  const currentTimeRef = useRef(Date.now());
  const exhaustedRevalidateAtRef = useRef(0);
  const exhaustedRevalidateInFlightRef = useRef(false);

  // liveSlug 作为 state，仅在其值真正变化时才触发重渲染（而非每秒无条件渲染）
  const [liveSlug, setLiveSlug] = useState("");

  useEffect(() => {
    exhaustedRevalidateAtRef.current = 0;
    exhaustedRevalidateInFlightRef.current = false;
  }, [swrKey]);

  // liveSlug 变化时通知父组件，用于 LivePriceHeader 的"Go to live market"跳转
  useEffect(() => {
    onLiveSlugChange?.(liveSlug);
  }, [liveSlug, onLiveSlugChange]);

  // 按当前 URL 中的币种前缀过滤数据（700 条 → ~175 条）
  // pathname 变化时自动重新过滤，无需重新请求接口
  const endDates = useMemo(() => {
    if (allEndDates.length === 0) return [];
    // 从 pathname 提取币种前缀：/market/btc-updown-5m-xxx → "btc"
    const coinPrefix = routeMeta.slug.split("-")[0]?.toLowerCase();
    if (!coinPrefix) return allEndDates;
    return allEndDates.filter((item) => item.slug.startsWith(coinPrefix + "-"));
  }, [allEndDates, routeMeta.slug]);

  const maybeRevalidateExhaustedEndDates = useCallback(
    (dates: CryptoEndDateItem[], now: number) => {
      const currentEventEnd = Number(eventEndDate);
      if (!swrKey || !Number.isFinite(currentEventEnd)) return;
      if (now < currentEventEnd) return;
      if (loading || isValidating) return;
      if (exhaustedRevalidateInFlightRef.current) return;

      const hasFutureItem = dates.some((item) => Number(item.endDate) > now);
      if (hasFutureItem) return;

      if (
        now - exhaustedRevalidateAtRef.current <
        END_DATES_EXHAUSTED_REVALIDATE_COOLDOWN_MS
      ) {
        return;
      }

      exhaustedRevalidateAtRef.current = now;
      exhaustedRevalidateInFlightRef.current = true;
      void revalidateEndDates().finally(() => {
        exhaustedRevalidateInFlightRef.current = false;
      });
    },
    [eventEndDate, isValidating, loading, revalidateEndDates, swrKey]
  );

  // 定时器：每秒刷新 currentTimeRef，并在 liveSlug 发生变化时才 setState
  // 这样仅当 LIVE 状态切换时才触发重渲染，避免每秒无条件重渲染
  useEffect(() => {
    const syncLiveSlug = () => {
      const now = Date.now();
      currentTimeRef.current = now;
      const liveItem = endDates.find((item) => Number(item.endDate) > now);
      const next = liveItem?.slug ?? "";
      setLiveSlug((prev) => (prev !== next ? next : prev));
      maybeRevalidateExhaustedEndDates(endDates, now);
    };

    const timer = setInterval(() => {
      syncLiveSlug();
    }, 1000);

    // 首次同步初始化（endDates 加载后立即计算）
    syncLiveSlug();

    return () => clearInterval(timer);
  }, [endDates, maybeRevalidateExhaustedEndDates]);

  // 3. 数据分区：Past / Capsules(中间含已结束) / More + LIVE 标识
  // 分区逻辑不依赖 currentTime，避免每秒重新计算
  const { pastItems, capsuleItems, moreItems, activeSlug } = useMemo(() => {
    if (endDates.length === 0) {
      return {
        pastItems: [],
        capsuleItems: [],
        moreItems: [],
        activeSlug: "",
      };
    }

    // 找到当前事件匹配的项（用于确认 activeSlug）
    let currentIdx = -1;
    if (eventEndDate) {
      currentIdx = endDates.findIndex(
        (item) => Number(item.endDate) === Number(eventEndDate)
      );
    }

    // 找到 endDates 中第一个未结束（endDate >= currentTime）的索引
    const firstFutureIdx = endDates.findIndex(
      (item) => Number(item.endDate) >= currentTimeRef.current
    );

    // 分区逻辑：完全基于 firstFutureIdx 和当前时间，页面切换不改变胶囊显示的相对位置
    const pastList: CryptoEndDateItem[] = [];
    const capsuleList: CryptoEndDateItem[] = [];
    const moreList: CryptoEndDateItem[] = [];

    if (firstFutureIdx < 0) {
      // 全部已过期 (没有 future)
      // 向前最多取 4 个放进 capsule
      const capsuleStart = Math.max(0, endDates.length - 4);
      // past 最多保留最近 50 条，避免历史数据过多冻结主线程
      const pastStart = Math.max(0, capsuleStart - 50);
      pastList.push(...endDates.slice(pastStart, capsuleStart));
      capsuleList.push(...endDates.slice(capsuleStart));
    } else {
      // 向前取最多一些结束的放进 capsule（若后面 future 不够则多拿前面凑够最多 4 个）
      const maxBefore = Math.max(2, 4 - (endDates.length - firstFutureIdx));
      const capsuleStart = Math.max(
        0,
        firstFutureIdx - Math.min(maxBefore, firstFutureIdx)
      );

      // capsuleStart 之前的算作 past，最多保留最近 50 条
      const pastStart = Math.max(0, capsuleStart - 50);
      for (let i = pastStart; i < capsuleStart; i++) {
        pastList.push(endDates[i]);
      }

      // 从 capsuleStart 起算最多 4 个进入 capsule
      const capsuleEnd = Math.min(capsuleStart + 4, endDates.length);
      for (let i = capsuleStart; i < capsuleEnd; i++) {
        capsuleList.push(endDates[i]);
      }

      // 剩余的塞入 more，最多保留 30 条（未来事件）
      const moreEnd = Math.min(capsuleEnd + 30, endDates.length);
      for (let i = capsuleEnd; i < moreEnd; i++) {
        moreList.push(endDates[i]);
      }
    }

    const defaultSlug = routeMeta.slug
      ? routeMeta.slug
      : currentIdx >= 0
        ? endDates[currentIdx].slug
        : "";

    return {
      pastItems: pastList,
      capsuleItems: capsuleList,
      moreItems: moreList,
      activeSlug: defaultSlug,
    };
  }, [endDates, eventEndDate, routeMeta.slug]); // 不依赖 currentTime

  // UI 状态（须在 pastLabels/moreLabels 之前声明，以便作为懒加载依赖项）
  const [showPast, setShowPast] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // 预缓存各区域的格式化标签，避免渲染时重复创建 Intl.DateTimeFormat 对象
  const capsuleLabels = useMemo(() => {
    if (!matchedFreqSlug)
      return new Map<string, ReturnType<typeof formatLocalizedEndDateLabel>>();
    return new Map(
      capsuleItems.map((item) => [
        item.slug,
        formatLocalizedEndDateLabel(item.endDate, matchedFreqSlug, locale, false),
      ])
    );
  }, [capsuleItems, locale, matchedFreqSlug]);

  // pastLabels 仅在下拉展开（showPast=true）时才计算，防止初始化时批量实例化 Intl 对象冻结主线程
  const pastLabels = useMemo(() => {
    if (!matchedFreqSlug || !showPast)
      return new Map<string, ReturnType<typeof formatLocalizedEndDateLabel>>();
    return new Map(
      pastItems.map((item) => [
        item.slug,
        formatLocalizedEndDateLabel(item.endDate, matchedFreqSlug, locale, true),
      ])
    );
  }, [locale, matchedFreqSlug, pastItems, showPast]);

  // moreLabels 仅在下拉展开（showMore=true）时才计算
  const moreLabels = useMemo(() => {
    if (!matchedFreqSlug || !showMore)
      return new Map<string, ReturnType<typeof formatLocalizedEndDateLabel>>();
    return new Map(
      moreItems.map((item) => [
        item.slug,
        formatLocalizedEndDateLabel(item.endDate, matchedFreqSlug, locale, true),
      ])
    );
  }, [locale, matchedFreqSlug, moreItems, showMore]);

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setShowPast(false);
        setShowMore(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // 如果没有匹配的频率标签或者无数据，不渲染
  if (!matchedFreqSlug) return null;
  if (loading && endDates.length === 0) return null;
  if (endDates.length === 0) return null;

  return (
    <div
      className="relative z-10 w-full sm:w-auto min-w-0"
      ref={containerRef}
    >
      <div className="w-full sm:w-auto min-w-0 overflow-x-auto sm:overflow-visible scrollbar-hide">
        <div className="flex items-center gap-2 w-max sm:w-auto">
      {/* 1. Past 区域 */}
      {pastItems.length > 0 && (
        <div className="shrink-0">
          <div className="flex items-center bg-[var(--bg-secondary)] rounded-full px-1 py-1 h-8">
            <button
              className="flex items-center gap-1.5 px-3 h-full text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-full transition-colors"
              onClick={() => {
                setShowPast(!showPast);
                setShowMore(false);
              }}
            >
              <span>{t.market.past}</span>
              <div
                className={`transition-transform duration-200 ${
                  showPast ? "rotate-180" : ""
                }`}
              >
                <CaretDownIcon />
              </div>
            </button>
          </div>

          {/* Past 下拉层 */}
          {false && showPast && (
            <div className="absolute top-10 left-0 min-w-[200px] bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl py-2 max-h-[280px] overflow-y-auto scrollbar-hide">
              {pastItems.map((item) => {
                const labelObj = pastLabels.get(item.slug);
                if (!labelObj) return null;
                return (
                  <Link
                    key={item.slug}
                    href={buildHref(item.slug)}
                    className="w-full flex items-center justify-start px-4 py-2 hover:bg-[var(--bg-hover)] transition-colors text-left whitespace-nowrap"
                    onClick={() => handleNavClick(item.slug)}
                  >
                    <div className="flex items-center text-sm">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {labelObj.timeLabel}
                      </span>
                      <span className="font-semibold text-[var(--text-primary)] ml-1">
                        ET
                      </span>
                      {labelObj.relativeDay && (
                        <>
                          <span className="mx-1.5 w-[3px] h-[3px] rounded-full bg-[var(--text-tertiary)] shrink-0"></span>
                          <span className="text-[var(--text-tertiary)] font-medium">
                            {labelObj.relativeDay}
                          </span>
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. 时间胶囊列表（含最近已结束的事件） */}
      <div className="flex items-center gap-2">
        {capsuleItems.map((item) => {
          const isActive = item.slug === activeSlug;
          const isLive = item.slug === liveSlug;
          const labelObj = capsuleLabels.get(item.slug);
          if (!labelObj) return null;

          return (
            <Link
              key={item.slug}
              href={buildHref(item.slug)}
              onClick={() => handleNavClick(item.slug)}
              className={`flex items-center gap-2 h-8 px-4 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-[var(--text-primary)] text-[var(--bg-primary)]"
                  : "bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {isLive && (
                <div className="relative flex items-center justify-center w-3 h-3 shrink-0">
                  <div className="absolute inset-0 rounded-full bg-[#FF453A]/40"></div>
                  <div className="absolute inset-0 rounded-full bg-[#FF453A] animate-ping opacity-75"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF453A] relative z-10"></div>
                </div>
              )}
              {labelObj.fullStr}
            </Link>
          );
        })}
      </div>

      {/* 3. More 区域 */}
      {moreItems.length > 0 && (
        <div className="shrink-0">
          <button
            className="flex items-center gap-1.5 h-8 px-4 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] rounded-full text-sm font-medium text-[var(--text-primary)] transition-colors"
            onClick={() => {
              setShowMore(!showMore);
              setShowPast(false);
            }}
          >
            <span>{timeCapsuleText.more}</span>
            <div
              className={`transition-transform duration-200 ${
                showMore ? "rotate-180" : ""
              }`}
            >
              <CaretDownIcon />
            </div>
          </button>

          {/* More 下拉层 */}
          {false && showMore && (
            <div className="absolute top-10 right-0 min-w-[200px] bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl py-2 max-h-[280px] overflow-y-auto scrollbar-hide">
              {moreItems.map((item) => {
                const labelObj = moreLabels.get(item.slug);
                if (!labelObj) return null;
                return (
                  <Link
                    key={item.slug}
                    href={buildHref(item.slug)}
                    className="w-full flex justify-start px-4 py-2 hover:bg-[var(--bg-hover)] transition-colors text-left whitespace-nowrap"
                    onClick={() => handleNavClick(item.slug)}
                  >
                    <div className="flex items-center text-sm">
                      <span className="font-semibold text-[var(--text-primary)]">
                        {labelObj.timeLabel}
                      </span>
                      <span className="font-semibold text-[var(--text-primary)] ml-1">
                        ET
                      </span>
                      {labelObj.relativeDay && (
                        <>
                          <span className="mx-1.5 w-[3px] h-[3px] rounded-full bg-[var(--text-tertiary)] shrink-0"></span>
                          <span className="text-[var(--text-tertiary)] font-medium">
                            {labelObj.relativeDay}
                          </span>
                        </>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
        </div>
      </div>
      {showPast && (
        <div className="absolute top-[calc(100%+8px)] left-0 z-30 w-max min-w-[200px] max-w-[calc(100vw-32px)] sm:top-10 sm:left-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl py-2 max-h-[280px] overflow-y-auto scrollbar-hide">
          {pastItems.map((item) => {
            const labelObj = pastLabels.get(item.slug);
            if (!labelObj) return null;
            return (
              <Link
                key={item.slug}
                href={buildHref(item.slug)}
                className="w-full flex items-center justify-start px-4 py-2 hover:bg-[var(--bg-hover)] transition-colors text-left whitespace-nowrap"
                onClick={() => handleNavClick(item.slug)}
              >
                <div className="flex items-center text-sm">
                  <span className="font-semibold text-[var(--text-primary)]">
                    {labelObj.timeLabel}
                  </span>
                  <span className="font-semibold text-[var(--text-primary)] ml-1">
                    ET
                  </span>
                  {labelObj.relativeDay && (
                    <>
                      <span className="mx-1.5 w-[3px] h-[3px] rounded-full bg-[var(--text-tertiary)] shrink-0"></span>
                      <span className="text-[var(--text-tertiary)] font-medium">
                        {labelObj.relativeDay}
                      </span>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      {showMore && (
        <div className="absolute top-[calc(100%+8px)] right-0 z-30 w-max min-w-[200px] max-w-[calc(100vw-32px)] sm:top-10 sm:right-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl py-2 max-h-[280px] overflow-y-auto scrollbar-hide">
          {moreItems.map((item) => {
            const labelObj = moreLabels.get(item.slug);
            if (!labelObj) return null;
            return (
              <Link
                key={item.slug}
                href={buildHref(item.slug)}
                className="w-full flex justify-start px-4 py-2 hover:bg-[var(--bg-hover)] transition-colors text-left whitespace-nowrap"
                onClick={() => handleNavClick(item.slug)}
              >
                <div className="flex items-center text-sm">
                  <span className="font-semibold text-[var(--text-primary)]">
                    {labelObj.timeLabel}
                  </span>
                  <span className="font-semibold text-[var(--text-primary)] ml-1">
                    ET
                  </span>
                  {labelObj.relativeDay && (
                    <>
                      <span className="mx-1.5 w-[3px] h-[3px] rounded-full bg-[var(--text-tertiary)] shrink-0"></span>
                      <span className="text-[var(--text-tertiary)] font-medium">
                        {labelObj.relativeDay}
                      </span>
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TimeCapsule;
