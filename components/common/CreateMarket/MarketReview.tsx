"use client";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import ProxyImage from "@/components/common/ProxyImage";

interface MarketReviewProps {
  onNext: (data: {}) => void;
  onPrevious: () => void;
  marketData: {
    prediction?: string;
    title?: string;
    endDate?: string;
    rules?: string;
    category?: string;
    token?: string;
    image?: string | null;
    proposerReward?: string;
    stakeDeposit?: string;
    sportType?: string;
    league?: string;
    team1?: string;
    team2?: string;
    matchTime?: string;
    marketType?: string;
  };
}

export default function MarketReview({
  onNext,
  onPrevious,
  marketData,
}: MarketReviewProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useTranslation();

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // 这里执行最终的创建市场请求
      // const response = await api.createMarket(marketData);

      // 模拟API请求
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // 创建成功
      onNext({});
    } catch (error) {
      console.error("Market creation failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto max-md:max-h-[calc(100vh-180px)]">
      {/* 市场卡片预览 */}
      <div className="p-3 rounded-md border border-[--border] bg-[--bg-secondary] text-sm flex gap-3 max-md:flex-col">
        <div className="size-40 rounded-md overflow-hidden max-md:w-full max-md:h-48">
          <ProxyImage
            src={marketData.image || "https://via.placeholder.com/100"}
            alt="Market"
            className="size-full"
          />
        </div>
        <div className="text-xs flex-1 font-semibold">
          <div className="text-sm">
            {marketData.title || t.market.create.marketTitle}
          </div>
          <div className="mt-2 text-[--text-secondary]">
            {t.market.create.createdBy}{" "}
            <span className="cursor-pointer underline text-[--text-primary]">
              Wang
            </span>{" "}
            {t.market.create.withOpinionAI}
          </div>
          <div className="flex gap-3 font-bold mt-2">
            <div className="flex-1 h-[40px] bg-[#3bab682a] text-[#3bab68] rounded-md text-center leading-[40px]">
              YES
            </div>
            <div className="flex-1 h-[40px] bg-[#e137372a] text-[#e13737] rounded-md text-center leading-[40px]">
              NO
            </div>
          </div>
          <div className="mt-2">
            <span className="text-[--text-secondary] mr-2">
              {t.market.create.endDate}:
            </span>
            <span>{marketData.endDate || t.market.create.notProvided}</span>
          </div>
          <div className="mt-1">
            <span className="text-[--text-secondary] mr-2">
              {t.market.create.category}:
            </span>
            <span>{marketData.category || t.market.create.notProvided}</span>
          </div>
          {marketData.marketType === "sports" && (
            <>
              <div className="mt-1">
                <span className="text-[--text-secondary] mr-2">
                  {t.market.create.sport}:
                </span>
                <span>
                  {marketData.sportType || t.market.create.notProvided}
                </span>
              </div>
              <div className="mt-1">
                <span className="text-[--text-secondary] mr-2">
                  {t.market.create.league}:
                </span>
                <span>{marketData.league || t.market.create.notProvided}</span>
              </div>
              <div className="mt-1">
                <span className="text-[--text-secondary] mr-2">
                  {t.market.create.teams}:
                </span>
                <span>
                  {marketData.team1 && marketData.team2
                    ? `${marketData.team1} vs ${marketData.team2}`
                    : t.market.create.notProvided}
                </span>
              </div>
            </>
          )}
          <div className="mt-1">
            <span className="text-[--text-secondary] mr-2">
              {t.market.create.selectedTradingToken}:
            </span>
            <span>{marketData.token || t.market.create.notProvided}</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-1 text-[var(--text-secondary)]">
          {t.market.rules}:
        </div>
        <div className="whitespace-pre-wrap text-[--text-secondary] p-2 border border-[--border] rounded-md bg-[--bg-secondary] text-sm max-h-[500px] overflow-y-auto">
          {marketData.rules}
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="flex justify-end mt-6 gap-3 max-md:flex-col-reverse">
        <button
          onClick={onPrevious}
          disabled={isLoading}
          className="text-[--text-secondary] text-sm underline hover:text-[--text-primary] disabled:opacity-50 max-md:w-full max-md:py-2"
        >
          {t.market.common.back}
        </button>
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="px-4 py-2 rounded-full bg-[--accent] text-sm text-black font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity max-md:w-full"
        >
          {isLoading
            ? t.market.create.creatingMarket
            : t.market.create.createMarketButton}
        </button>
      </div>
    </div>
  );
}

// 辅助组件：单项展示
function DetailItem({
  label,
  value,
  isMultiline = false,
}: {
  label: string;
  value?: string;
  isMultiline?: boolean;
}) {
  return (
    <div>
      <div className="text-[--text-secondary] mb-1">{label}</div>
      <div className={isMultiline ? "whitespace-pre-wrap" : ""}>
        {value || <span className="text-[--text-tertiary]">-</span>}
      </div>
    </div>
  );
}
