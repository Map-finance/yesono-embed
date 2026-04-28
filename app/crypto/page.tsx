"use client";

import React, { useCallback, useMemo, useState } from "react";
import CryptoSidebar from "@/components/crypto/CryptoSideBar";
import FilterBarSimple from "@/components/FilterBarSimple";
import MarketGrid from "@/components/MarketGrid";
import { Market } from "@/types/types";
import { useEvents } from "@/lib/hooks/useEvents";
import { eventsToMarkets } from "@/lib/utils/eventToMarket";
import { useTranslation } from "@/lib/i18n";

export default function CryptoPage() {
  const { t } = useTranslation();

  // Sidebar 选中的资产
  const [selectedCryptoAsset, setSelectedCryptoAsset] = useState("All");

  // FilterBar 高级筛选状态
  const [searchQ, setSearchQ] = useState("");
  const [sortOrder, setSortOrder] = useState("");

  // 将 SORT_TO_API 格式（如 "-volume24hr"）拆分为 orderBy + ascending
  const { orderBy, ascending } = useMemo(() => {
    if (!sortOrder) return { orderBy: undefined, ascending: undefined };
    const prefix = sortOrder.charAt(0);
    const field = sortOrder.slice(1);
    return {
      orderBy: field,
      ascending: prefix === "+",
    };
  }, [sortOrder]);

  // 构建 crypto slug：sidebar 选中的资产或默认 "crypto"
  const cryptoSlug = useMemo(() => {
    return selectedCryptoAsset && selectedCryptoAsset !== "All"
      ? selectedCryptoAsset
      : "crypto";
  }, [selectedCryptoAsset]);

  const { events, isLoading, hasMore, loadMore, isLoadingMore, refresh } =
    useEvents({
      apiType: "crypto",
      cryptoSlug,
      cryptoSearchText: searchQ || undefined,
      cryptoOrderBy: orderBy,
      cryptoAscending: ascending,
      limit: 20,
    });

  const markets: Market[] = useMemo(() => {
    return eventsToMarkets(events);
  }, [events]);

  // 回调
  const handleCryptoSidebarClick = useCallback((id: string) => {
    setSelectedCryptoAsset(id);
  }, []);
  const handleSearchChange = useCallback((q: string) => setSearchQ(q), []);
  const handleSortChange = useCallback((order: string) => {
    setSortOrder(order);
  }, []);

  // 当 crypto 资产标签加载完成时，默认选中第一个
  const handleCryptoTagsLoaded = useCallback(
    (tags: any[]) => {
      if (tags.length > 0 && selectedCryptoAsset === "All") {
        setSelectedCryptoAsset(tags[0].slug);
      }
    },
    [selectedCryptoAsset]
  );

  return (
    <div className="h-full flex flex-col">
      <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row w-full h-full relative">
        {/* 侧边栏 */}
        <CryptoSidebar
          selectedId={selectedCryptoAsset}
          onItemClick={handleCryptoSidebarClick}
          onTagsLoaded={handleCryptoTagsLoaded}
        />

        {/* 瀑布流列表 */}
        <div className="flex-1 flex flex-col h-full overflow-hidden no-scrollbar">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 scrollbar-thin">
            <FilterBarSimple
              categories={["All"]}
              variant="sidebar"
              showCategories={false}
              onSearchChange={handleSearchChange}
              onSortChange={handleSortChange}
              showBookmark={false}
              showStatus={false}
            />
            <MarketGrid
              markets={markets}
              columns={3}
              loading={isLoading}
              emptyMessage={t.market.common.noData}
              onFavoriteChange={refresh}
            />

            {hasMore && !isLoading && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="px-6 py-2 rounded-lg bg-(--bg-secondary) text-(--text-primary) hover:bg-(--bg-tertiary) transition-colors disabled:opacity-50"
                >
                  {isLoadingMore
                    ? t.market.common.loading
                    : t.market.common.loadMore}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
