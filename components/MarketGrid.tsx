"use client";

/**
 * 瀑布流布局 MarketGrid
 * 使用纯 JavaScript 实现横向填充的瀑布流效果，完全兼容 Edge Runtime
 */

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import MarketCard from "./MarketCard";
import { Market } from "@/types/types";
import { trackEvent } from "@/lib/sentryClient";
import { Skeleton } from "@/components/ui/shadcn/skeleton";
import Link from "next/link";

interface MarketGridProps {
  markets: Market[];
  columns?: number;
  loading?: boolean;
  emptyMessage?: string;
  onFavoriteChange?: (slug: string, isFavorite: boolean) => void;
  /** 是否显示卡片上的收藏按钮。默认 true */
  showBookmark?: boolean;
}

export default function MarketGrid({
  markets,
  columns = 3,
  loading = false,
  emptyMessage,
  onFavoriteChange,
  showBookmark = true,
}: MarketGridProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const effectiveEmptyMessage = emptyMessage ?? t.market.noMarkets;
  const [columnCount, setColumnCount] = useState(columns);

  // 响应式列数计算
  useEffect(() => {
    const updateColumns = () => {
      if (typeof window === "undefined") return;

      const width = window.innerWidth;
      let newColumns = columns;

      // 移动端优先：更小的断点
      if (width < 480) {
        newColumns = 1; // 小手机
      } else if (width < 640) {
        newColumns = 2; // 大手机
      } else if (width < 900) {
        newColumns = 2; // 小平板
      } else if (width < 1100) {
        newColumns = 3; // 平板
      } else if (width < 1400) {
        newColumns = Math.min(columns, 4); // 小桌面
      } else {
        newColumns = columns; // 大桌面
      }

      setColumnCount(newColumns);
    };

    // 立即执行一次
    updateColumns();

    // 监听窗口大小变化
    window.addEventListener("resize", updateColumns);

    return () => {
      window.removeEventListener("resize", updateColumns);
    };
  }, [columns]);

  // 将卡片分配到各列（横向填充：从左到右）
  const columnItems = useMemo(() => {
    if (markets.length === 0 || columnCount === 0) {
      return [];
    }

    const items: Market[][] = new Array(columnCount).fill(null).map(() => []);
    const heights = new Array(columnCount).fill(0);

    // 为每个卡片找到最短的列（横向填充）
    markets.forEach((market) => {
      const shortestColumnIndex = heights.indexOf(Math.min(...heights));
      items[shortestColumnIndex].push(market);
      // 使用估算高度（实际渲染后会根据内容调整）
      heights[shortestColumnIndex] += 200; // 估算每个卡片高度约200px
    });

    return items;
  }, [markets, columnCount]);

  // 骨架屏加载状态：用 shadcn Skeleton（项目里统一调过的 6% 白叠加），
  // 不再用 bg-(--bg-secondary) / bg-(--bg-primary) 实色——后者在深色页面上反而显白刺眼。
  if (loading && markets.length === 0) {
    return (
      <div className="my-5">
        <div className="masonry-grid">
          {Array.from({ length: columnCount || 3 }).map((_, colIndex) => (
            <div key={colIndex} className="masonry-grid_column">
              {Array.from({ length: 6 }).map((_, itemIndex) => (
                <div
                  key={itemIndex}
                  className="mb-4 rounded-lg p-4 border border-(--border) bg-(--bg-card) space-y-3"
                >
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="py-10 text-center text-(--text-secondary)">
        {effectiveEmptyMessage}
      </div>
    );
  }

  return (
    <div className="my-5">
      <div className="masonry-grid">
        {columnItems.map((items, columnIndex) => (
          <div key={columnIndex} className="masonry-grid_column">
            {items.map((market) => {
              // 移动端且只有 1 个 market 时直接跳转 outcome 详情页，避免闪屏
              const slug = market.slug || market.id;
              const isSingleMarket = (market as any).marketCount === 1 || market.options?.length <= 2;
              const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;
              const targetUrl = isMobile && isSingleMarket
                ? `/market/${slug}/outcome/0`
                : `/market/${slug}`;
              return (
              <div key={market.id} className="mb-4">
                {/* 关掉视口预取(长列表滚动时一屏几十张全预取会挤爆连接池),
                    改为「意向预取」:鼠标移入 / 触摸按下时才预取该卡,只命中用户真要点的那张。
                    router.prefetch 内部自带去重缓存,重复触发无额外开销。 */}
                <Link
                  href={targetUrl}
                  prefetch={false}
                  onMouseEnter={() => router.prefetch(targetUrl)}
                  onTouchStart={() => router.prefetch(targetUrl)}
                  onClick={() => trackEvent('market_card_click', {  event_id: market.id, event_title: market.title, source: 'list' })}>
                  <MarketCard
                    market={market}
                    onFavoriteChange={onFavoriteChange}
                    showBookmark={showBookmark}
                    />
                </Link>
              </div>
            );})}
          </div>
        ))}
      </div>
    </div>
  );
}
