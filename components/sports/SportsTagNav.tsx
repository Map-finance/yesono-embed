"use client";

/**
 * Sports Tag Navigation Component
 * 从 /api/tag 获取数据，显示 All Sports 菜单
 * Asian 作为 All Sports 第一项显示
 */

import { Radio, BarChartBig } from "lucide-react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NavItem } from "./Nav/NavItem";
import Drawer from "@/components/ui/Drawer";
import { useTranslation, useLocale } from "@/lib/i18n";
import { getTagTree } from "@/lib/services/homeService";
import { TagTreeNode } from "@/types/home";

export interface SportsTagNavProps {
  selectedTagSlug?: string | null;
  /** URL 中的 tags 链（如 "sports,soccer,gua-d1"），用于自动展开父标签 */
  tagsChain?: string | null;
  onTagSelect?: (
    slug: string | null,
    tagsChain?: string,
    displayName?: string
  ) => void;
}

export default function SportsTagNav(props: SportsTagNavProps) {
  const { selectedTagSlug, tagsChain, onTagSelect } = props;
  const { t } = useTranslation();
  const { locale } = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const [sportsTags, setSportsTags] = useState<TagTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [mobileDrawerTag, setMobileDrawerTag] = useState<TagTreeNode | null>(null);
  // 动态加载的子标签缓存 (slug -> children)
  const [dynamicChildren, setDynamicChildren] = useState<Record<string, TagTreeNode[]>>({});
  const [loadingChildren, setLoadingChildren] = useState<string | null>(null);

  // 加载 sports 标签数据
  useEffect(() => {
    const loadTags = async () => {
      setIsLoading(true);
      setDynamicChildren({});
      setExpandedTag(null);
      setMobileDrawerTag(null);
      try {
        // 获取 sports 下的标签树
        const tags = await getTagTree("sports", true);
        setSportsTags(tags);
      } catch (error) {
        console.error("[SportsTagNav] Failed to load tags:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTags();
  }, [locale]);

  // 判断标签是否可展开（有预加载children 或 type=SPORT）
  const isExpandable = (tag: TagTreeNode) => {
    return (tag.children && tag.children.length > 0) || tag.type === 'SPORT';
  };

  // 获取标签的子标签（预加载的 + 动态加载的）
  const getEffectiveChildren = (tag: TagTreeNode): TagTreeNode[] => {
    if (tag.children && tag.children.length > 0) return tag.children;
    return dynamicChildren[tag.slug] || [];
  };

  // 动态加载子标签
  const loadChildTags = async (slug: string) => {
    if (dynamicChildren[slug]) return; // 已缓存
    setLoadingChildren(slug);
    try {
      const children = await getTagTree(slug, true);
      setDynamicChildren(prev => ({ ...prev, [slug]: children }));
    } catch (error) {
      console.error('[SportsTagNav] Failed to load child tags for', slug, error);
    } finally {
      setLoadingChildren(null);
    }
  };

  // 防止重复自动展开
  const autoExpandedRef = useRef<string | null>(null);

  // 当标签树加载完成且 selectedTagSlug 是子标签时，自动展开父标签并加载子标签
  useEffect(() => {
    if (isLoading || !selectedTagSlug || sportsTags.length === 0) return;
    // 已经展开过相同的 tag，不重复处理
    if (autoExpandedRef.current === selectedTagSlug) return;
    // 如果 selectedTagSlug 是顶级标签或 Asian/Live，无需展开
    if (selectedTagSlug === "__asian__" || selectedTagSlug === "__live__") return;
    if (sportsTags.some((t) => t.slug === selectedTagSlug)) return;

    // 从 tagsChain 中找到父标签（tagsChain 格式: "sports,soccer,gua-d1"）
    const chainSlugs = tagsChain?.split(",").filter(Boolean) || [];
    // 找到 selectedTagSlug 在 chain 中的位置，取其前一个作为父标签
    const selectedIdx = chainSlugs.indexOf(selectedTagSlug);
    let parentSlug: string | null = null;
    if (selectedIdx > 0) {
      parentSlug = chainSlugs[selectedIdx - 1];
    } else {
      // 尝试在 sportsTags 中找到包含 selectedTagSlug 的父标签
      for (const tag of sportsTags) {
        const children = getEffectiveChildren(tag);
        if (children.some((c) => c.slug === selectedTagSlug)) {
          parentSlug = tag.slug;
          break;
        }
      }
    }

    if (parentSlug && parentSlug !== "sports") {
      autoExpandedRef.current = selectedTagSlug;
      setExpandedTag(parentSlug);
      // 如果父标签的子标签还没加载，触发加载
      const parentTag = sportsTags.find((t) => t.slug === parentSlug);
      if (parentTag && (!parentTag.children || parentTag.children.length === 0) && !dynamicChildren[parentSlug]) {
        loadChildTags(parentSlug);
      }
    }
  }, [isLoading, selectedTagSlug, sportsTags, tagsChain, dynamicChildren]);

  // 处理标签展开/收起 + 选中
  const handleTagClick = (tag: TagTreeNode) => {
    if (isExpandable(tag)) {
      const willExpand = expandedTag !== tag.slug;
      setExpandedTag((prev) => (prev === tag.slug ? null : tag.slug));
      // 如果展开且是 SPORT 类型且没有预加载 children，动态加载
      if (willExpand && tag.type === 'SPORT' && (!tag.children || tag.children.length === 0)) {
        loadChildTags(tag.slug);
      }
      // 父级选项同样可选中，传递 tags 链
      onTagSelect?.(tag.slug, `sports,${tag.slug}`, tag.name);
    } else {
      // 没有子标签，直接选中，传递 tags 链
      onTagSelect?.(tag.slug, `sports,${tag.slug}`, tag.name);
    }
  };

  // 处理子标签点击
  const handleChildTagClick = (parentTag: TagTreeNode, child: TagTreeNode) => {
    onTagSelect?.(
      child.slug,
      `sports,${parentTag.slug},${child.slug}`,
      child.name
    );
    setMobileDrawerTag(null);
  };

  // 移动端打开 Drawer
  const handleMobileTagClick = (tag: TagTreeNode) => {
    if (isExpandable(tag)) {
      // 如果是 SPORT 类型且没有缓存 children，先加载
      if (tag.type === 'SPORT' && (!tag.children || tag.children.length === 0) && !dynamicChildren[tag.slug]) {
        loadChildTags(tag.slug);
      }
      setMobileDrawerTag(tag);
    } else {
      onTagSelect?.(tag.slug, undefined, tag.name);
    }
  };

  // 获取 children 列表
  const getChildrenList = (tag: TagTreeNode) => {
    return getEffectiveChildren(tag);
  };

  // 在 All Sports 顶部插入 Asian 项
  const sportsTagsWithAsian = useMemo(() => {
    const asianItem: TagTreeNode = {
      id: -1,
      name: t.sports.nav.asian,
      slug: "__asian__",
      count: undefined,
      children: [],
    };
    return [asianItem, ...sportsTags];
  }, [sportsTags, t.sports.nav.asian]);

  // 判断菜单是否激活
  const isMenuActive = useCallback(
    (menu: "live" | "futures") => {
      if (menu === "live") return pathname === "/sports/live";
      if (menu === "futures") return pathname?.startsWith("/sports/futures");
      return false;
    },
    [pathname]
  );

  // 判断标签是否选中
  const isTagActive = useCallback(
    (slug: string) => {
      return selectedTagSlug === slug;
    },
    [selectedTagSlug]
  );

  // 判断父标签是否有子标签被选中
  const isParentTagActive = useCallback(
    (tag: TagTreeNode) => {
      // 父标签本身被选中（包括 Asian 的 __asian__ slug）
      if (selectedTagSlug === tag.slug) return true;
      // 检查预加载的子标签
      if (tag.children) {
        for (const child of tag.children) {
          if (selectedTagSlug === child.slug) return true;
        }
      }
      // 检查动态加载的子标签
      const dynChildren = dynamicChildren[tag.slug];
      if (dynChildren) {
        for (const child of dynChildren) {
          if (selectedTagSlug === child.slug) return true;
        }
      }
      // 子标签尚未加载时，通过 tagsChain 判断（如 "sports,soccer,gua-d1" 中 soccer 是 gua-d1 的父标签）
      if (tagsChain && selectedTagSlug) {
        const chainSlugs = tagsChain.split(",").filter(Boolean);
        const tagIdx = chainSlugs.indexOf(tag.slug);
        const selectedIdx = chainSlugs.indexOf(selectedTagSlug);
        if (tagIdx >= 0 && selectedIdx > tagIdx) return true;
      }
      return false;
    },
    [selectedTagSlug, dynamicChildren, tagsChain]
  );

  return (
    <div className="flex md:flex-col max-md:items-center gap-2 pb-1">
      {/* Live 按钮 */}
      {/* <NavItem
        type="button"
        onClick={() => onTagSelect?.("__live__")}
        active={selectedTagSlug === "__live__"}
        icon={<Radio className="w-5 h-5" />}
        label={t.sports.nav.live}
        className="flex-col md:flex-row"
      /> */}

      {/* Futures 链接 */}
      {/* <NavItem
        type="link"
        href="/sports/futures/nfl"
        onClick={() => {}}
        active={isMenuActive("futures")}
        icon={<BarChartBig className="w-5 h-5" />}
        label={t.sports.nav.futures}
        className="flex-col md:flex-row"
      /> */}

      {/* <div className="h-6 w-[1px] bg-[--border] flex-shrink-0 md:h-[1px] md:w-full"></div> */}

      {/* All Sports 标题 */}
      <h3 className="px-3 py-1.5 text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide m-0 hidden md:block">
        {t.sports.nav.allSports}
      </h3>

      {/* 加载状态 */}
      {isLoading && (
        <div className="px-3 py-2 text-sm text-[var(--text-tertiary)]">
          {t.common.loading}
        </div>
      )}

      {/* Sports 标签列表（Asian 在最前） */}
      {!isLoading &&
        sportsTagsWithAsian.map((tag) => {
          const isExpanded = expandedTag === tag.slug;
          const hasChildren = isExpandable(tag);
          const childrenList = getChildrenList(tag);

          return (
            <div key={tag.id} className="md:block">
              {/* 桌面端 */}
              <div className="hidden md:block">
                <NavItem
                  type="button"
                  onClick={() => handleTagClick(tag)}
                  active={isParentTagActive(tag)}
                  // icon={tag.slug === "soccer" ? "⚽" : "🏆"}
                  label={tag.name}
                  badge={tag.count ? tag.count : undefined}
                  expanded={hasChildren ? isExpanded : undefined}
                  className="flex-col md:flex-row"
                />

                {/* 桌面端展开的子标签 */}
                {hasChildren && (
                  <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out ${
                      isExpanded
                        ? "max-h-[2000px] opacity-100"
                        : "max-h-0 opacity-0"
                    }`}
                  >
                    {loadingChildren === tag.slug ? (
                      <div className="px-3 py-2 pl-7 text-sm text-[var(--text-tertiary)]">
                        {t.common.loading}
                      </div>
                    ) : (
                      <ul className="flex flex-col gap-1 mt-1 list-none pl-7">
                        {childrenList.map((child) => (
                          <NavItem
                            key={child.id}
                            type="button"
                            onClick={() =>
                              handleChildTagClick(tag, child)
                            }
                            active={isTagActive(child.slug)}
                            label={child.name}
                            badge={child.count ? child.count : undefined}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* 移动端 */}
              <div className="md:hidden">
                <NavItem
                  type="button"
                  onClick={() =>
                    hasChildren
                      ? handleMobileTagClick(tag)
                      : onTagSelect?.(tag.slug, undefined, tag.name)
                  }
                  active={isParentTagActive(tag)}
                  icon={tag.slug === "soccer" ? "⚽" : "🏆"}
                  label={tag.name}
                  className="flex-col"
                />
              </div>
            </div>
          );
        })}

      {/* 移动端抽屉 */}
      <Drawer
        isOpen={mobileDrawerTag !== null}
        onClose={() => setMobileDrawerTag(null)}
        title={mobileDrawerTag?.name}
        className="md:hidden"
      >
        <ul className="pb-3">
          {/* All 选项：选中父级标签本身 */}
          {mobileDrawerTag && (
            <li>
              <button
                onClick={() => {
                  onTagSelect?.(
                    mobileDrawerTag.slug,
                    `sports,${mobileDrawerTag.slug}`,
                    mobileDrawerTag.name
                  );
                  setMobileDrawerTag(null);
                }}
                className={`block w-full text-left px-6 py-3 transition-colors font-medium ${
                  isTagActive(mobileDrawerTag.slug)
                    ? "bg-[var(--bg-secondary)] text-[var(--accent)]"
                    : "hover:bg-[var(--bg-hover)]"
                }`}
              >
                {t.common.all}
              </button>
            </li>
          )}
          {mobileDrawerTag &&
            getChildrenList(mobileDrawerTag).map((child) => (
              <li key={child.id}>
                <button
                  onClick={() =>
                    handleChildTagClick(mobileDrawerTag, child)
                  }
                  className={`block w-full text-left px-6 py-3 transition-colors ${
                    isTagActive(child.slug)
                      ? "bg-[var(--bg-secondary)] text-[var(--accent)]"
                      : "hover:bg-[var(--bg-hover)]"
                  }`}
                >
                  <span>{child.name}</span>
                  {child.count && (
                    <span className="ml-2 text-xs text-[var(--text-tertiary)]">
                      ({child.count})
                    </span>
                  )}
                </button>
              </li>
            ))}
        </ul>
      </Drawer>
    </div>
  );
}
