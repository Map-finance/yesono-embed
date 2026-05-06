"use client";

import React, { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { HelpCircle, Bell, Menu } from "lucide-react";
import SearchBox from "./SearchBox";
import UserMenu from "./user-menu";
import MobileSidebar from "./mobile/MobileSidebar";
import { useNavigation } from "@/lib/hooks/useNavigation";
import { Button } from "@/components/ui/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";
import { cn } from "@/lib/utils";

type NavItem = { label: string; path: string; icon?: string };

const Header: React.FC = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const { t } = useTranslation();
  const pathname = usePathname();

  const { data: navData, dynamicItems } = useNavigation();

  const guide = (t.common as any).howItWorksGuide as
    | {
        description?: string;
        intro?: string;
        step1Title?: string;
        step1Body?: string;
        step2Title?: string;
        step2Body?: string;
        step3Title?: string;
        step3Body?: string;
      }
    | undefined;

  const FIXED_NAV_ITEMS: NavItem[] = [
    { label: t.common.nav.trending ?? "Trending", path: "/trending", icon: "TrendingUp" },
    { label: t.common.nav.new ?? "New", path: "/trending/new", icon: "Sparkles" },
  ];

  const navItems = useMemo((): NavItem[] => {
    if (!dynamicItems?.length && !navData?.length) return FIXED_NAV_ITEMS;
    const dynamic: NavItem[] = dynamicItems.map((item: any) => {
      const path =
        item.slug?.toLowerCase() === "sports"
          ? "/sports?tag=asian"
          : `/trending/${item.slug}`;
      return { label: item.label, path };
    });
    return [...FIXED_NAV_ITEMS, ...dynamic];
  }, [navData, dynamicItems, (t as any)]);

  // 路由高亮：取最长前缀匹配的 nav path（/trending/new 优先于 /trending）
  const activeNavPath = useMemo(() => {
    if (!pathname) return null;
    const candidates = navItems
      .map((item) => item.path.split("?")[0].split("#")[0])
      .filter((p) => pathname === p || pathname.startsWith(p + "/"));
    if (candidates.length === 0) return null;
    return candidates.reduce((a, b) => (a.length >= b.length ? a : b));
  }, [navItems, pathname]);

  // HowItWorks 弹窗 3 步骤数据
  const howItWorksSteps = useMemo(() => {
    if (!guide) return [];
    return [
      { title: guide.step1Title, body: guide.step1Body },
      { title: guide.step2Title, body: guide.step2Body },
      { title: guide.step3Title, body: guide.step3Body },
    ].filter((s) => s.title && s.body);
  }, [guide]);

  return (
    <header className="sticky top-0 z-100 bg-(--bg-primary)">
      <div className="border-b border-(--border)">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5">
          <div className="relative flex items-center justify-between py-2 sm:py-3 gap-2 sm:gap-5 h-auto sm:h-[68px]">
            <Link
              href="/"
              className="flex items-center gap-1.5 sm:gap-2 text-base sm:text-lg font-semibold shrink-0"
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" />
                <path
                  d="M2 17L12 22L22 17V12L12 17L2 12V17Z"
                  fill="currentColor"
                />
              </svg>
              <span className="hidden sm:inline">YesONo</span>
            </Link>

            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 z-10 w-[min(500px,36vw)]">
              <Suspense
                fallback={
                  <div className="h-10 w-full rounded-lg bg-(--bg-secondary) border border-(--border)" />
                }
              >
                <SearchBox className="w-full" />
              </Suspense>
            </div>

            <div className="hidden md:flex items-center gap-2 xl:gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsHowItWorksOpen(true)}
              >
                <HelpCircle />
                <span>{t.common.howItWorks}</span>
              </Button>
              <UserMenu />
            </div>

            <div className="lg:hidden flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-(--text-secondary)"
                aria-label="Notifications"
              >
                <Bell className="size-5" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full size-8 text-(--text-secondary)"
                onClick={() => setIsMobileSidebarOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="size-[18px]" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-(--border) overflow-visible">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 overflow-visible">
          <Suspense fallback={<div className="h-[42px]" />}>
            <nav className="flex items-center gap-1 h-[42px] overflow-x-auto">
              {navItems.map((item) => {
                const itemBase = item.path.split("?")[0].split("#")[0];
                const isActive = activeNavPath === itemBase;
                return (
                  <Button
                    key={item.path}
                    asChild
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "whitespace-nowrap",
                      isActive
                        ? "text-(--text-primary) bg-(--bg-secondary)"
                        : "text-(--text-secondary) hover:text-(--text-primary)"
                    )}
                  >
                    <Link
                      href={item.path}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  </Button>
                );
              })}
            </nav>
          </Suspense>
        </div>
      </div>

      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <Dialog open={isHowItWorksOpen} onOpenChange={setIsHowItWorksOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.common.howItWorks}</DialogTitle>
            <DialogDescription>
              {guide?.description ||
                "A prediction market for real-world events: create questions or trade outcomes."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {guide?.intro && (
              <p className="text-sm leading-6 text-(--text-primary)">
                {guide.intro}
              </p>
            )}

            {howItWorksSteps.length > 0 && (
              <ol className="space-y-3">
                {howItWorksSteps.map((step, i) => (
                  <li key={i} className="space-y-1">
                    <h3 className="text-sm font-semibold text-(--text-primary)">
                      {step.title}
                    </h3>
                    <p className="text-sm leading-6 text-(--text-secondary)">
                      {step.body}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Header;
