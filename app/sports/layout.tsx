"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import SportsTagNav from "@/components/sports/SportsTagNav";

/**
 * 中文注释（关键修复说明）：
 * 1) Next.js 在预渲染阶段要求：任何使用 useSearchParams 的客户端组件，都必须处在 Suspense 边界内；
 * 2) /sports/live 虽然页面本身只是跳转，但仍会先渲染 /sports 的 layout；
 * 3) 因此将原先直接使用 useSearchParams 的布局逻辑，拆到内部组件并放进 Suspense，
 *    避免构建阶段出现 missing-suspense-with-csr-bailout 报错。
 */
function SportsLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // 从 URL 参数获取 tag
  const tagFromUrl = searchParams.get("tag");
  const tagsFromUrl = searchParams.get("tags");
  const eventFromUrl = searchParams.get("event");

  const [selectedTagSlug, setSelectedTagSlug] = useState<string | null>(() => {
    if (tagFromUrl === "live") return "__live__";
    if (tagFromUrl === "asian") return "__asian__";
    if (tagFromUrl) return tagFromUrl;
    // 有 event 参数但没有 tag 时，不默认选中 asian（等待事件数据加载后更新）
    if (eventFromUrl) return null;
    return "__asian__";
  });

  // URL 参数变化时同步状态
  useEffect(() => {
    if (tagFromUrl === "live") {
      setSelectedTagSlug("__live__");
    } else if (tagFromUrl === "asian") {
      setSelectedTagSlug("__asian__");
    } else if (tagFromUrl) {
      setSelectedTagSlug(tagFromUrl);
    }
  }, [tagFromUrl]);

  // tag 选择回调：导航到 /sports?tag=xxx&tags=xxx
  const handleTagSelect = useCallback(
    (slug: string | null, tagsChain?: string, displayName?: string) => {
      setSelectedTagSlug(slug);
      const nameParam = displayName
        ? `&name=${encodeURIComponent(displayName)}`
        : "";
      if (!slug || slug === "__asian__") {
        router.push(`/sports?tag=asian${nameParam}`);
      } else if (slug === "__live__") {
        router.push(`/sports?tag=live${nameParam}`);
      } else if (tagsChain) {
        router.push(
          `/sports?tag=${slug}&tags=${encodeURIComponent(tagsChain)}${nameParam}`
        );
      } else {
        router.push(`/sports?tag=${slug}${nameParam}`);
      }
    },
    [router]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 mx-auto gap-4 w-full max-w-[1400px] block md:flex">
        {/* 左侧导航栏 - 所有 /sports 页面统一显示 */}
        <div className="py-2 overflow-y-auto overflow-x-hidden scrollbar-hide static md:sticky w-full md:w-40 shrink-0 max-md:overflow-x-auto max-md:w-full max-md:h-auto max-md:py-2 max-md:px-2 max-md:border-b max-md:border-(--border) top-[120px] h-auto md:h-[calc(100vh-120px)]">
          <SportsTagNav
            selectedTagSlug={selectedTagSlug}
            tagsChain={tagsFromUrl}
            onTagSelect={handleTagSelect}
          />
        </div>

        {/* 右侧内容区域 */}
        <div className="py-2 flex-1 min-w-0 max-md:px-4 max-md:py-4">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function SportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col h-full">
          <div className="flex-1 mx-auto gap-4 w-full max-w-[1400px] block md:flex">
            <div className="py-2 overflow-y-auto overflow-x-hidden scrollbar-hide static md:sticky w-full md:w-40 shrink-0 max-md:overflow-x-auto max-md:w-full max-md:h-auto max-md:py-2 max-md:px-2 max-md:border-b max-md:border-(--border) top-[120px] h-auto md:h-[calc(100vh-120px)]" />
            <div className="py-2 flex-1 min-w-0 max-md:px-4 max-md:py-4">
              {children}
            </div>
          </div>
        </div>
      }
    >
      <SportsLayoutContent>{children}</SportsLayoutContent>
    </Suspense>
  );
}
