"use client";

/**
 * Multi-Option Card - 多选项卡片
 * 带有多个选项，每个选项有独立的 Yes/No 按钮
 */

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { Market } from "@/types/types";
import { formatPercentage } from "@/lib/utils/eventToMarket";
import ProxyImage from "@/components/common/ProxyImage";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";

interface MultiOptionCardProps {
  market: Market;
  onFavoriteChange?: () => void;
}

interface BuyState {
  optionIndex: number;
  type: "yes" | "no";
  amount: number;
}

const MultiOptionCard: React.FC<MultiOptionCardProps> = ({
  market,
  onFavoriteChange,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [buyState, setBuyState] = useState<BuyState | null>(null);
  
  // 按市场的主 outcome 名称（例如 Up/Down 或 Yes/No）来渲染按钮文案
  const [yesText, noText] = useMemo(() => {
    const firstOption = market.options[0];
    const normalizeBinaryLabel = (label: string | undefined, fallback: string) => {
      const text = label?.trim();
      if (!text) return fallback;
      const lower = text.toLowerCase();
      if (lower === "yes") return t.common.yes;
      if (lower === "no") return t.common.no;
      return text;
    };

    // 优先使用 option 上透传的 yesLabel/noLabel（由 eventToMarket 映射自 rawOutcomes）
    if (firstOption?.yesLabel && firstOption?.noLabel) {
      return [
        normalizeBinaryLabel(firstOption.yesLabel, t.common.yes),
        normalizeBinaryLabel(firstOption.noLabel, t.common.no),
      ];
    }
    // 兜底：统一走国际化
    return [t.common.yes, t.common.no];
  }, [market.options, t.common.yes, t.common.no]);

  const handleAmountChange = (delta: number) => {
    if (buyState) {
      setBuyState({
        ...buyState,
        amount: Math.max(1, buyState.amount + delta),
      });
    }
  };

  const calculateWinAmount = () => {
    if (!buyState) return 0;
    const option = market.options[buyState.optionIndex];
    const percentage =
      buyState.type === "yes" ? option.percentage : 100 - option.percentage;
    return (buyState.amount / (percentage / 100) - buyState.amount).toFixed(2);
  };

  const handleClose = () => {
    setBuyState(null);
  };

  const handleFavoriteClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const slug = market.slug || market.id;
    if (!slug) return;

    try {
      const { favoriteEvent } = await import("@/lib/api");
      const response = await favoriteEvent({
        isFavorite: !market.isFavorite,
        slug,
      });
      if (response.success) {
        if (!market.isFavorite) {
          toast.success(t.common.addedToFavorites);
        } else {
          toast.success(t.common.removedFromFavorites);
        }
        onFavoriteChange?.();
      } else {
        toast.error(t.common.operationFailed);
      }
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      toast.error(t.common.operationFailed);
    }
  };

  // Buy mode view - 参考图片设计
  if (buyState) {
    const option = market.options[buyState.optionIndex];
    const isYes = buyState.type === "yes";

    return (
      <div className="p-4 rounded-xl border border-(--border) bg-(--bg-card)">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <ProxyImage
            src={market.icon}
            alt=""
            className="w-8 h-8 rounded-full object-cover shrink-0"
            fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiMyYTJhMmEiLz48L3N2Zz4="
          />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-(--text-primary) leading-snug">
              {market.title}
            </h3>
            <p className="text-xs text-(--text-secondary) mt-0.5">
              {option.label}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-(--text-tertiary) hover:text-(--text-primary) text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Amount input row - 参考图片样式：输入框内含按钮 + Slider */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex-1 flex items-center bg-(--bg-secondary) rounded-lg px-3 py-1.5">
            <span className="text-(--text-tertiary)">$</span>
            <input
              type="number"
              min="1"
              max="100"
              value={buyState.amount}
              onChange={(e) =>
                setBuyState({
                  ...buyState,
                  amount: Math.max(
                    1,
                    Math.min(100, parseInt(e.target.value) || 1)
                  ),
                })
              }
              className="flex-1 bg-transparent text-(--text-primary) font-semibold text-base outline-hidden min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="flex items-center gap-0.5 ml-auto">
              <button
                onClick={() => handleAmountChange(1)}
                className="px-1.5 py-0.5 rounded bg-(--bg-hover) text-(--text-secondary) text-[10px] font-medium hover:text-(--text-primary) transition-colors"
              >
                +1
              </button>
              <button
                onClick={() => handleAmountChange(10)}
                className="px-1.5 py-0.5 rounded bg-(--bg-hover) text-(--text-secondary) text-[10px] font-medium hover:text-(--text-primary) transition-colors"
              >
                +10
              </button>
            </div>
          </div>
          {/* Slider */}
          <div className="w-[100px] shrink-0">
            <input
              type="range"
              min="1"
              max="100"
              value={buyState.amount}
              onChange={(e) =>
                setBuyState({ ...buyState, amount: parseInt(e.target.value) })
              }
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#ffa502] [&::-webkit-slider-thumb]:cursor-pointer"
              style={{
                background: `linear-gradient(to right, #ffd608 ${buyState.amount}%, #4a4a4a ${buyState.amount}%)`,
              }}
            />
          </div>
        </div>

        {/* Buy button */}
        <button
          className={`w-full py-0.5 rounded-lg text-sm font-bold transition-all ${
            isYes
              ? "bg-[#22c55e] hover:bg-[#16a34a] text-white"
              : "bg-[#ef4444] hover:bg-[#dc2626] text-white"
          }`}
        >
          Buy {isYes ? yesText : noText}
          <span className="block text-xs font-normal opacity-90">
            To win ${calculateWinAmount()}
          </span>
        </button>
      </div>
    );
  }

  // Default view
  return (
    <div
      className="p-4 rounded-xl border border-(--border) bg-(--bg-card) cursor-pointer transition-all duration-200 hover:bg-(--bg-hover) hover:-translate-y-1 hover:shadow-lg h-[180px] flex flex-col"
    >
      {/* Header with icon and title */}
      <div className="flex items-start gap-3 mb-4">
        <ProxyImage
          src={market.icon}
          alt=""
          className="w-10 h-10 rounded-md object-cover shrink-0"
          fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiMyYTJhMmEiLz48L3N2Zz4="
        />
        <h3 className="text-sm font-medium text-(--text-primary) leading-snug flex-1 line-clamp-2">
          {market.title}
        </h3>
      </div>

      {/* Options list or Resolved state */}
      {market.isResolved ? (
        <div className="py-3 rounded-lg text-center bg-[rgba(59,130,246,0.15)] text-[#3b82f6] border border-[rgba(59,130,246,0.3)] font-medium">
          Resolved
        </div>
      ) : (
        <div className="space-y-2 max-h-[56px] overflow-y-auto scrollbar-hide">
          {market.options.map((option, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-2"
            >
              <span className="text-sm text-(--text-secondary) truncate flex-1">
                {option.label}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-(--text-primary) min-w-[40px] text-right">
                  {formatPercentage(option.percentage)}
                </span>
                <div className="flex gap-1">
                  <button
                    // onClick={(e) => {
                    //   e.stopPropagation();
                    //   handleBuyClick(index, "yes");
                    // }}
                    className="group px-2 py-1 rounded text-[10px] font-semibold bg-[rgba(0,255,0,0.1)] text-(--green) hover:bg-[rgba(0,255,0,0.2)] transition-colors min-w-[32px]"
                  >
                    <span className="relative block text-center">
                      <span className="group-hover:opacity-0 block">
                        {yesText}
                      </span>
                      <span className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                        {formatPercentage(option.percentage)}
                      </span>
                    </span>
                  </button>
                  <button
                    // onClick={(e) => {
                    //   e.stopPropagation();
                    //   handleBuyClick(index, "no");
                    // }}
                    className="group px-2 py-1 rounded text-[10px] font-semibold bg-[rgba(255,71,87,0.1)] text-(--red) hover:bg-[rgba(255,71,87,0.2)] transition-colors min-w-[32px]"
                  >
                    <span className="relative block text-center">
                      <span className="group-hover:opacity-0 block">
                        {noText}
                      </span>
                      <span className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                        {formatPercentage(100 - option.percentage)}
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3  border-(--border)">
        <div className="text-xs text-(--text-secondary)">
          {market.volume} {t.common.volume}
        </div>
        <button
          onClick={handleFavoriteClick}
          className={`p-1.5 rounded transition-colors ${
            market.isFavorite
              ? "text-(--accent) hover:text-(--accent)"
              : "text-(--text-secondary) hover:text-(--text-primary)"
          }`}
        >
          <Bookmark
            size={16}
            fill={market.isFavorite ? "currentColor" : "none"}
          />
        </button>
      </div>
    </div>
  );
};

export default React.memo(MultiOptionCard);
