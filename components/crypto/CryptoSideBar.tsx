import React, { useEffect, useMemo } from "react";
import FilterSidebar, {
  FilterGroup,
  FilterItem,
  FilterSidebarStyles,
} from "../common/FilterSidebar";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import { TagTreeNode } from "@/types/home";
import useTagTree from "@/lib/hooks/useTagTree";

import { getCryptoSidebarIcon } from "./CryptoSideBarIcons";

interface CryptoSideBarProps {
  selectedId?: string;
  onItemClick?: (id: string) => void;
  onTagsLoaded?: (tags: TagTreeNode[]) => void;
  initialTags?: TagTreeNode[];
}

const CryptoSideBar: React.FC<CryptoSideBarProps> = ({
  selectedId = "All",
  onItemClick,
  initialTags,
  onTagsLoaded,
}) => {
  // 标签树走 SWR(缓存+保鲜):切回侧栏秒返、不卡骨架,后台自动刷新保持相对实时。
  const { tags: assetTags, isLoading: isLoadingTags } = useTagTree({
    slug: "crypto",
    initialTags,
  });

  // 标签就绪即通知父级(驱动默认选中 / cryptoTagsReady)。回调幂等,重复调用无害。
  useEffect(() => {
    if (assetTags.length > 0) onTagsLoaded?.(assetTags);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetTags]);

  const { frequencyItems, assetItems } = useMemo(() => {
    const freqs: FilterItem[] = [];
    const assets: FilterItem[] = [];

    assetTags.forEach((tag) => {
      const icon = getCryptoSidebarIcon(tag.slug);

      const item: FilterItem = {
        id: tag.slug,
        label: tag.name,
        count: tag.count ? Number(tag.count) : undefined,
        icon,
      };

      if (tag.type === "ASSET" || tag.type === "ORGANIZATION") {
        assets.push(item);
      } else {
        freqs.push(item);
      }
    });

    return { frequencyItems: freqs, assetItems: assets };
  }, [assetTags]);

  const filterGroups: FilterGroup[] = useMemo(() => {
    const groups: FilterGroup[] = [
      {
        items: frequencyItems,
        showDivider: true,
      },
    ];

    if (assetItems.length > 0) {
      groups.push({
        items: assetItems,
        showDivider: false,
      });
    }

    return groups;
  }, [frequencyItems, assetItems]);

  const handleItemClick = (id: string) => {
    onItemClick?.(id);
  };

  const mobileIconOnlyStyles: FilterSidebarStyles = useMemo(
    () => ({
      mobileScrollContainer:
        "flex overflow-x-auto py-2 px-4 gap-2 items-center scrollbar-hide",
      mobileButton:
        "flex items-center justify-center w-[38px] h-[38px] min-w-[38px] rounded-lg border border-(--border) transition-all shrink-0",
      mobileButtonActive: "bg-(--accent) border-(--accent) text-(--bg-primary)",
      mobileButtonHover: "hover:bg-(--bg-secondary)",
      mobileIcon: "w-5 h-5",
      mobileImageIcon: "w-5 h-5 rounded-full object-contain",
      mobileLabel: "sr-only",
      mobileDivider: "w-px h-6 bg-(--border) self-center mx-1 shrink-0",
    }),
    []
  );

  if (isLoadingTags) {
    return (
      <>
        <aside className="hidden lg:flex flex-col w-[260px] p-4 gap-4 bg-(--bg-primary) border-(--border) overflow-y-auto h-[calc(100vh-120px)] sticky top-[120px] scrollbar-hide">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`crypto-sidebar-freq-skeleton-${idx}`}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="w-5 h-5 rounded" />
                  <Skeleton className="h-4 w-20 rounded" />
                </div>
                <Skeleton className="h-3 w-6 rounded" />
              </div>
            ))}
          </div>

          <div className="h-px bg-(--border) mx-1 my-2 shrink-0" />

          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={`crypto-sidebar-asset-skeleton-${idx}`}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="w-5 h-5 rounded-full" />
                  <Skeleton className="h-4 w-16 rounded" />
                </div>
                <Skeleton className="h-3 w-6 rounded" />
              </div>
            ))}
          </div>
        </aside>

        <div className="lg:hidden w-full bg-(--bg-primary) border-b border-(--border)">
          <div className="flex overflow-x-auto py-2 px-4 gap-2 scrollbar-hide">
            {Array.from({ length: 8 }).map((_, idx) => (
              <Skeleton
                key={`crypto-sidebar-mobile-skeleton-${idx}`}
                className="w-[38px] h-[38px] min-w-[38px] rounded-lg"
              />
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <FilterSidebar
      groups={filterGroups}
      selectedId={selectedId}
      onItemClick={handleItemClick}
      styles={mobileIconOnlyStyles}
    />
  );
};

export default CryptoSideBar;
