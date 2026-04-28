'use client';

/**
 * 移动端搜索页面
 * 全屏版 SearchBox，包含搜索框、BROWSE 筛选和 TOPICS 主题
 */


import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Tag, Loader2, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { getTagTree, getEvents } from '@/lib/services/homeService';
import { useNavigation } from '@/lib/hooks/useNavigation';
import { NavigationItem, TagTreeNode, EventSummary } from '@/types/home';
import { getMarketNavigationUrl } from '@/lib/utils/sportsNav';
import ProxyImage from '@/components/common/ProxyImage';

const TOPIC_COLORS = [
  'text-orange-500',
  'text-red-500',
  'text-blue-500',
  'text-yellow-500',
  'text-green-500',
  'text-purple-500',
  'text-pink-500',
  'text-cyan-500',
];

export default function SearchPage() {
  const [searchValue, setSearchValue] = useState('');
  const { data: navItems } = useNavigation();
  const [tagItems, setTagItems] = useState<TagTreeNode[]>([]);
  const [searchResults, setSearchResults] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();
  const router = useRouter();

  // 加载标签数据（导航使用 useNavigation 统一缓存）
  useEffect(() => {
    const loadTags = async () => {
      setIsLoading(true);
      try {
        const tags = await getTagTree('', true);
        setTagItems(tags);
      } catch (error) {
        console.error('[SearchPage] Failed to load tags:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTags();
  }, []);

  // debounce 搜索
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (!searchValue.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await getEvents({ q: searchValue.trim(), order: '-volume', limit: 6, active: true });
        setSearchResults(resp.events || []);
      } catch (error) {
        console.error('[SearchPage] Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchValue]);

  // 自动聚焦
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleResultClick = useCallback((event: EventSummary) => {
    router.push(getMarketNavigationUrl(event.slug, event.tags));
  }, [router]);

  const handleBrowseClick = (item: NavigationItem) => {
    router.push(`/trending/${item.slug}`);
  };

  const handleTopicClick = (tag: TagTreeNode) => {
    router.push(`/trending/${tag.slug}`);
  };

  // 获取事件的第一个 market 标题和 yes 百分比
  const getEventMeta = useCallback((event: EventSummary) => {
    const firstMarket = event.markets?.[0];
    const marketTitle = firstMarket?.groupItemTitle || firstMarket?.question || '';
    let pct: string | null = null;
    if (firstMarket) {
      let yesPrice: number | null = null;
      try {
        const rowPrices = firstMarket.rowOutcomePrice ? JSON.parse(firstMarket.rowOutcomePrice) : null;
        if (rowPrices && rowPrices.length > 0) {
          yesPrice = parseFloat(rowPrices[0]);
        }
      } catch(err) {
        console.error("Error parsing rowOutcomePrice:", err);
      }
      if (yesPrice == null || isNaN(yesPrice)) {
        const yesOutcome = firstMarket.outcomes?.find(o =>
          o.name?.toLowerCase() === 'yes' || o.outcomeKey?.toLowerCase() === 'yes'
        ) || firstMarket.outcomes?.[0];
        yesPrice = yesOutcome?.price ?? null;
      }
      if (yesPrice != null && !isNaN(yesPrice)) {
        pct = `${Math.round(yesPrice * 100)}%`;
      }
    }
    return { pct, marketTitle };
  }, []);

  const hasSearchQuery = searchValue.trim().length > 0;

  return (
    <div className="min-h-screen bg-(--bg-primary) px-4 pt-4 pb-20">
      {/* 搜索输入框 */}
      <div className="relative mb-4">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-secondary)"
          size={18}
        />
        <input
          ref={inputRef}
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="w-full py-3 pl-10 pr-9 rounded-xl bg-(--bg-secondary) text-(--text-primary) border border-(--border) focus:outline-hidden focus:border-(--accent) text-sm"
          placeholder={t.common.search}
        />
        {searchValue && (
          <button
            onClick={() => {
              setSearchValue('');
              setSearchResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-(--bg-hover) text-(--text-secondary) hover:text-(--text-primary) transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* 搜索结果 */}
      {hasSearchQuery && (
        <div className="mb-4">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-(--text-secondary)" />
            </div>
          ) : searchResults.length > 0 ? (
            <div className="flex flex-col gap-1">
              {searchResults.map((event) => {
                const { pct, marketTitle } = getEventMeta(event);
                return (
                  <button
                    key={event.id}
                    onClick={() => handleResultClick(event)}
                    className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-(--bg-hover) transition-colors text-left"
                  >
                    <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-(--bg-secondary)">
                      {event.image ? (
                        <ProxyImage
                          src={event.image}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-(--text-tertiary)">
                          <Search size={16} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-(--text-primary) line-clamp-2">
                        {event.title}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0 gap-0.5">
                      {pct && (
                        <span className="text-sm font-semibold text-(--accent)">
                          {pct}
                        </span>
                      )}
                      {marketTitle && (
                        <span className="text-[11px] text-(--text-tertiary) max-w-[100px] truncate">
                          {marketTitle}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-sm text-(--text-secondary)">
              {t.market.common.noData}
            </div>
          )}
        </div>
      )}

      {/* BROWSE 部分 - 无搜索时显示 */}
      {!hasSearchQuery && (
        <>
          <div className="mb-6">
            <div className="text-xs font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">
              {t.common.browse}
            </div>
            <div className="flex flex-wrap gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleBrowseClick(item)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-sm bg-(--bg-secondary) text-(--text-primary) hover:bg-(--bg-hover) transition-colors border border-(--border)"
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* TOPICS 部分 */}
          <div>
            <div className="text-xs font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">
              {t.common.topics}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {tagItems.map((tag, index) => (
                <button
                  key={tag.id}
                  onClick={() => handleTopicClick(tag)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-(--bg-secondary) hover:bg-(--bg-hover) transition-colors border border-(--border)"
                >
                  <div className="w-10 h-10 rounded-lg bg-(--bg-tertiary) flex items-center justify-center shrink-0">
                    <Tag size={18} className={TOPIC_COLORS[index % TOPIC_COLORS.length]} />
                  </div>
                  <span className="text-sm font-medium text-(--text-primary) text-left">
                    {tag.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
