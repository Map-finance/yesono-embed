"use client";

/**
 * 赛事详情底部 4 个 Tab：Comments / Top Holders / Positions / Activity。
 * 从 SportsEventDetailView 拆出，机械搬运无修改。
 */

import React, { useState } from "react";
import { ChevronUp } from "lucide-react";
import { SportsEventDetail, getEventCommentMarketId } from "@/types/sports";
import type { PolymarketMarketResp } from "@/types/home";
import { useTranslation } from "@/lib/i18n";
import CommentSection from "@/components/common/CommentSection";
import ActivityFeed from "@/components/detail/ActivityFeed";
import TopHolders from "@/components/detail/TopHolders";

interface EventBottomTabsProps {
  eventData: SportsEventDetail;
  polymarketMarkets: PolymarketMarketResp[];
}

const EventBottomTabs: React.FC<EventBottomTabsProps> = ({
  eventData,
  polymarketMarkets,
}) => {
  const { t } = useTranslation();
  const [activeBottomTab, setActiveBottomTab] = useState(0);

  const bottomTabs = [
    t.market.commentsNumber ? t.market.commentsNumber(0) : "Comments",
    t.market.topHolders || "Top Holders",
    // 暂时隐藏「持仓盈亏」tab（如需恢复：放回此行 + 下方 Positions 块，并把 Activity 改回 index 3）
    // t.sports.detail.positions,
    t.market.activity || "Activity",
  ];

  return (
    <div className="mt-8">
      <div className="flex items-center gap-6 border-b border-(--border) mb-4">
        {bottomTabs.map((tab, idx) => (
          <button
            key={idx}
            onClick={() => setActiveBottomTab(idx)}
            className={`pb-3 text-sm font-medium transition-colors relative ${
              activeBottomTab === idx
                ? "text-(--text-primary)"
                : "text-(--text-secondary) hover:text-(--text-primary)"
            }`}
          >
            {tab}
            {activeBottomTab === idx && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-(--accent)" />
            )}
          </button>
        ))}
      </div>

      {/* Comments */}
      {activeBottomTab === 0 && (
        <CommentSection
          entityId={getEventCommentMarketId(eventData) || eventData.id}
        />
      )}

      {/* Top Holders */}
      {activeBottomTab === 1 && <TopHolders markets={polymarketMarkets} />}

      {/* Positions（暂时隐藏，连同 bottomTabs 里的对应项一起恢复） */}
      {/* {activeBottomTab === 2 && <Positions markets={polymarketMarkets} />} */}

      {/* Activity */}
      {activeBottomTab === 2 && (
        <ActivityFeed
          marketId={eventData.id}
          unionKey={eventData.slug}
          eventSlug={eventData.slug}
          eventId={eventData.id}
          markets={polymarketMarkets}
        />
      )}

      {/* 返回顶部 */}
      <div className="flex justify-center mt-6">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-(--bg-hover) text-sm text-(--text-secondary) hover:text-(--text-primary) transition-colors"
        >
          {t.common.backToTop} <ChevronUp size={16} />
        </button>
      </div>
    </div>
  );
};

export default EventBottomTabs;
