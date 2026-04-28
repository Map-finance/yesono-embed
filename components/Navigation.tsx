"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { TrendingUp, Sparkles } from "lucide-react";
import { useNavigation } from "@/lib/hooks/useNavigation";
import { NavigationItem } from "@/types/home";

/**
 * Navigation组件
 * 固定项: Trending, Breaking, New
 * 动态项: 从 API 获取
 */

// 固定导航项配置
const FIXED_NAV_ITEMS = [
  { id: -1, label: "Trending", slug: "trending", icon: "TrendingUp", path: "/trending" },
  { id: -3, label: "New", slug: "new", icon: "Sparkles", path: "/trending/new" },
];

// 固定项的 slug 列表（用于过滤 API 返回的重复项）
const FIXED_SLUGS = FIXED_NAV_ITEMS.map(item => item.slug.toLowerCase());

// 图标映射
const iconMap: Record<string, React.ReactNode> = {
  TrendingUp: <TrendingUp size={16} />,
  Sparkles: <Sparkles size={16} />,
};

const Navigation: React.FC = () => {
  const pathname = usePathname();
  const { dynamicItems: dynamicNavItems, isLoading } = useNavigation();

  // 合并固定项和动态项（过滤重复）
  const allNavItems = useMemo(() => {
    // 固定项
    const fixedItems = FIXED_NAV_ITEMS.map(item => ({
      id: item.id,
      label: item.label,
      slug: item.slug,
      path: item.path,
      icon: item.icon,
      isFixed: true,
    }));

    // 动态项（过滤掉与固定项重复的 slug）
    const dynamicItems = dynamicNavItems
      .filter(item => !FIXED_SLUGS.includes(item.slug.toLowerCase()))
      .map(item => {
        // sport slug 特殊处理，路由到 /sports?tag=asian
        const path = item.slug?.toLowerCase() === 'sports' 
          ? '/sports?tag=asian' 
          : `/trending/${item.slug}`;
        return {
          id: item.id,
          label: item.label,
          slug: item.slug,
          path,
          icon: undefined,
          isFixed: false,
        };
      });

    return [...fixedItems, ...dynamicItems];
  }, [dynamicNavItems]);

  return (
    <div className="max-w-[1400px] mx-auto px-3 sm:px-5">
      <nav className="flex items-center gap-1 py-2 overflow-x-auto scrollbar-hide -mx-3 sm:-mx-5 px-3 sm:px-5">
        {allNavItems.map((item) => {
          const isActive =
            item.path === pathname ||
            (item.path === "/trending" && pathname === "/") ||
            pathname.startsWith(item.path);

          return (
            <Link
              key={item.id}
              href={item.path}
              className={`flex items-center gap-2 px-4 py-2 rounded-md whitespace-nowrap transition-all ${
                isActive
                  ? "font-semibold text-(--accent) bg-[rgba(255,214,8,0.1)]"
                  : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-secondary)"
              }`}
            >
              {item.icon && iconMap[item.icon]}
              {item.label}
            </Link>
          );
        })}
        
        {/* 加载占位符 */}
        {isLoading && (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={`skeleton-${i}`}
                className="h-9 w-20 rounded-md bg-(--bg-secondary) animate-pulse"
              />
            ))}
          </>
        )}
      </nav>
    </div>
  );
};

export default Navigation;
