"use client";

/**
 * OutcomeBottomBuyBar - Outcome 详情页底部固定的 Buy 按钮 / 已结算状态条。
 * 从 page.tsx 拆出，机械搬运无修改。
 */

import React from "react";
import { useTranslation } from "@/lib/i18n";
import type { SettlementDisplay } from "@/lib/utils/settlementResult";

interface OutcomeBottomBuyBarProps {
  isResolved: boolean;
  resolvedOutcome?: string;
  /** 结算结果五态展示（YES 侧赔付比例归一）；null 时回退到 resolvedOutcome 文案 */
  settlementDisplay?: SettlementDisplay | null;
  /** 已截止但未结算：展示"等待结算"中间态、禁止下单 */
  tradingEnded?: boolean;
  yesLabel: string;
  noLabel: string;
  yesPrice: string;
  noPrice: string;
  onBuyClick: (side: "yes" | "no") => void;
}

const OutcomeBottomBuyBar: React.FC<OutcomeBottomBuyBarProps> = ({
  isResolved,
  resolvedOutcome,
  settlementDisplay,
  tradingEnded,
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
        settlementDisplay ? (
          <div
            className="py-2.5 rounded-lg text-center text-sm font-semibold border"
            style={{
              color: settlementDisplay.accent,
              backgroundColor: settlementDisplay.bg,
              borderColor: settlementDisplay.border,
            }}
          >
            {t.market.resolved}: {settlementDisplay.label}
          </div>
        ) : (
          <div className="py-2.5 rounded-lg text-center text-sm font-semibold bg-[rgba(59,130,246,0.15)] text-[#3b82f6] border border-[rgba(59,130,246,0.3)]">
            {t.market.resolved}: {resolvedOutcome || t.market.common.yes}
          </div>
        )
      ) : tradingEnded ? (
        <div className="py-2.5 rounded-lg text-center text-sm font-semibold bg-[rgba(107,114,128,0.12)] text-(--text-secondary) border border-[rgba(107,114,128,0.25)]">
          {t.market.settlement.awaiting}
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
