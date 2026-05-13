"use client";

/**
 * CryptoRelatedSidebar - Crypto 详情页右侧相关推荐侧栏（mock 数据）。
 * 从 app/crypto/[id]/page.tsx 拆出，机械搬运无修改。
 */

import React from "react";

const CryptoRelatedSidebar: React.FC = () => {
  return (
    <div className="col-span-12 lg:col-span-4 pt-8">
      <div className="sticky top-[calc(120px+2rem)] max-h-[calc(100vh-var(--topbar-height))] overflow-y-auto flex flex-col gap-8 py-8 scrollbar-hide">
        {/* 相关推荐 */}
        <div className="pt-4 border-t border-(--border)">
          <div className="flex overflow-x-auto gap-3 mb-6 scrollbar-hide">
            {["All", "Crypto", "Bitcoin", "Crypto Prices"].map((tab) => (
              <button
                key={tab}
                className={`text-[12px] font-bold whitespace-nowrap px-4 py-2 rounded-full transition-all ${
                  tab === "All"
                    ? "bg-(--bg-hover) text-(--text-primary)"
                    : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-secondary)"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {[
              {
                q: "Will Gold close at $3,200 or more at the end of 2025?",
                p: "100%",
                img: "https://images.unsplash.com/photo-1589118949245-7d38baf380d6?w=100&h=100&fit=crop",
              },
              {
                q: "Will inflation reach more than 3% in 2025?",
                p: "6%",
                img: "https://images.unsplash.com/photo-1589118949245-7d38baf380d6?w=100&h=100&fit=crop",
              },
              {
                q: "Will inflation reach more than 3% in 2025?",
                p: "19%",
                img: "https://images.unsplash.com/photo-1589118949245-7d38baf380d6?w=100&h=100&fit=crop",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-4 group cursor-pointer"
              >
                <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-(--border) group-hover:border-(--text-secondary) transition-all">
                  <img
                    src={item.img}
                    className="w-full h-full object-cover"
                    alt="related"
                  />
                </div>
                <div className="flex-1">
                  <h4 className="text-[14px] font-bold text-(--text-secondary) group-hover:text-(--text-primary) leading-tight line-clamp-2 transition-colors">
                    {item.q}
                  </h4>
                </div>
                <span className="text-[15px] font-black text-(--text-primary)">
                  {item.p}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoRelatedSidebar;
