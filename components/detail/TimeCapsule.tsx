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
import { Popover } from "@/components/ui/Popover";
import CapsuleTooltip from "./CapsuleTooltip";
import { useTranslation } from "@/lib/i18n";
import {
  getCryptoEndDates,
  getFinanceEndDates,
  CryptoEndDateItem,
} from "@/lib/services/homeService";
import {
  DEFAULT_TIME_CAPSULE_TEXT,
  getMarketRouteMeta,
  formatLocalizedEndDateLabel,
} from "./TimeCapsule.format";
import CaretDownIcon from "./CaretDownIcon";

const CRYPTO_END_DATES_PREFIX = "crypto-end-dates:";
const FINANCE_END_DATES_PREFIX = "finance-end-dates:";

/**
 * SWR fetcher：key 格式为 "<crypto|finance>-end-dates:<sorted-slugs-json>"
 * 模块级缓存保证同一 key 在 5 分钟内跨组件挂载只发起一次网络请求。
 * 金融事件走 /api/finance/end-dates，加密走 /api/crypto/end-dates。
 */
async function endDatesFetcher(key: string): Promise<CryptoEndDateItem[]> {
  const isFinance = key.startsWith(FINANCE_END_DATES_PREFIX);
  const prefix = isFinance ? FINANCE_END_DATES_PREFIX : CRYPTO_END_DATES_PREFIX;
  const slugs = JSON.parse(key.slice(prefix.length)) as string[];
  if (!slugs.length) return [];
  return isFinance ? getFinanceEndDates(slugs) : getCryptoEndDates(slugs);
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
  /** 金融事件：走 /api/finance/end-dates 且不套用按币种 slug 前缀的过滤 */
  isFinance?: boolean;
}

// ============== 主组件 ==============

const TimeCapsule: React.FC<TimeCapsuleProps> = ({
  tags,
  needTimeTagTags,
  eventEndDate,
  isFinance = false,
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
      ? `${
          isFinance ? FINANCE_END_DATES_PREFIX : CRYPTO_END_DATES_PREFIX
        }${tagsKey}`
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

  // /api/{crypto,finance}/end-dates 已按事件 tag 过滤到当前币种/系列，
  // 前端无需再按 URL slug 前缀二次过滤（曾因 slug 解析对金融市场误删）
  const endDates = allEndDates;

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
          <div className="flex items-center bg-(--bg-secondary) rounded-full px-1 py-1 h-8">
            <button
              className="flex items-center gap-1.5 px-3 h-full text-sm font-medium text-(--text-primary) hover:bg-(--bg-hover) rounded-full transition-colors"
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
            <div className="absolute top-10 left-0 min-w-[200px] bg-(--bg-card) border border-(--border) rounded-xl shadow-xl py-2 max-h-[280px] overflow-y-auto scrollbar-hide">
              {pastItems.map((item) => {
                const labelObj = pastLabels.get(item.slug);
                if (!labelObj) return null;
                return (
                  <Link
                    key={item.slug}
                    href={buildHref(item.slug)}
                    className="w-full flex items-center justify-start px-4 py-2 hover:bg-(--bg-hover) transition-colors text-left whitespace-nowrap"
                    onClick={() => handleNavClick(item.slug)}
                  >
                    <div className="flex items-center text-sm">
                      <span className="font-semibold text-(--text-primary)">
                        {labelObj.timeLabel}
                      </span>
                      <span className="font-semibold text-(--text-primary) ml-1">
                        ET
                      </span>
                      {labelObj.relativeDay && (
                        <>
                          <span className="mx-1.5 w-[3px] h-[3px] rounded-full bg-(--text-tertiary) shrink-0"></span>
                          <span className="text-(--text-tertiary) font-medium">
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
            <Popover
              key={item.slug}
              trigger="hover"
              placement="top"
              className="shrink-0"
              content={() => {
                const nowMs = Date.now();
                return (
                  <CapsuleTooltip
                    endDate={item.endDate}
                    isLive={isLive}
                    isEnded={Number(item.endDate) < nowMs}
                    currentTime={nowMs}
                  />
                );
              }}
            >
              <Link
                href={buildHref(item.slug)}
                onClick={() => handleNavClick(item.slug)}
                className={`flex items-center gap-2 h-8 px-4 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-(--text-primary) text-(--bg-primary)"
                    : "bg-(--bg-secondary) text-(--text-primary) hover:bg-(--bg-hover)"
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
            </Popover>
          );
        })}
      </div>

      {/* 3. More 区域 */}
      {moreItems.length > 0 && (
        <div className="shrink-0">
          <button
            className="flex items-center gap-1.5 h-8 px-4 bg-(--bg-secondary) hover:bg-(--bg-hover) rounded-full text-sm font-medium text-(--text-primary) transition-colors"
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
            <div className="absolute top-10 right-0 min-w-[200px] bg-(--bg-card) border border-(--border) rounded-xl shadow-xl py-2 max-h-[280px] overflow-y-auto scrollbar-hide">
              {moreItems.map((item) => {
                const labelObj = moreLabels.get(item.slug);
                if (!labelObj) return null;
                return (
                  <Link
                    key={item.slug}
                    href={buildHref(item.slug)}
                    className="w-full flex justify-start px-4 py-2 hover:bg-(--bg-hover) transition-colors text-left whitespace-nowrap"
                    onClick={() => handleNavClick(item.slug)}
                  >
                    <div className="flex items-center text-sm">
                      <span className="font-semibold text-(--text-primary)">
                        {labelObj.timeLabel}
                      </span>
                      <span className="font-semibold text-(--text-primary) ml-1">
                        ET
                      </span>
                      {labelObj.relativeDay && (
                        <>
                          <span className="mx-1.5 w-[3px] h-[3px] rounded-full bg-(--text-tertiary) shrink-0"></span>
                          <span className="text-(--text-tertiary) font-medium">
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
        <div className="absolute top-[calc(100%+8px)] left-0 z-30 w-max min-w-[200px] max-w-[calc(100vw-32px)] sm:top-10 sm:left-0 bg-(--bg-card) border border-(--border) rounded-xl shadow-xl py-2 max-h-[280px] overflow-y-auto scrollbar-hide">
          {pastItems.map((item) => {
            const labelObj = pastLabels.get(item.slug);
            if (!labelObj) return null;
            return (
              <Link
                key={item.slug}
                href={buildHref(item.slug)}
                className="w-full flex items-center justify-start px-4 py-2 hover:bg-(--bg-hover) transition-colors text-left whitespace-nowrap"
                onClick={() => handleNavClick(item.slug)}
              >
                <div className="flex items-center text-sm">
                  <span className="font-semibold text-(--text-primary)">
                    {labelObj.timeLabel}
                  </span>
                  <span className="font-semibold text-(--text-primary) ml-1">
                    ET
                  </span>
                  {labelObj.relativeDay && (
                    <>
                      <span className="mx-1.5 w-[3px] h-[3px] rounded-full bg-(--text-tertiary) shrink-0"></span>
                      <span className="text-(--text-tertiary) font-medium">
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
        <div className="absolute top-[calc(100%+8px)] right-0 z-30 w-max min-w-[200px] max-w-[calc(100vw-32px)] sm:top-10 sm:right-0 bg-(--bg-card) border border-(--border) rounded-xl shadow-xl py-2 max-h-[280px] overflow-y-auto scrollbar-hide">
          {moreItems.map((item) => {
            const labelObj = moreLabels.get(item.slug);
            if (!labelObj) return null;
            return (
              <Link
                key={item.slug}
                href={buildHref(item.slug)}
                className="w-full flex justify-start px-4 py-2 hover:bg-(--bg-hover) transition-colors text-left whitespace-nowrap"
                onClick={() => handleNavClick(item.slug)}
              >
                <div className="flex items-center text-sm">
                  <span className="font-semibold text-(--text-primary)">
                    {labelObj.timeLabel}
                  </span>
                  <span className="font-semibold text-(--text-primary) ml-1">
                    ET
                  </span>
                  {labelObj.relativeDay && (
                    <>
                      <span className="mx-1.5 w-[3px] h-[3px] rounded-full bg-(--text-tertiary) shrink-0"></span>
                      <span className="text-(--text-tertiary) font-medium">
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
