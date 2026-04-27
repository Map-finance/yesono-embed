"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { X, TrendingUp, Search } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/50 z-[150] transition-opacity duration-300 lg:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 bottom-0 w-[280px] bg-[var(--bg-primary)] z-[200] transform transition-transform duration-300 ease-out lg:hidden overflow-y-auto ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <span className="text-lg font-semibold text-[var(--text-primary)]">
            {t.common.menu}
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-[var(--bg-secondary)] transition-colors"
          >
            <X size={20} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        <nav className="p-4 flex flex-col gap-2">
          <Link
            href="/trending"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
          >
            <TrendingUp size={18} />
            {t.common.nav.trending ?? "Trending"}
          </Link>
          <Link
            href="/search"
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
          >
            <Search size={18} />
            {t.common.search ?? "Search"}
          </Link>
        </nav>

        <div className="h-20" />
      </div>
    </>
  );
}
