"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export default function MobileBottomNav() {
  const { t } = useTranslation();
  const pathname = usePathname();

  if (pathname.includes("/outcome/")) {
    return null;
  }

  const navItems = [
    {
      label: t.common.home,
      path: "/trending",
      icon: Home,
      isActive: pathname === "/" || pathname.startsWith("/trending"),
    },
    {
      label: t.common.search,
      path: "/search",
      icon: Search,
      isActive: pathname === "/search",
    },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-[var(--bg-primary)] border-t border-[var(--border)]">
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
                item.isActive
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-secondary)]"
              }`}
            >
              <Icon size={20} className="mb-0.5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
