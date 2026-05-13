"use client";

/**
 * 移动端 sheet 内嵌的交易面板。
 *
 * 接入：替换 components/sports/GamesView/index.tsx 内 4 处
 * "Trading disabled in embedded view" 占位 div。
 */

import TradingForm, { type TradingOutcome } from "./TradingForm";
import { useToast } from "@/components/ui/Toast";

interface Props {
  eventId: string | number | undefined;
  outcomes: TradingOutcome[];
  marketTitle?: string;
  marketSubtitle?: string;
  onClose?: () => void;
}

export default function MobileTradingPanel({
  eventId,
  outcomes,
  marketTitle,
  marketSubtitle,
  onClose,
}: Props) {
  const { success } = useToast();
  return (
    <div className="px-4 pb-4">
      <TradingForm
        compact
        eventId={eventId}
        outcomes={outcomes}
        marketTitle={marketTitle}
        marketSubtitle={marketSubtitle}
        onPlaced={(r) => {
          success(`Order accepted (${r.status})`);
          onClose?.();
        }}
      />
    </div>
  );
}
