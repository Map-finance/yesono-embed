"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Market } from "@/types/types";
import FilterBarSimple from "@/components/FilterBarSimple";
import MarketGrid from "@/components/MarketGrid";
import CryptoSideBar from "@/components/crypto/CryptoSideBar";
import FinanceSideBar from "@/components/finance/FinanceSideBar";
import { useEvents } from "@/lib/hooks/useEvents";
import { eventsToMarkets } from "@/lib/utils/eventToMarket";
import { useTranslation } from "@/lib/i18n";
import { TagTreeNode } from "@/types/home";
import useTagTree from "@/lib/hooks/useTagTree";
import { trackEvent } from "@/lib/sentryClient";

interface Props {
  initialTags?: TagTreeNode[];
  initialData?: any;
}

// 虚拟分类：不是真实 tag slug
const VIRTUAL_CATEGORIES = ["trending", "new"];
// 顶部导航栏分类：使用 category 参数而非 tag_slug
const NAV_CATEGORIES = [
  "politics",
  "sports",
  "finance",
  "geopolitics",
  "tech",
  "culture",
  "world",
  "economy",
  "trump",
];

export default function TrendingClient({ initialTags, initialData }: Props) {
  const { t } = useTranslation();
  const params = useParams();

  // 选中的子标签 slug（用于筛选）
  const [selectedTagSlug, setSelectedTagSlug] = useState<string | null>(null);

  // FilterBar 高级筛选状态
  const [searchQ, setSearchQ] = useState("");
  const [sortOrder, setSortOrder] = useState("");
  const [filterFrequency, setFilterFrequency] = useState("");
  const [filterActive, setFilterActive] = useState(true);
  const [filterCollected, setFilterCollected] = useState(false);

  // Crypto sidebar 选中的资产
  const [selectedCryptoAsset, setSelectedCryptoAsset] = useState("All");
  // crypto 页面：侧边栏标签加载完成并完成初始选中后才允许 useEvents 发起请求
  const [cryptoTagsReady, setCryptoTagsReady] = useState(false);

  // Finance sidebar 选中的项 + 标签就绪标志
  const [selectedFinanceItem, setSelectedFinanceItem] = useState<string | null>(null);
  const [financeTagsReady, setFinanceTagsReady] = useState(false);

  // 从路由参数获取主分类
  const categoryParam = params?.category;
  let category: string = "trending";

  if (categoryParam) {
    if (Array.isArray(categoryParam)) {
      category = categoryParam[0] || "trending";
    } else if (typeof categoryParam === "string") {
      category = categoryParam;
    }
  }

  const lowerCategory = category.toLowerCase();
  const isTrendingOrNew = VIRTUAL_CATEGORIES.includes(lowerCategory);
  const isNavCategory = NAV_CATEGORIES.includes(lowerCategory);
  const isCrypto = lowerCategory === "crypto";
  const isFinance = lowerCategory === "finance";

  const { tags } = useTagTree({
    slug: isTrendingOrNew ? undefined : isCrypto ? "crypto" : isFinance ? "finance" : lowerCategory,
    category: isTrendingOrNew ? lowerCategory : undefined,
    withCount: true,
    enabled: !isCrypto && !isFinance,
    initialTags: initialTags,
  });

  // 如果页面是 crypto 并且服务端注入了标签，则使用 initialTags 做相同的预置/解锁逻辑
  useEffect(() => {
    if (isCrypto && initialTags && initialTags.length > 0) {
      setSelectedCryptoAsset(initialTags[0].slug);
      setCryptoTagsReady(true);
    }
  }, [isCrypto, initialTags]);

  // 从标签生成分类列表（用于筛选栏显示）
  const categoriesList = useMemo(() => {
    if (isCrypto || isFinance) return [t.common.all];
    return [t.common.all, ...tags.map((tag) => tag.name)];
  }, [tags, isCrypto, isFinance, t]);

  // 根据选中的子标签名称查找对应的 slug
  const selectedCategory = useMemo(() => {
    if (!selectedTagSlug) return t.common.all;
    const tag = tags.find((t) => t.slug === selectedTagSlug);
    return tag?.name || t.common.all;
  }, [selectedTagSlug, tags, t]);

  // 构建事件查询参数
  const eventsQuery = useMemo(() => {
    const base: Record<string, any> = { active: filterActive, limit: 20 };

    // 收藏筛选
    if (filterCollected) base.collected = true;

    // 搜索
    if (searchQ) base.q = searchQ;

    // 排序（来自 FilterBar 高级筛选）
    if (sortOrder) {
      base.order = sortOrder;
    }

    if (isCrypto) {
      base.apiType = "crypto";
      base.cryptoSlug =
        selectedCryptoAsset && selectedCryptoAsset !== "All"
          ? selectedCryptoAsset
          : "crypto";
      trackEvent("market_filter_apply", { filter_type: "category", filter_value: base.cryptoSlug });
      if (searchQ) base.cryptoSearchText = searchQ;
      if (sortOrder) {
        const prefix = sortOrder.charAt(0);
        const field = sortOrder.slice(1);
        base.cryptoOrderBy = field;
        base.cryptoAscending = prefix === "+";
      }
    } else if (isFinance) {
      base.apiType = "finance";
      base.financeSlug =
        selectedFinanceItem && selectedFinanceItem !== "All"
          ? selectedFinanceItem
          : "finance";
      trackEvent("market_filter_apply", { filter_type: "category", filter_value: base.financeSlug });
      if (searchQ) base.financeSearchText = searchQ;
      if (sortOrder) {
        const prefix = sortOrder.charAt(0);
        const field = sortOrder.slice(1);
        base.financeOrderBy = field;
        base.financeAscending = prefix === "+";
      }
    } else if (selectedTagSlug) {
      base.tag_slug = selectedTagSlug;
    } else if (lowerCategory === "trending") {
      if (!sortOrder) {
        base.order = "-volume";
      }
    } else if (lowerCategory === "new") {
      if (!sortOrder) {
        base.order = "+startdate";
      }
    } else if (isNavCategory) {
      base.category = lowerCategory;
    } else {
      base.tag_slug = lowerCategory;
    }
    return base;
  }, [
    category,
    lowerCategory,
    selectedTagSlug,
    isCrypto,
    isFinance,
    isNavCategory,
    selectedCryptoAsset,
    selectedFinanceItem,
    filterFrequency,
    searchQ,
    sortOrder,
    filterActive,
    filterCollected,
  ]);

  // 获取事件列表
  const enableEvents = isCrypto ? cryptoTagsReady : isFinance ? financeTagsReady : true;
  const { events, isLoading, hasMore, loadMore, isLoadingMore, refresh } =
    useEvents({ ...eventsQuery, enabled: enableEvents, initialData });

  // 将事件转换为 Market 类型以兼容现有组件
  const markets: Market[] = useMemo(() => {
    return eventsToMarkets(events);
  }, [events]);

  const isCryptoBooting = isCrypto && !cryptoTagsReady;
  const isFinanceBooting = isFinance && !financeTagsReady;
  const hasSidebar = isCrypto || isFinance;
  const showSidebarSkeleton =
    hasSidebar && (isCryptoBooting || isFinanceBooting || isLoading) && markets.length === 0;

  // 处理子标签切换（用于筛选事件列表）
  const handleCategoryChange = useCallback(
    (newCategory: string) => {
      if (newCategory === t.common.all || newCategory === "All") {
        setSelectedTagSlug(null);
      } else {
        const tag = tags.find((t) => t.name === newCategory);
        setSelectedTagSlug(tag?.slug || null);
      }
    },
    [tags]
  );

  // FilterBar 回调
  const handleSearchChange = useCallback((q: string) => setSearchQ(q), []);
  const handleSortChange = useCallback((order: string) => {
    setSortOrder(order);
  }, []);
  const handleFrequencyChange = useCallback(
    (freq: string) => setFilterFrequency(freq),
    []
  );
  const handleActiveChange = useCallback(
    (active: boolean) => setFilterActive(active),
    []
  );

  const handleCollectedChange = useCallback(
    (collected: boolean) => setFilterCollected(collected),
    []
  );

  // Crypto sidebar 回调
  const handleCryptoSidebarClick = useCallback((id: string) => {
    setSelectedCryptoAsset(id);
  }, []);

  // 当 crypto 资产标签加载完成时，默认选中第一个，然后解锁 useEvents
  const handleCryptoTagsLoaded = useCallback(
    (tags: any[]) => {
      if (tags.length > 0 && selectedCryptoAsset === "All") {
        setSelectedCryptoAsset(tags[0].slug);
      }
      setCryptoTagsReady(true);
    },
    [selectedCryptoAsset]
  );

  // Finance sidebar 回调
  const handleFinanceSidebarClick = useCallback((id: string) => {
    setSelectedFinanceItem(id);
  }, []);

  // Finance 标签加载完成：默认选中第一个，解锁 useEvents
  const handleFinanceTagsLoaded = useCallback(
    (tags: TagTreeNode[]) => {
      if (tags.length > 0 && !selectedFinanceItem) {
        setSelectedFinanceItem(tags[0].slug);
      }
      setFinanceTagsReady(true);
    },
    [selectedFinanceItem]
  );

  // 内容区域（事件列表 + load more）
  const eventContent = (
    <>
      <MarketGrid
        markets={markets}
        columns={hasSidebar ? 3 : 4}
        loading={hasSidebar ? showSidebarSkeleton : isLoading}
        emptyMessage={t.market.common.noData}
        onFavoriteChange={refresh}
      />

      {hasMore && !isLoading && !isCryptoBooting && !isFinanceBooting && markets.length > 0 && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="px-6 py-2 rounded-lg bg-(--bg-secondary) text-(--text-primary) hover:bg-(--bg-tertiary) transition-colors disabled:opacity-50"
          >
            {isLoadingMore ? t.market.common.loading : t.market.common.loadMore}
          </button>
        </div>
      )}
    </>
  );

  // Crypto 布局：左侧 sidebar + 右侧内容
  if (isCrypto) {
    return (
      <div className="h-full flex flex-col">
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row w-full h-full relative">
          {/* 左侧 sidebar */}
          <CryptoSideBar
            selectedId={selectedCryptoAsset}
            onItemClick={handleCryptoSidebarClick}
            onTagsLoaded={handleCryptoTagsLoaded}
            initialTags={initialTags && initialTags.length > 0 ? initialTags : undefined}
          />

          {/* 右侧内容 */}
          <div className="flex-1 flex flex-col h-full overflow-hidden no-scrollbar">
            <div className="flex-1 overflow-y-auto p-4 md:px-6 md:py-0 pb-24 scrollbar-thin">
              <FilterBarSimple
                categories={categoriesList}
                variant="sidebar"
                showCategories={false}
                onSearchChange={handleSearchChange}
                onSortChange={handleSortChange}
                onFrequencyChange={handleFrequencyChange}
                onActiveChange={handleActiveChange}
                onCollectedChange={handleCollectedChange}
                showBookmark={false}
                showStatus={false}
              />
              {eventContent}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Finance 布局：左侧 sidebar + 右侧内容（跟 crypto 同样模式）
  if (isFinance) {
    return (
      <div className="h-full flex flex-col">
        <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row w-full h-full relative">
          <FinanceSideBar
            selectedId={selectedFinanceItem || ""}
            onItemClick={handleFinanceSidebarClick}
            onTagsLoaded={handleFinanceTagsLoaded}
          />

          <div className="flex-1 flex flex-col h-full overflow-hidden no-scrollbar">
            <div className="flex-1 overflow-y-auto p-4 md:px-6 md:py-0 pb-24 scrollbar-thin">
              <FilterBarSimple
                categories={categoriesList}
                variant="sidebar"
                showCategories={false}
                onSearchChange={handleSearchChange}
                onSortChange={handleSortChange}
                onFrequencyChange={handleFrequencyChange}
                onActiveChange={handleActiveChange}
                onCollectedChange={handleCollectedChange}
                showBookmark={false}
                showStatus={false}
              />
              {eventContent}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 默认布局：顶部 FilterBar + 事件列表
  return (
    <div className="max-w-[1400px] mx-auto px-3 sm:px-5 pt-3 sm:pt-5 pb-6 sm:pb-10">
      <FilterBarSimple
        categories={categoriesList}
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
        onSearchChange={handleSearchChange}
        onSortChange={handleSortChange}
        onFrequencyChange={handleFrequencyChange}
        onActiveChange={handleActiveChange}
        onCollectedChange={handleCollectedChange}
      />
      {eventContent}
    </div>
  );
}
