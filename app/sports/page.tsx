"use client";

/**
 * Sports 主页面
 * SportsTagNav 由 layout 统一提供
 * 本页面只渲染右侧内容区域
 *
 * - Asian: SportsBettingApp
 * - Live: LiveSports
 * - 有 tags 参数: SportsGamesView（新版赛事卡片）
 * - 其他: 原有 MarketGrid 卡片列表
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Market } from "@/types/types";
import MarketGrid from "@/components/MarketGrid";
import { useEvents } from "@/lib/hooks/useEvents";
import { eventsToMarkets } from "@/lib/utils/eventToMarket";
import { useTranslation } from "@/lib/i18n";
import LiveSports from "@/components/sports/Live";
import SportsGamesView from "@/components/sports/GamesView";

function SportsPageContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();

  // 从 URL 参数获取 tag、tags 和 event
  const tagFromUrl = searchParams.get("tag");
  const tagsFromUrl = searchParams.get("tags");
  const tagNameFromUrl = searchParams.get("name");
  const eventFromUrl = searchParams.get("event");

  const isLiveSelected = !eventFromUrl && tagFromUrl === "live";
  const isGamesView =
    (!isLiveSelected && !!tagsFromUrl) || !!eventFromUrl;

  const effectiveTagSlug =
    isLiveSelected || isGamesView ? "" : tagFromUrl || "sports";

  const { events, isLoading, hasMore, loadMore, isLoadingMore, refresh } =
    useEvents({
      tag_slug: effectiveTagSlug,
      active: true,
      limit: 20,
      enabled: !isLiveSelected,
    });

  // 将事件转换为 Market 类型以兼容现有组件
  const markets: Market[] = useMemo(() => {
    return eventsToMarkets(events);
  }, [events]);

  return (
    <>
      {isLiveSelected ? (
        <LiveSports />
      ) : isGamesView ? (
        <SportsGamesView
          tagSlug={tagFromUrl || ""}
          tagsChain={tagsFromUrl || ""}
          tagName={tagNameFromUrl || undefined}
          initialEventSlug={eventFromUrl}
        />
      ) : (
        <>
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
                className="px-6 py-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors disabled:opacity-50"
              >
                {isLoadingMore
                  ? t.market.common.loading
                  : t.market.common.loadMore}
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function SportsPageFallback() {
  return (
    <div className="py-10 text-center text-[var(--text-secondary)]">
      Loading...
    </div>
  );
}

export default function SportsPage() {
  return (
    <Suspense fallback={<SportsPageFallback />}>
      <SportsPageContent />
    </Suspense>
  );
}
