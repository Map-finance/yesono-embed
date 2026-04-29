"use client";

import React, { Suspense, useState, useMemo } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { HelpCircle, Bell } from "lucide-react";
import SearchBox from "./SearchBox";
import UserMenu from "./user-menu";
import MobileSidebar from "./mobile/MobileSidebar";
import { useNavigation } from "@/lib/hooks/useNavigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog";

type NavItem = { label: string; path: string; icon?: string };

const Header: React.FC = () => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const { t } = useTranslation();

  const { data: navData, dynamicItems } = useNavigation();

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
              <button
                onClick={() => setIsHowItWorksOpen(true)}
                className="hidden md:flex items-center gap-2 px-3 py-2 rounded-md bg-(--bg-secondary) text-(--text-primary) text-sm hover:bg-opacity-80 transition-colors"
              >
                <HelpCircle size={16} />
                <span>{t.common.howItWorks}</span>
              </button>
              <UserMenu />
            </div>

            <div className="lg:hidden flex items-center gap-2">
              <button className="p-2 rounded-full hover:bg-(--bg-secondary) transition-colors">
                <Bell size={20} className="text-(--text-secondary)" />
              </button>
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                className="w-8 h-8 rounded-full bg-(--bg-secondary) flex items-center justify-center hover:opacity-90 transition-opacity"
                aria-label="Open menu"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18px"
                  height="18px"
                  viewBox="0 0 18 18"
                  className="w-5 h-[18px] text-(--text-secondary)"
                >
                  <path
                    d="M15.75,9.75H2.25c-.414,0-.75-.336-.75-.75s.336-.75,.75-.75H15.75c.414,0,.75,.336,.75,.75s-.336,.75-.75,.75Z"
                    fill="currentColor"
                  />
                  <path
                    d="M15.75,4.5H2.25c-.414,0-.75-.336-.75-.75s.336-.75,.75-.75H15.75c.414,0,.75,.336,.75,.75s-.336,.75-.75,.75Z"
                    fill="currentColor"
                  />
                  <path
                    d="M15.75,15H2.25c-.414,0-.75-.336-.75-.75s.336-.75,.75-.75H15.75c.414,0,.75,.336,.75,.75s-.336,.75-.75,.75Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-(--border) overflow-visible">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 overflow-visible">
          <Suspense fallback={<div className="h-[42px]" />}>
            <nav className="flex items-center gap-4 h-[42px] overflow-x-auto">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className="text-sm text-(--text-secondary) hover:text-(--text-primary) whitespace-nowrap"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </Suspense>
        </div>
      </div>

      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <Dialog open={isHowItWorksOpen} onOpenChange={setIsHowItWorksOpen}>
        <DialogContent className="sm:max-w-lg bg-(--bg-card) border-(--border)">
          <DialogHeader>
            <DialogTitle className="text-(--text-primary)">
              {t.common.howItWorks}
            </DialogTitle>
            <DialogDescription className="text-(--text-secondary)">
              {t.common.howItWorksGuide?.description ||
                "A prediction market for real-world events: create questions or trade outcomes."}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-(--border) p-4">
            <p className="text-sm leading-6 text-(--text-secondary)">
              {t.common.howItWorksGuide?.intro ||
                "On YesONo, prices move in real time as people trade."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Header;
