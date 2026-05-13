"use client";

/**
 * OutcomeBottomBuyBar - Outcome 详情页底部固定的 Buy 按钮 / 已结算状态条。
 * 从 page.tsx 拆出，机械搬运无修改。
 */

import React from "react";
import { useTranslation } from "@/lib/i18n";

interface OutcomeBottomBuyBarProps {
  isResolved: boolean;
  resolvedOutcome?: string;
  yesLabel: string;
  noLabel: string;
  yesPrice: string;
  noPrice: string;
  onBuyClick: (side: "yes" | "no") => void;
}

const OutcomeBottomBuyBar: React.FC<OutcomeBottomBuyBarProps> = ({
  isResolved,
  resolvedOutcome,
  yesLabel,
  noLabel,
  yesPrice,
  noPrice,
  onBuyClick,
}) => {
  const { t } = useTranslation();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-(--bg-card) border-t border-(--border) p-3 safe-area-bottom z-40">
      {isResolved ? (
        <div className="py-2.5 rounded-lg text-center text-sm font-semibold bg-[rgba(59,130,246,0.15)] text-[#3b82f6] border border-[rgba(59,130,246,0.3)]">
          {t.market.resolved}: {resolvedOutcome || t.market.common.yes}
        </div>
      ) : (
        <div className="flex gap-2.5">
          <button
            onClick={() => onBuyClick("yes")}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-[#22c55e] text-white active:opacity-80 transition-opacity"
          >
            {t.common.buy || "Buy"} {yesLabel} {yesPrice}
          </button>
          <button
            onClick={() => onBuyClick("no")}
            className="flex-1 py-2.5 rounded-lg text-sm font-bold bg-[#ef4444] text-white active:opacity-80 transition-opacity"
          >
            {t.common.buy || "Buy"} {noLabel} {noPrice}
          </button>
        </div>
      )}
    </div>
  );
};

export default OutcomeBottomBuyBar;
