"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

interface GoToLiveMarketButtonProps {
  /** 当前处于 LIVE 状态的市场 slug;有值则可点击跳转,无值则展示为 disabled */
  liveMarketSlug?: string;
}

/**
 * 跳转到"当前 LIVE 市场"的按钮。
 * 用户在浏览历史/已结算市场时,该按钮把他们带回该 event 仍在交易中的那一档。
 *
 * 复用于 LivePriceHeader(K线图)与 MarketChart(概率图)。
 */
const DEFAULT_TEXT = {
  goToLiveMarket: "Go to live market",
  liveButton: "Live",
};

function getMarketRouteSuffix(pathname: string) {
  const match = pathname.match(/^\/market\/[^/]+(\/.*)?$/);
  return match?.[1] ?? "";
}

export default function GoToLiveMarketButton({
  liveMarketSlug,
}: GoToLiveMarketButtonProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const text = (t.market as any).livePriceHeader ?? DEFAULT_TEXT;
  const routeSuffix = getMarketRouteSuffix(pathname);

  if (liveMarketSlug) {
    return (
      <Link
        href={`/market/${liveMarketSlug}${routeSuffix}`}
        className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#1f2937]/50 hover:bg-[#374151]/50 rounded-full transition-colors border border-[rgba(255,255,255,0.1)]"
      >
        <div className="relative flex items-center justify-center w-3 h-3">
          <div className="absolute inset-0 rounded-full bg-[#FF453A]/40"></div>
          <div className="absolute inset-0 rounded-full bg-[#FF453A] animate-ping opacity-75"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF453A] relative z-10"></div>
        </div>
        <span className="text-sm font-semibold text-white sm:hidden">
          {text.liveButton}
        </span>
        <span className="hidden sm:inline text-sm font-semibold text-white">
          {text.goToLiveMarket}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-gray-400"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Link>
    );
  }

  return (
    <button
      disabled
      className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#1f2937]/30 rounded-full border border-[rgba(255,255,255,0.1)] opacity-50 cursor-not-allowed"
    >
      <div className="relative flex items-center justify-center w-3 h-3">
        <div className="absolute inset-0 rounded-full bg-[#FF453A]/40"></div>
        <div className="w-1.5 h-1.5 rounded-full bg-[#FF453A] relative z-10"></div>
      </div>
      <span className="text-sm font-semibold text-white sm:hidden">
        {text.liveButton}
      </span>
      <span className="hidden sm:inline text-sm font-semibold text-white">
        {text.goToLiveMarket}
      </span>
    </button>
  );
}
