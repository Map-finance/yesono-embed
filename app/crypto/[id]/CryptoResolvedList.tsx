"use client";

/**
 * CryptoResolvedList - Crypto 详情页 "View Resolved" 可折叠区块。
 * 从 app/crypto/[id]/page.tsx 拆出，机械搬运无修改。
 */

import React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { resolvedOutcomes } from "../mockData";

interface CryptoResolvedListProps {
  showResolved: boolean;
  onToggle: () => void;
}

const CryptoResolvedList: React.FC<CryptoResolvedListProps> = ({
  showResolved,
  onToggle,
}) => {
  const { t } = useTranslation();

  return (
    <div className="mt-8">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 text-[15px] font-bold text-white hover:text-slate-300 transition-colors px-2 py-4"
      >
        {showResolved ? t.market.hideResolved : t.market.viewResolved}
        {showResolved ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {showResolved && (
        <div className="mt-2 transition-all duration-300 border-t border-slate-800/30">
          {/* 1. 移除了这里的 divide-y，改为 flex-col */}
          <div className="flex flex-col">
            {resolvedOutcomes.map((item, index) => (
              // 2. 新增外层 Wrapper：专门负责画底部的直线 (border-b)
              // last:border-0 确保最后一个没有线条
              <div
                key={index}
                className="border-b border-slate-800/30 last:border-0 px-2" // px-2 给左右留白，让线和圆角对齐更好看
              >
                {/* 3. 内层 Item：负责圆角背景和悬浮效果 */}
                {/* 添加了 my-1 (上下间距)，让圆角背景和上下直线之间有空隙 */}
                <div className="group flex items-center justify-between py-4 px-3 my-1 hover:bg-[rgb(37,52,69)] transition-all duration-100 cursor-pointer rounded-lg">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 text-[15px] font-bold w-4 text-center">
                        {item.trend === "up"
                          ? "↑"
                          : item.trend === "down"
                            ? "↓"
                            : ""}
                      </span>
                      <span className="text-[17px] font-bold text-white leading-none group-hover:underline underline-offset-[5px] decoration-1 transition-all">
                        {item.label}
                      </span>
                    </div>
                    <div className="text-[12px] text-slate-500 font-bold ml-7">
                      {item.vol} {t.common.volume}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pr-2">
                    <span className="text-[15px] font-bold text-white">
                      Yes
                    </span>
                    <div className="w-5 h-5 rounded-full bg-[#10b981] flex items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="w-3 h-3 text-white"
                        stroke="currentColor"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CryptoResolvedList;
