"use client";

/**
 * Exact Score 标签页面板（从 SportsEventDetailView 拆出，机械搬运无修改）。
 */

import React from "react";
import type { SportsMarketItem } from "@/types/sports";
import { useTranslation } from "@/lib/i18n";
import { formatOutcomeProbabilityCents } from "@/utils/format";
import {
  getOutcomeLabel,
  sortOutcomesByOriginalIndex,
} from "@/lib/utils/outcomes";

interface ExactScorePanelProps {
  markets: SportsMarketItem[];
  selectedMarketId?: string;
  selectedOutcomeIdx?: number;
  onOutcomeClick: (item: SportsMarketItem, idx: number) => void;
}

const ExactScorePanel: React.FC<ExactScorePanelProps> = ({
  markets,
  selectedMarketId,
  selectedOutcomeIdx,
  onOutcomeClick,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {markets.map((item) => {
        const sorted = sortOutcomesByOriginalIndex(item.outcomes || []);
        const outcome0 = sorted[0];
        const outcome1 = sorted[1];
        const isThisMarket = selectedMarketId === item.marketId;
        const label = item.marketTitle.replace(/\s*\(.*?\)/, "").trim();
        const active0 = isThisMarket && selectedOutcomeIdx === 0;
        const active1 = isThisMarket && selectedOutcomeIdx === 1;
        return (
          <div
            key={item.marketId}
            className="border border-(--border) rounded-lg p-3 flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-(--text-primary) truncate">
                {label}
              </div>
              <div className="text-xs text-(--text-tertiary)">
                $0 {t.sports.game.vol}.
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => onOutcomeClick(item, 0)}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors min-w-[90px] border-2 border-(--border) ${
                  active0
                    ? "bg-[#3bab68] text-white border-[#3bab68]"
                    : "bg-(--bg-secondary) text-(--text-primary) hover:bg-(--bg-hover)"
                }`}
                style={
                  active0
                    ? undefined
                    : { boxShadow: "0 4px 0 0 rgba(0,0,0,0.1)" }
                }
              >
                {getOutcomeLabel(outcome0) || "YES"}{" "}
                <span className="font-bold">
                  {outcome0
                    ? formatOutcomeProbabilityCents(parseFloat(outcome0.price))
                    : "—"}
                </span>
              </button>
              <button
                onClick={() => onOutcomeClick(item, 1)}
                className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors min-w-[90px] border-2 border-(--border) ${
                  active1
                    ? "bg-[#e13737] text-white border-[#e13737]"
                    : "bg-(--bg-secondary) text-(--text-primary) hover:bg-(--bg-hover)"
                }`}
                style={
                  active1
                    ? undefined
                    : { boxShadow: "0 4px 0 0 rgba(0,0,0,0.1)" }
                }
              >
                {getOutcomeLabel(outcome1) || "NO"}{" "}
                <span className="font-bold">
                  {outcome1
                    ? formatOutcomeProbabilityCents(parseFloat(outcome1.price))
                    : "—"}
                </span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ExactScorePanel;
