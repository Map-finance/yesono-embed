import React, { useEffect, useMemo, useState } from "react";
import FilterSidebar, {
  FilterGroup,
  FilterItem,
  FilterSidebarStyles,
} from "../common/FilterSidebar";
import { useLocale } from "@/lib/i18n";
import { TagTreeNode } from "@/types/home";
import { getTagTree } from "@/lib/services/homeService";

import { CRYPTO_SIDEBAR_ICONS } from "./CryptoSideBarIcons";

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
  const { locale } = useLocale();
  const [assetTags, setAssetTags] = useState<TagTreeNode[]>(initialTags ?? []);
  const [isLoadingTags, setIsLoadingTags] = useState<boolean>(!(initialTags && initialTags.length > 0));


  useEffect(() => {
    let isMounted = true;

    const run = async () => {
      // 有初始数据：先渲染初始数据，不展示 loading，然后在后台尝试刷新以保证数据新鲜
      if (initialTags && initialTags.length > 0) {
        setAssetTags(initialTags);
        setIsLoadingTags(false);
        onTagsLoaded?.(initialTags);

        try {
          const tags = await getTagTree("crypto");
          if (!isMounted) return;
          // 仅在不同的情况下替换，以避免闪烁
          const same =
            Array.isArray(tags) &&
            tags.length === initialTags.length &&
            JSON.stringify(tags) === JSON.stringify(initialTags);
          if (!same) {
            setAssetTags(tags);
            onTagsLoaded?.(tags);
          }
        } catch (error) {
          // 后台刷新失败时只记录日志，不影响当前 UI
          console.error("[CryptoSideBar] background refresh failed:", error);
        }
      } else {
        // 无初始数据：展示 loading 并正式拉取数据
        setIsLoadingTags(true);
        try {
          const tags = await getTagTree("crypto");
          if (!isMounted) return;
          setAssetTags(tags);
          onTagsLoaded?.(tags);
        } catch (error) {
          console.error("[CryptoSideBar] Failed to load crypto tags:", error);
          if (!isMounted) return;
          setAssetTags([]);
          onTagsLoaded?.([]);
        } finally {
          if (isMounted) setIsLoadingTags(false);
        }
      }
    };

    run();

    return () => {
      isMounted = false;
    };
    // 依赖 locale 以便语言变化时刷新；依赖 initialTags 以响应外部注入的数据变化
  }, [locale, initialTags]);

  const { frequencyItems, assetItems } = useMemo(() => {
    const freqs: FilterItem[] = [];
    const assets: FilterItem[] = [];

    assetTags.forEach((tag) => {
      const lowerSlug = tag.slug ? tag.slug.toLowerCase() : "";
      const icon =
        CRYPTO_SIDEBAR_ICONS[lowerSlug] || CRYPTO_SIDEBAR_ICONS[tag.slug];

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
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={`crypto-sidebar-freq-skeleton-${idx}`}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-(--bg-secondary) animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded bg-(--bg-primary)" />
                  <div className="h-4 w-20 rounded bg-(--bg-primary)" />
                </div>
                <div className="h-3 w-6 rounded bg-(--bg-primary)" />
              </div>
            ))}
          </div>

          <div className="h-px bg-(--border) mx-1 my-2 shrink-0" />

          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={`crypto-sidebar-asset-skeleton-${idx}`}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-(--bg-secondary) animate-pulse"
              >
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-(--bg-primary)" />
                  <div className="h-4 w-16 rounded bg-(--bg-primary)" />
                </div>
                <div className="h-3 w-6 rounded bg-(--bg-primary)" />
              </div>
            ))}
          </div>
        </aside>

        <div className="lg:hidden w-full bg-(--bg-primary) border-b border-(--border)">
          <div className="flex overflow-x-auto py-2 px-4 gap-2 scrollbar-hide">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={`crypto-sidebar-mobile-skeleton-${idx}`}
                className="w-[38px] h-[38px] min-w-[38px] rounded-lg bg-(--bg-secondary) animate-pulse"
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
