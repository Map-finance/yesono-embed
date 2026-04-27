"use client";

/**
 * 简化版 FilterBar
 * 直接接收 props，不依赖配置系统
 */

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  Search,
  SlidersHorizontal,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { trackEvent } from "@/lib/sentryClient";

// 排序选项
const SORT_OPTIONS = [
  { value: "24hr_volume", label: "24hr Volume", icon: "📊" },
  { value: "total_volume", label: "Total Volume", icon: "📈" },
  { value: "liquidity", label: "Liquidity", icon: "💧" },
  { value: "newest", label: "Newest", icon: "✨" },
  { value: "ending_soon", label: "Ending Soon", icon: "⏰" },
  // { value: 'competitive', label: 'Competitive', icon: '🏆' },
];

// 频率选项
const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "all", label: "All" },
];

// 状态选项
const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" },
];

interface FilterBarSimpleProps {
  categories: string[];
  variant?: "default" | "sidebar";
  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;
  onSearchChange?: (q: string) => void;
  onSortChange?: (order: string) => void;
  onFrequencyChange?: (frequency: string) => void;
  onStatusChange?: (status: string) => void;
  onActiveChange?: (active: boolean) => void;
  showCategories?: boolean;
  showSearch?: boolean;
  showFilter?: boolean;
  onCollectedChange?: (collected: boolean) => void;
  showBookmark?: boolean;
  showStatus?: boolean;
}

// 排序值 → API order 映射（支持多字段，前缀 - 降序，+ 升序）
const SORT_TO_API: Record<string, string> = {
  "24hr_volume": "-volume24hr",
  total_volume: "-volume",
  liquidity: "-liquidity",
  newest: "+startdate",
  ending_soon: "+enddate",
  competitive: "-volume",
};

export default function FilterBarSimple({
  categories,
  variant = "default",
  selectedCategory = "All",
  onCategoryChange,
  onSearchChange,
  onSortChange,
  onFrequencyChange,
  onStatusChange,
  onActiveChange,
  onCollectedChange,
  showCategories = true,
  showSearch = true,
  showFilter = true,
  showBookmark = true,
  showStatus = true,
}: FilterBarSimpleProps) {
  const isSidebarVariant = variant === "sidebar";
  const [activeCategory, setActiveCategory] =
    useState<string>(selectedCategory);
  const [searchValue, setSearchValue] = useState("");
  const { t } = useTranslation();
  // 桌面端搜索框是否展开（移动端始终展开，由 CSS 控制不依赖此状态）
  const [isSearchExpanded, setIsSearchExpanded] = useState(isSidebarVariant);
  const [isAdvancedFilterOpen, setIsAdvancedFilterOpen] = useState(false);

  // 收藏筛选状态
  const [isCollected, setIsCollected] = useState(false);

  // 高级筛选状态
  const [sortBy, setSortBy] = useState("24hr_volume");
  const [frequency, setFrequency] = useState("all");
  const [status, setStatus] = useState("active");
  const [hideSports, setHideSports] = useState(false);
  const [hideCrypto, setHideCrypto] = useState(false);
  const [hideEarnings, setHideEarnings] = useState(false);

  // 下拉菜单状态
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // 滚动容器引用
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // debounce 搜索：用户停止输入 300ms 后自动搜索
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onSearchChange?.(searchValue);
    }, 300);
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchValue]);

  // 排序选项
  const SORT_OPTIONS = [
    { value: "24hr_volume", label: t.common["24hrVolume"], icon: "📊" },
    { value: "total_volume", label: t.common.totalVolume, icon: "📈" },
    { value: "liquidity", label: t.common.liquidity, icon: "💧" },
    { value: "newest", label: t.common.newest, icon: "✨" },
    { value: "ending_soon", label: t.common.endingSoon, icon: "⏰" },
    { value: "competitive", label: t.common.competitive, icon: "🏆" },
  ];

  // 频率选项
  const FREQUENCY_OPTIONS = [
    { value: "daily", label: t.common.daily },
    { value: "weekly", label: t.common.weekly },
    { value: "monthly", label: t.common.monthly },
    { value: "all", label: t.common.all },
  ];

  // 状态选项
  const STATUS_OPTIONS = [
    { value: "active", label: t.common.active },
    { value: "resolved", label: t.common.resolved },
  ];

  // 同步外部 selectedCategory 变化
  useEffect(() => {
    setActiveCategory(selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    if (isSidebarVariant) {
      setIsSearchExpanded(true);
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const syncExpandedState = () => {
      setIsSearchExpanded(mediaQuery.matches);
    };

    syncExpandedState();
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", syncExpandedState);
      return () => mediaQuery.removeEventListener("change", syncExpandedState);
    }

    mediaQuery.addListener(syncExpandedState);
    return () => mediaQuery.removeListener(syncExpandedState);
  }, [isSidebarVariant]);

  const handleCategoryClick = (category: string) => {
    setActiveCategory(category);
    if (onCategoryChange) {
      requestAnimationFrame(() => {
        onCategoryChange(category);
      });
    }
    // 自动滚动：将选中标签居中显示
    const container = scrollContainerRef.current;
    if (container) {
      const idx = categories.indexOf(category);
      const btn = container.children[idx] as HTMLElement | undefined;
      if (btn) {
        const btnCenter = btn.offsetLeft + btn.offsetWidth / 2;
        const target = btnCenter - container.clientWidth / 2;
        container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
      }
    }
    trackEvent("market_filter_apply", {
      filter_type: "category",
      filter_value: category,
    });
  };

  // 滚动分类标签
  const scrollCategories = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // 判断是否有非默认的筛选条件
  const hasActiveFilters = useMemo(() => {
    return (
      sortBy !== "24hr_volume" ||
      frequency !== "daily" ||
      status !== "active" ||
      searchValue !== ""
    );
  }, [sortBy, frequency, status, searchValue]);

  // 清除所有筛选
  const clearFilters = () => {
    setSortBy("24hr_volume");
    setFrequency("daily");
    setStatus("active");
    setSearchValue("");
    if (!isSidebarVariant) {
      setIsSearchExpanded(false);
    }
    setHideSports(false);
    setHideCrypto(false);
    setHideEarnings(false);
    // 通知父组件重置
    onSearchChange?.("");
    const defaultSort = SORT_TO_API["24hr_volume"];
    onSortChange?.(defaultSort);
    onFrequencyChange?.("daily");
    onStatusChange?.("active");
    trackEvent("market_filter_apply", {
      filter_type: "clear_all",
      filter_value: "",
    });
    trackEvent("market_sort_change", { sort_by: "24hr_volume" });
  };

  const handleBookmarkClick = () => {
    const next = !isCollected;
    setIsCollected(next);
    onCollectedChange?.(next);
  };

  // 下拉选择组件
  const DropdownSelect = ({
    label,
    value,
    options,
    onChange,
    dropdownKey,
  }: {
    label: string;
    value: string;
    options: { value: string; label: string; icon?: string }[];
    onChange: (value: string) => void;
    dropdownKey: string;
  }) => {
    const isOpen = openDropdown === dropdownKey;
    const selectedOption = options.find((opt) => opt.value === value);

    return (
      <div className="relative">
        <button
          onClick={() => setOpenDropdown(isOpen ? null : dropdownKey)}
          className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-[var(--border)] rounded-md hover:bg-[var(--bg-secondary)] transition-colors"
        >
          <span className="text-[var(--text-secondary)]">{label}:</span>
          <span className="text-[var(--text-primary)] font-medium">
            {selectedOption?.label}
          </span>
          <ChevronDown
            size={12}
            className={`text-[var(--text-secondary)] transition-transform sm:w-3.5 sm:h-3.5 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 min-w-[140px] bg-[var(--bg-card)] border border-[var(--border)] rounded-md shadow-lg z-50 py-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpenDropdown(null);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-secondary)] transition-colors flex items-center gap-2 ${
                  value === option.value
                    ? "text-[var(--accent)]"
                    : "text-[var(--text-primary)]"
                }`}
              >
                {option.icon && <span>{option.icon}</span>}
                {option.label}
                {value === option.value && <span className="ml-auto">•</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // 复选框组件
  const CheckboxFilter = ({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  }) => (
    <label className="flex items-center gap-2 px-3 py-1.5 text-sm border border-[var(--border)] rounded-md cursor-pointer hover:bg-[var(--bg-secondary)] transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-offset-0 bg-transparent"
      />
      <span className="text-[var(--text-secondary)]">{label}</span>
    </label>
  );

  const shouldUseWideSearch = isSidebarVariant && !showCategories && showSearch;
  const actionButtonsContainerClass = shouldUseWideSearch
    ? "flex items-center gap-2 ml-auto flex-shrink-0"
    : "flex items-center gap-2";

  return (
    <div className="py-1 sm:my-4">
      {/* PC 端单行布局：分类标签居左，搜索/按钮居右；移动端两行：搜索在上，分类在下 */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:gap-3">
      {/* Row 1: Search input + filter/bookmark icons (mobile: always expanded search) */}
      <div className="flex items-center gap-2 lg:order-2 lg:flex-shrink-0">
        {/* Search input - always visible on mobile, collapsible on desktop */}
        {showSearch && (
          <div
            className={`relative flex items-center ${
              shouldUseWideSearch
                ? "flex-1 min-w-0 md:flex-none md:w-[68%] lg:w-[66%]"
                : "flex-1 lg:flex-none"
            }`}
          >
            {/* 移动端：始终显示输入框（用 lg:hidden 控制） */}
            <div className="flex lg:hidden items-center gap-1 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] pr-1 w-full">
              <div className="relative flex-1 min-w-0">
                <Search
                  size={14}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={t.common.search}
                  className="w-full py-2 pl-8 pr-2 bg-transparent text-[var(--text-primary)] focus:outline-none text-sm placeholder:text-[var(--text-secondary)]"
                />
              </div>
              {searchValue && (
                <button
                  onClick={() => {
                    setSearchValue("");
                    onSearchChange?.("");
                  }}
                  className="p-0.5 rounded hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* 桌面端：可折叠的搜索框 */}
            <div className="hidden lg:flex items-center">
              {isSearchExpanded || !showCategories ? (
                <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border)] pr-1">
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
                    />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder={t.common.search}
                      className={`${
                        shouldUseWideSearch ? "w-full" : "w-[140px]"
                      } py-2 pl-8 pr-2 bg-transparent text-[var(--text-primary)] focus:outline-none text-sm placeholder:text-[var(--text-secondary)]`}
                      onBlur={() => {
                        if (!searchValue && !shouldUseWideSearch && showCategories) {
                          setIsSearchExpanded(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setSearchValue("");
                          if (!shouldUseWideSearch && showCategories) {
                            setIsSearchExpanded(false);
                          }
                        }
                      }}
                    />
                  </div>
                  {searchValue && (
                    <button
                      onClick={() => {
                        setSearchValue("");
                        onSearchChange?.("");
                        searchInputRef.current?.focus();
                      }}
                      className="p-0.5 rounded hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsSearchExpanded(true)}
                  className="p-1.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <Search size={18} />
                </button>
              )}
            </div>
          </div>
        )}

        <div className={actionButtonsContainerClass}>
          {/* Advanced filter toggle */}
          {showFilter && (
            <button
              onClick={() => setIsAdvancedFilterOpen(!isAdvancedFilterOpen)}
              className={`p-1.5 rounded transition-colors ${
                isAdvancedFilterOpen
                  ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                  : "hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <SlidersHorizontal size={18} />
            </button>
          )}

          {/* Bookmark */}
          {showBookmark && (
            <button
              onClick={handleBookmarkClick}
              className={`p-1.5 rounded transition-colors ${
                isCollected
                  ? "text-[var(--accent)] hover:text-[var(--accent)]"
                  : "hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Bookmark
                size={18}
                fill={isCollected ? "currentColor" : "none"}
              />
            </button>
          )}

        </div>
      </div>

      {/* Row 2: Category tags */}
      {showCategories && (
        <div className="flex items-center gap-2 mt-2 lg:mt-0 lg:order-1 lg:flex-1 lg:min-w-0">
          {/* Left arrow */}
          <button
            onClick={() => scrollCategories("left")}
            className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Scrollable category tags */}
          <div
            ref={scrollContainerRef}
            className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide"
          >
            {categories.map((category, index) => (
              <button
                key={index}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 whitespace-nowrap text-xs sm:text-sm transition-all ${
                  activeCategory === category
                    ? "font-semibold bg-[var(--accent)] text-[var(--bg-primary)] rounded-md"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                onClick={() => handleCategoryClick(category)}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Right arrow */}
          <button
            onClick={() => scrollCategories("right")}
            className="p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex-shrink-0"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}
      </div>

      {/* Advanced filter panel */}
      {isAdvancedFilterOpen && (
        <div className="mt-2 pt-2 sm:mt-3 sm:pt-3 border-t border-[var(--border)]">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Sort by dropdown */}
            <DropdownSelect
              label={t.common.sortBy}
              value={sortBy}
              options={SORT_OPTIONS}
              onChange={(val) => {
                setSortBy(val);
                const apiSort = SORT_TO_API[val];
                trackEvent("market_sort_change", { sort_by: val });
                if (apiSort) onSortChange?.(apiSort);
              }}
              dropdownKey="sort"
            />

            {/* Frequency dropdown */}
            {/* <DropdownSelect
              label={t.common.frequency}
              value={frequency}
              options={FREQUENCY_OPTIONS}
              onChange={(val) => {
                setFrequency(val);
                onFrequencyChange?.(val);
              }}
              dropdownKey="frequency"
            /> */}

            {/* Status dropdown */}
            {showStatus && (
              <DropdownSelect
                label={t.common.status}
                value={status}
                options={STATUS_OPTIONS}
                onChange={(val) => {
                  setStatus(val);
                  onStatusChange?.(val);
                  trackEvent("market_filter_apply", {
                    filter_type: "status",
                    filter_value: val,
                  });
                  // active -> true, resolved -> false
                  onActiveChange?.(val === "active");
                }}
                dropdownKey="status"
              />
            )}

            {/* Checkbox filters */}
            {/* <CheckboxFilter
              label={`${t.common.hide(t.market.sports)}?`}
              checked={hideSports}
              onChange={setHideSports}
            />

            <CheckboxFilter
              label={`${t.common.hide(t.market.crypto)}?`}
              checked={hideCrypto}
              onChange={setHideCrypto}
            />

            <CheckboxFilter
              label={`${t.common.hide(t.market.earnings)}?`}
              checked={hideEarnings}
              onChange={setHideEarnings}
            /> */}

            {/* Clear filters button - only show when filters are non-default */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {t.common.clearFilters}
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
