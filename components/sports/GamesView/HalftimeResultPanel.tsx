"use client";

/**
 * Halftime Result 标签页面板（从 SportsEventDetailView 拆出，机械搬运无修改）。
 * 所有 markets 合并为一张单行卡片，左侧标题右侧多个按钮。
 */

import React from "react";
import type { SportsMarketItem } from "@/types/sports";
import { useTranslation } from "@/lib/i18n";
import { formatOutcomeProbabilityCents } from "@/utils/format";

interface HalftimeResultPanelProps {
  markets: SportsMarketItem[];
  selectedMarketId?: string;
  onOutcomeClick: (item: SportsMarketItem, idx: number) => void;
}

const HalftimeResultPanel: React.FC<HalftimeResultPanelProps> = ({
  markets,
  selectedMarketId,
  onOutcomeClick,
}) => {
  const { t } = useTranslation();

  if (markets.length === 0) return null;

  // 取第一个市场的标题作为卡片标题（去除括号内容），多个 market 各为一个按钮
  const cardTitle = markets[0].marketTitle
    .replace(/\s*\(.*?\)/, "")
    .trim()
    .replace(
      /halftime result/i,
      t.sports.detail.halftimeResult || "Halftime Result"
    );

  return (
    <div className="space-y-3">
      <div className="border border-(--border) rounded-lg p-3 flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-(--text-primary) truncate">
            {cardTitle}
          </div>
          <div className="text-xs text-(--text-tertiary)">
            $0 {t.sports.game.vol}.
          </div>
        </div>
        <div
          className="flex gap-2 flex-wrap shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {markets.map((item) => {
            const isActive = selectedMarketId === item.marketId;
            const outcome0 = item.outcomes?.find((o) => o.originalIndex === 0);
            const label = item.marketTitle.replace(/\s*\(.*?\)/, "").trim();
            const abbr = (() => {
              const words = label.split(/\s+/);
              return (words.find((w) => w.length > 2) || words[0] || "")
                .slice(0, 4)
                .toUpperCase();
            })();
            const price = outcome0
              ? formatOutcomeProbabilityCents(parseFloat(outcome0.price))
              : "—";
            return (
              <button
                key={item.marketId}
                onClick={() => onOutcomeClick(item, 0)}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors border-2 border-(--border) min-w-[80px] ${
                  isActive
                    ? "bg-[#d4a017] text-white border-[#d4a017]"
                    : "bg-(--bg-secondary) text-(--text-primary) hover:bg-(--bg-hover)"
                }`}
                style={
                  isActive
                    ? undefined
                    : { boxShadow: "0 4px 0 0 rgba(0,0,0,0.1)" }
                }
              >
                <span className="opacity-80">{abbr}</span>{" "}
                <span className="font-bold">{price}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default HalftimeResultPanel;
