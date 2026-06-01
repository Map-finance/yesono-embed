import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FilterSidebar, {
  FilterGroup,
  FilterItem,
} from "../common/FilterSidebar";
import { useLocale } from "@/lib/i18n";
import { TagTreeNode } from "@/types/home";
import {
  getTagTree,
  getFinanceEndDates,
  CryptoEndDateItem,
} from "@/lib/services/homeService";
// 频率图标(5M/15M/1H/4h/daily… + 任意 N分钟/N小时 兜底)是 crypto / finance 通用的,直接复用
import { getCryptoSidebarIcon } from "@/components/crypto/CryptoSideBarIcons";

interface FinanceSideBarProps {
  selectedId?: string;
  onItemClick?: (id: string) => void;
  onTagsLoaded?: (tags: TagTreeNode[]) => void;
}

/**
 * 格式化 endDate 为可读时间标签：当天显示 hh:mm AM/PM；非当天加 "Mon DD"
 */
function formatEndDateLabel(endDate: number): string {
  const d = new Date(endDate);
  const now = new Date();
  const isToday =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) return time;

  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  return `${month} ${day} ${time}`;
}

/** 用于区分 tag 和 endDate slug 的前缀 */
const END_DATE_PREFIX = "__enddate__";

const FinanceSideBar: React.FC<FinanceSideBarProps> = ({
  selectedId = "",
  onItemClick,
  onTagsLoaded,
}) => {
  const { locale } = useLocale();
  const router = useRouter();
  const [financeTags, setFinanceTags] = useState<TagTreeNode[]>([]);
  const [endDateItems, setEndDateItems] = useState<CryptoEndDateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 加载 finance 标签树 + end dates
  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      setIsLoading(true);
      try {
        const tags = await getTagTree("finance");
        if (!isMounted) return;
        setFinanceTags(tags);
        onTagsLoaded?.(tags);

        // 获取 end dates
        if (tags.length > 0) {
          const tagSlugs = tags.map((t) => t.slug);
          const dates = await getFinanceEndDates(tagSlugs);
          if (isMounted) setEndDateItems(dates);
        }
      } catch (error) {
        console.error("[FinanceSideBar] Failed to load:", error);
        if (isMounted) {
          setFinanceTags([]);
          onTagsLoaded?.([]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    run();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  const { tagItems, dateItems } = useMemo(() => {
    const tItems: FilterItem[] = financeTags.map((tag) => ({
      id: tag.slug,
      label: tag.name,
      count: tag.count ? Number(tag.count) : undefined,
      icon: getCryptoSidebarIcon(tag.slug),
    }));

    const dItems: FilterItem[] = endDateItems.map((item) => ({
      id: `${END_DATE_PREFIX}${item.slug}`,
      label: formatEndDateLabel(item.endDate),
    }));

    return { tagItems: tItems, dateItems: dItems };
  }, [financeTags, endDateItems]);

  const filterGroups: FilterGroup[] = useMemo(() => {
    const groups: FilterGroup[] = [];

    if (tagItems.length > 0) {
      groups.push({ items: tagItems, showDivider: dateItems.length > 0 });
    }

    if (dateItems.length > 0) {
      groups.push({ items: dateItems, showDivider: false });
    }

    return groups;
  }, [tagItems, dateItems]);

  const handleItemClick = (id: string) => {
    // end-date 项 → 直接跳市场详情
    if (id.startsWith(END_DATE_PREFIX)) {
      const slug = id.slice(END_DATE_PREFIX.length);
      router.push(`/market/${slug}`);
      return;
    }
    // tag 项 → 通知父组件刷新事件列表
    onItemClick?.(id);
  };

  if (isLoading) {
    return (
      <>
        <aside className="hidden lg:flex flex-col w-[260px] p-4 gap-4 bg-(--bg-primary) border-(--border) overflow-y-auto h-[calc(100vh-120px)] sticky top-[120px] scrollbar-hide">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`finance-skeleton-${idx}`}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-(--bg-secondary) animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded bg-(--bg-primary)" />
                  <div className="w-20 h-4 rounded bg-(--bg-primary)" />
                </div>
              </div>
            ))}
          </div>
        </aside>
        <div className="lg:hidden flex overflow-x-auto py-2 px-4 gap-2 items-center scrollbar-hide border-b border-(--border)">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={`finance-mobile-skeleton-${idx}`}
              className="w-20 h-8 rounded-lg bg-(--bg-secondary) animate-pulse shrink-0"
            />
          ))}
        </div>
      </>
    );
  }

  return (
    <FilterSidebar
      groups={filterGroups}
      selectedId={selectedId}
      onItemClick={handleItemClick}
    />
  );
};

export default FinanceSideBar;
