"use client";

/**
 * Sports 主页面
 * SportsTagNav 由 layout 统一提供
 * 本页面只渲染右侧内容区域
 *
 * - 有 tags 参数: SportsGamesView（新版赛事卡片）
 * - 其他: 原有 MarketGrid 卡片列表
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Market } from "@/types/types";
import MarketGrid from "@/components/MarketGrid";
import { useEvents } from "@/lib/hooks/useEvents";
import { useTagTree } from "@/lib/hooks/useTagTree";
import { eventsToMarkets } from "@/lib/utils/eventToMarket";
import { useTranslation } from "@/lib/i18n";
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

  const isGamesView = !!tagsFromUrl || !!eventFromUrl;

  // 裸默认态：无 tag / tags / event（即直接进入「体育」）→ 自动跳到第一个运动的 games 视图
  const isBareDefault = !tagFromUrl && !tagsFromUrl && !eventFromUrl;

  // 仅在裸默认态拉取 sports 根标签（运动列表），用于挑第一个运动
  const { tags: sportsRootTags } = useTagTree({
    slug: "sports",
    withCount: true,
    enabled: isBareDefault,
  });

  const redirectedRef = useRef(false);
  useEffect(() => {
    if (!isBareDefault) {
      redirectedRef.current = false;
      return;
    }
    if (redirectedRef.current) return;
    const first = sportsRootTags[0];
    if (!first) return; // 运动列表未就绪/为空 → 回退到通用体育列表
    redirectedRef.current = true;
    const tagsChain = `sports,${first.slug}`;
    router.replace(
      `/sports?tag=${first.slug}&tags=${encodeURIComponent(tagsChain)}&name=${encodeURIComponent(first.name)}`
    );
  }, [isBareDefault, sportsRootTags, router]);

  const effectiveTagSlug = isGamesView ? "" : tagFromUrl || "sports";

  const { events, isLoading, hasMore, loadMore, isLoadingMore, refresh } =
    useEvents({
      tag_slug: effectiveTagSlug,
      active: true,
      limit: 20,
    });

  // 将事件转换为 Market 类型以兼容现有组件
  const markets: Market[] = useMemo(() => {
    return eventsToMarkets(events);
  }, [events]);

  return (
    <>
      {isGamesView ? (
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
                className="px-6 py-2 rounded-lg bg-(--bg-secondary) text-(--text-primary) hover:bg-(--bg-tertiary) transition-colors disabled:opacity-50"
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
    <div className="py-10 text-center text-(--text-secondary)">
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
