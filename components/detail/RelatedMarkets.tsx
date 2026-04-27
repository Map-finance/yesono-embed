"use client";

/**
 * RelatedMarkets - 相关市场推荐
 * 通过当前市场 title 的一半内容搜索 /api/events 接口获取相关市场
 */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { getEvents } from "@/lib/services/homeService";
import { EventSummary } from "@/types/home";
import ProxyImage from "@/components/common/ProxyImage";

interface RelatedMarketsProps {
  currentMarketId: string;
  marketTitle?: string;
}

const RelatedMarkets: React.FC<RelatedMarketsProps> = ({ currentMarketId, marketTitle }) => {
  const router = useRouter();
  const { t } = useTranslation();
  const [relatedEvents, setRelatedEvents] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!marketTitle) return;

    const fetchRelated = async () => {
      setIsLoading(true);
      try {
        // 提取搜索关键词：取 title 前一半，最多 80 字符，在单词/字符边界截断
        const MAX_KEYWORD_LEN = 80;
        const halfLen = Math.min(Math.ceil(marketTitle.length / 2), MAX_KEYWORD_LEN);
        let searchKeyword = marketTitle.slice(0, halfLen).trim();
        // 英文标题：在最后一个空格处截断，避免截断单词
        const lastSpace = searchKeyword.lastIndexOf(' ');
        if (lastSpace > searchKeyword.length * 0.5) {
          searchKeyword = searchKeyword.slice(0, lastSpace);
        }
        // 去除尾部标点符号
        searchKeyword = searchKeyword.replace(/[?!.,;:'")\]]+$/, '').trim();
        if (!searchKeyword) return;

        const resp = await getEvents({ q: searchKeyword, limit: 5, active: true });
        // 排除当前市场
        const filtered = (resp.events || []).filter(
          (e) => e.slug !== currentMarketId && String(e.id) !== currentMarketId
        );
        setRelatedEvents(filtered.slice(0, 5));
      } catch (err) {
        console.error('[RelatedMarkets] Failed to fetch:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRelated();
  }, [marketTitle, currentMarketId]);

  const handleMarketClick = (slug: string) => {
    router.push(`/market/${slug}`);
  };

  return (
    <div
      className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
      role="region"
      aria-label={t.market.relatedMarkets}
    >
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{t.market.relatedMarkets}</h3>
      {/* 市场列表 */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : relatedEvents.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)] text-center py-4">{t.market.common.noData}</p>
        ) : (
          relatedEvents.map((event) => (
            <div
              key={event.id}
              onClick={() => handleMarketClick(event.slug)}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
            >
              <ProxyImage
                src={event.icon || event.image}
                alt={event.title}
                className="w-8 h-8 rounded-md object-cover flex-shrink-0"
                fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIGZpbGw9IiMyYTJhMmEiLz48L3N2Zz4="
              />

              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)] leading-snug line-clamp-2">
                  {event.title}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RelatedMarkets;
