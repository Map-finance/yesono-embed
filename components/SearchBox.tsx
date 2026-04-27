'use client';

/**
 * 搜索组件
 * 包含搜索框、BROWSE 筛选和 TOPICS 主题
 * 数据从 API 获取
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, Tag, Loader2, X } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { getTagTree, getEvents } from '@/lib/services/homeService';
import { useNavigation } from '@/lib/hooks/useNavigation';
import { NavigationItem, TagTreeNode, EventSummary } from '@/types/home';
import { getMarketNavigationUrl } from '@/lib/utils/sportsNav';
import ProxyImage from '@/components/common/ProxyImage';
import { trackEvent } from '@/lib/sentryClient';

// 颜色列表用于循环分配
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

interface SearchBoxProps {
  className?: string;
  maxWidth?: string;
}

const SearchBox: React.FC<SearchBoxProps> = ({
  className = '', 
  maxWidth = 'max-w-[500px]' 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [tagItems, setTagItems] = useState<TagTreeNode[]>([]);
  const [searchResults, setSearchResults] = useState<EventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 使用统一缓存的导航数据
  const { data: navItems } = useNavigation();

  const getBrowsePath = useCallback((item: NavigationItem) => {
    const slug = (item.slug || "").toLowerCase();
    if (slug === "trending") return "/trending";
    if (slug === "new") return "/trending/new";
    if (slug === "sports") return "/sports?tag=asian";
    return `/trending/${item.slug}`;
  }, []);

  const isBrowsePathActive = useCallback((itemPath: string) => {
    if (itemPath === "/trending" && pathname === "/") {
      return true;
    }

    const [itemPathname, itemQuery] = itemPath.split("?");
    if (pathname !== itemPathname) {
      return false;
    }

    if (!itemQuery) {
      return true;
    }

    const expectedParams = new URLSearchParams(itemQuery);
    return Array.from(expectedParams.entries()).every(
      ([key, value]) => searchParams.get(key) === value
    );
  }, [pathname, searchParams]);

  // 加载标签数据
  useEffect(() => {
    const loadTags = async () => {
      setIsLoading(true);
      try {
        const tags = await getTagTree('', true);
        setTagItems(tags);
      } catch (error) {
        console.error('[SearchBox] Failed to load tags:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTags();
  }, []);

  // debounce 搜索事件列表
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
        const resp = await getEvents({ q: searchValue.trim(), order: '-volume', limit: 6 ,active: true });
        trackEvent('market_search', { keyword: searchValue.trim(), result_count: resp.events?.length || 0 });
        setSearchResults(resp.events || []);
      } catch (error) {
        console.error('[SearchBox] Search failed:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchValue]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen]);

  // 处理搜索结果点击
  const handleResultClick = useCallback((event: EventSummary) => {
    trackEvent('market_card_click', { event_id: String(event.id), event_title: event.title, source: 'search' });
    router.push(getMarketNavigationUrl(event.slug, event.tags));
    setIsOpen(false);
    setSearchValue('');
  }, [router]);

  // 处理浏览选项点击
  const handleBrowseClick = (item: NavigationItem) => {
    const path = getBrowsePath(item);
    router.push(path);
    setIsOpen(false);
  };

  // 处理主题点击
  const handleTopicClick = (tag: TagTreeNode) => {
    router.push(`/trending/${tag.slug}`);
    setIsOpen(false);
  };

  // 获取事件的第一个 market 标题和 yes 百分比
  const getEventMeta = useCallback((event: EventSummary) => {
    const firstMarket = event.markets?.[0];
    const marketTitle = firstMarket?.groupItemTitle || firstMarket?.question || '';
    let pct: string | null = null;
    if (firstMarket) {
      let yesPrice: number | null = null;
      try {
        // 优先使用 rowOutcomePrice
        const rowPrices = firstMarket.rowOutcomePrice ? JSON.parse(firstMarket.rowOutcomePrice) : null;
        if (rowPrices && rowPrices.length > 0) {
          yesPrice = parseFloat(rowPrices[0]);
        }
      } catch(err) {
        console.error("Error parsing rowOutcomePrice:", err);
      }
      // fallback 到 outcomes[0].price
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
    <div ref={searchRef} className={`relative flex-1  ${maxWidth} ${className}`}>
      {/* 搜索输入框 */}
      <div className="relative">
        <Search 
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" 
          size={16} 
        />
        <input
          ref={inputRef}
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="w-full py-2 pl-10 pr-8 rounded-md bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)] focus:outline-none focus:border-[var(--accent)] text-sm"
          placeholder={t.common.search}
        />
        {searchValue && (
          <button
            onClick={() => {
              setSearchValue('');
              setSearchResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* 下拉菜单 */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] shadow-xl z-[9999] max-h-[600px] overflow-y-auto">

          {/* 搜索结果卡片列表 */}
          {hasSearchQuery && (
            <div className="p-2">
              {isSearching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={20} className="animate-spin text-[var(--text-secondary)]" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {searchResults.map((event) => {
                    const { pct, marketTitle } = getEventMeta(event);
                    return (
                      <button
                        key={event.id}
                        onClick={() => handleResultClick(event)}
                        className="flex items-center gap-3 w-full p-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-left"
                      >
                        {/* 左侧图片 */}
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-secondary)]">
                          {event.image ? (
                            <ProxyImage
                              src={event.image}
                              alt={event.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[var(--text-tertiary)]">
                              <Search size={16} />
                            </div>
                          )}
                        </div>

                        {/* 中间标题 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                            {event.title}
                          </p>
                        </div>

                        {/* 右侧：百分比 + 第一个 market 标题 */}
                        <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
                          {pct && (
                            <span className="text-sm font-semibold text-[var(--accent)]">
                              {pct}
                            </span>
                          )}
                          {marketTitle && (
                            <span className="text-[11px] text-[var(--text-tertiary)] max-w-[120px] truncate">
                              {marketTitle}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center py-6 text-sm text-[var(--text-secondary)]">
                  {t.market.common.noData}
                </div>
              )}
            </div>
          )}

          {/* BROWSE 部分 - 无搜索时显示 */}
          {!hasSearchQuery && (
            <>
              <div className="p-4 border-b border-[var(--border)]">
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                  {t.common.browse}
                </div>
                <div className="flex flex-wrap gap-2">
                  {navItems.map((item) => {
                    const browsePath = getBrowsePath(item);
                    const isSelected = isBrowsePathActive(browsePath);
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleBrowseClick(item)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                          isSelected
                            ? 'bg-[var(--accent)] text-[var(--bg-primary)] font-semibold'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TOPICS 部分 */}
              <div className="p-4">
                <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                  {t.common.topics}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {tagItems.map((tag, index) => {
                    const color = TOPIC_COLORS[index % TOPIC_COLORS.length];
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleTopicClick(tag)}
                        className="flex flex-col items-center gap-2 p-3 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] transition-colors group"
                      >
                        <div className={`${color} group-hover:scale-110 transition-transform`}>
                          <Tag size={24} />
                        </div>
                        <span className="text-xs text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] text-center">
                          {tag.name}
                        </span>
                        {tag.count !== undefined && tag.count !== null && Number(tag.count) > 0 && (
                          <span className="text-[10px] text-[var(--text-tertiary)]">
                            {tag.count} markets
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBox;

