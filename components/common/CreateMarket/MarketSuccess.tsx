"use client";
import { CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface MarketSuccessProps {
  marketId?: string;
  eventSlug?: string;
  onGoToMarket?: () => void;
}

export default function MarketSuccess({
  marketId,
  eventSlug,
  onGoToMarket,
}: MarketSuccessProps) {
  const { t } = useTranslation();

  const handleGoToMarket = () => {
    if (onGoToMarket) {
      onGoToMarket();
    } else {
      // 优先使用 eventSlug 跳转
      const slug = eventSlug || marketId || 'new';
      window.location.href = `/market/${slug}`;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center max-md:py-8">
      {/* 成功图标 */}
      <div className="mb-6 max-md:mb-4">
        <CheckCircle2 size={60} className="text-[#079911] max-md:w-12 max-md:h-12" strokeWidth={1.5} />
      </div>

      {/* 行1：成功消息 */}
      <h2 className="text-xl font-bold mb-3 max-md:text-lg">
        {t.market.common.marketCreatedSuccess}
      </h2>

      {/* 行2：提示信息 */}
      <p className="text-(--text-secondary) mb-8 max-md:text-sm max-md:mb-6">
        {t.market.create.marketLiveMessage}
      </p>

      {/* 按钮 */}
      <button
        onClick={handleGoToMarket}
        className="px-3 py-1.5 rounded-full bg-(--accent) text-sm text-black font-medium hover:opacity-90 transition-opacity max-md:w-full"
      >
        {t.market.create.goToMarketDetail}
      </button>
    </div>
  );
}
