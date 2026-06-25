"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import SportsTagNav from "@/components/sports/SportsTagNav";

/**
 * 中文注释（关键修复说明）：
 * 1) Next.js 在预渲染阶段要求：任何使用 useSearchParams 的客户端组件，都必须处在 Suspense 边界内；
 * 2) 因此将原先直接使用 useSearchParams 的布局逻辑，拆到内部组件并放进 Suspense，
 *    避免构建阶段出现 missing-suspense-with-csr-bailout 报错。
 */
function SportsLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // 从 URL 参数获取 tag
  const tagFromUrl = searchParams.get("tag");
  const tagsFromUrl = searchParams.get("tags");

  const [selectedTagSlug, setSelectedTagSlug] = useState<string | null>(
    () => tagFromUrl || null
  );

  // URL 参数变化时同步状态
  useEffect(() => {
    setSelectedTagSlug(tagFromUrl || null);
  }, [tagFromUrl]);

  // tag 选择回调：导航到 /sports?tag=xxx&tags=xxx
  const handleTagSelect = useCallback(
    (slug: string | null, tagsChain?: string, displayName?: string) => {
      setSelectedTagSlug(slug);
      const nameParam = displayName
        ? `&name=${encodeURIComponent(displayName)}`
        : "";
      if (!slug) {
        router.push(`/sports`);
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
