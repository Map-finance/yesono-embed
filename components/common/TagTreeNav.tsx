'use client';

/**
 * TagTreeNav - 子标签树导航组件
 * 支持横向标签（如 politics, finance 页面）和纵向树形结构（如 /sports, /crypto 页面）
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { TagTreeNode } from '@/types/home';

interface TagTreeNavProps {
  tags: TagTreeNode[];
  baseUrl: string;
  isLoading?: boolean;
  layout?: 'horizontal' | 'vertical' | 'auto';
  showCount?: boolean;
  className?: string;
}

// 横向标签导航
const HorizontalNav: React.FC<{
  tags: TagTreeNode[];
  baseUrl: string;
  showCount?: boolean;
  pathname: string;
}> = ({ tags, baseUrl, showCount, pathname }) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-2">
      {tags.map((tag) => {
        const href = `${baseUrl}/${tag.slug}`;
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={tag.id}
            href={href}
            className={`px-4 py-2 rounded-full whitespace-nowrap text-sm transition-all ${
              isActive
                ? 'bg-(--accent) text-black font-medium'
                : 'bg-(--bg-secondary) text-(--text-secondary) hover:bg-(--bg-tertiary) hover:text-(--text-primary)'
            }`}
          >
            {tag.name}
            {showCount && tag.count !== undefined && (
              <span className="ml-1.5 opacity-70">({tag.count})</span>
            )}
          </Link>
        );
      })}
    </div>
  );
};

// 纵向树形导航
const VerticalNav: React.FC<{
  tags: TagTreeNode[];
  baseUrl: string;
  showCount?: boolean;
  pathname: string;
  level?: number;
}> = ({ tags, baseUrl, showCount, pathname, level = 0 }) => {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <ul className={`space-y-1 ${level > 0 ? 'ml-4 mt-1' : ''}`}>
      {tags.map((tag) => {
        const href = `${baseUrl}/${tag.slug}`;
        const isActive = pathname === href;
        const isParentActive = pathname.startsWith(`${href}/`);
        const hasChildren = tag.children && tag.children.length > 0;
        const isExpanded = expandedIds.has(tag.id) || isParentActive;

        return (
          <li key={tag.id}>
            <div className="flex items-center">
              {hasChildren && (
                <button
                  onClick={() => toggleExpand(tag.id)}
                  className="p-1 mr-1 rounded hover:bg-(--bg-secondary)"
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-(--text-secondary)" />
                  ) : (
                    <ChevronRight size={14} className="text-(--text-secondary)" />
                  )}
                </button>
              )}
              {!hasChildren && <div className="w-6" />}
              
              <Link
                href={href}
                className={`flex-1 px-3 py-1.5 rounded text-sm transition-all ${
                  isActive
                    ? 'bg-(--accent) text-black font-medium'
                    : isParentActive
                    ? 'text-(--accent)'
                    : 'text-(--text-secondary) hover:bg-(--bg-secondary) hover:text-(--text-primary)'
                }`}
              >
                {tag.name}
                {showCount && tag.count !== undefined && (
                  <span className="ml-1.5 opacity-70">({tag.count})</span>
                )}
              </Link>
            </div>

            {hasChildren && isExpanded && (
              <VerticalNav
                tags={tag.children!}
                baseUrl={baseUrl}
                showCount={showCount}
                pathname={pathname}
                level={level + 1}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
};

// 加载骨架屏：统一用 shadcn Skeleton，避免实色 bg-(--bg-secondary) 在深色页面显白
const LoadingSkeleton: React.FC<{ layout: 'horizontal' | 'vertical' }> = ({ layout }) => {
  if (layout === 'horizontal') {
    return (
      <div className="flex items-center gap-2 py-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton
          key={i}
          className="h-8 rounded"
          style={{ width: `${100 - i * 10}%` }}
        />
      ))}
    </div>
  );
};

const TagTreeNav: React.FC<TagTreeNavProps> = ({
  tags,
  baseUrl,
  isLoading = false,
  layout = 'auto',
  showCount = false,
  className = '',
}) => {
  const pathname = usePathname();

  // 自动检测布局类型
  const effectiveLayout = React.useMemo(() => {
    if (layout !== 'auto') return layout;
    
    // 如果任何标签有子节点，使用纵向布局
    const hasNestedChildren = tags.some(
      (tag) => tag.children && tag.children.length > 0
    );
    return hasNestedChildren ? 'vertical' : 'horizontal';
  }, [layout, tags]);

  if (isLoading) {
    return (
      <div className={className}>
        <LoadingSkeleton layout={effectiveLayout} />
      </div>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <nav className={className}>
      {effectiveLayout === 'horizontal' ? (
        <HorizontalNav
          tags={tags}
          baseUrl={baseUrl}
          showCount={showCount}
          pathname={pathname}
        />
      ) : (
        <VerticalNav
          tags={tags}
          baseUrl={baseUrl}
          showCount={showCount}
          pathname={pathname}
        />
      )}
    </nav>
  );
};

export default TagTreeNav;
