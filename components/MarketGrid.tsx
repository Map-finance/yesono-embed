"use client";

/**
 * 瀑布流布局 MarketGrid
 * 使用纯 JavaScript 实现横向填充的瀑布流效果，完全兼容 Edge Runtime
 */

import React, { useEffect, useState, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import MarketCard from "./MarketCard";
import { Market } from "@/types/types";
import { trackEvent } from "@/lib/sentryClient";
import Link from "next/link";

interface MarketGridProps {
  markets: Market[];
  columns?: number;
  loading?: boolean;
  emptyMessage?: string;
  onFavoriteChange?: () => void;
}

export default function MarketGrid({
  markets,
  columns = 3,
  loading = false,
  emptyMessage,
  onFavoriteChange,
}: MarketGridProps) {
  const { t } = useTranslation();
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

  // 骨架屏加载状态
  if (loading && markets.length === 0) {
    return (
      <div className="my-5">
        <div className="masonry-grid">
          {Array.from({ length: columnCount || 3 }).map((_, colIndex) => (
            <div key={colIndex} className="masonry-grid_column">
              {Array.from({ length: 6 }).map((_, itemIndex) => (
                <div key={itemIndex} className="mb-4">
                  <div className="bg-(--bg-secondary) rounded-lg p-4 animate-pulse">
                    <div className="h-4 bg-(--bg-primary) rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-(--bg-primary) rounded w-1/2 mb-2"></div>
                    <div className="h-3 bg-(--bg-primary) rounded w-2/3"></div>
                  </div>
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
                <Link href={targetUrl} onClick={() => trackEvent('market_card_click', {  event_id: market.id, event_title: market.title, source: 'list' })}>
                  <MarketCard
                    market={market}
                    onFavoriteChange={onFavoriteChange}
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
