"use client";

/**
 * Image Card - 图片背景卡片
 * 带有大背景图、标题和圆形概率徽章
 */

import React, { useMemo, useState } from "react";
import { useTheme } from "@/lib/theme/useTheme";
import { useRouter } from "next/navigation";
import { Bookmark, BarChart3 } from "lucide-react";
import { Market } from "@/types/types";
import { formatPercentage } from "@/lib/utils/eventToMarket";
import ProxyImage from "@/components/common/ProxyImage";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";

interface ImageCardProps {
  market: Market;
  onFavoriteChange?: () => void;
}

interface BuyState {
  type: "yes" | "no";
  amount: number;
}

const ImageCard: React.FC<ImageCardProps> = ({
  market,
  onFavoriteChange,
}) => {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();
  const [buyState, setBuyState] = useState<BuyState | null>(null);

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

    if (firstOption?.yesLabel && firstOption?.noLabel) {
      return [
        normalizeBinaryLabel(firstOption.yesLabel, t.common.yes),
        normalizeBinaryLabel(firstOption.noLabel, t.common.no),
      ];
    }
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
    const percentage = market.options[0]?.percentage ?? 50;
    const actualPercentage =
      buyState.type === "yes" ? percentage : 100 - percentage;
    return (
      buyState.amount / (actualPercentage / 100) -
      buyState.amount
    ).toFixed(2);
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

  const percentage = market.options[0]?.percentage ?? 50;
  const isResolved = market.isResolved;

  // Buy mode view - 参考MultiOptionCard设计
  if (buyState) {
    const isYes = buyState.type === "yes";

    return (
      <div className="p-4 rounded-xl border border-(--border) bg-(--bg-card)">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <ProxyImage
            // 中文注释：市场图标通常是第三方外链，这里统一走 Cloudflare 图片代理（生产环境启用）
            src={market.icon}
            alt=""
            className="w-8 h-8 rounded-full object-cover shrink-0"
            fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiMyYTJhMmEiLz48L3N2Zz4="
          />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-(--text-primary) leading-snug">
              {market.title}
            </h3>
          </div>
          <button
            onClick={handleClose}
            className="text-(--text-tertiary) hover:text-(--text-primary) text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Amount input row - 参考MultiOptionCard样式 */}
        <div className="flex items-center gap-2 mb-5">
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
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#ffd608] [&::-webkit-slider-thumb]:cursor-pointer"
              style={{
                background: `linear-gradient(to right, #ffd608 ${buyState.amount}%, #4a4a4a ${buyState.amount}%)`,
              }}
            />
          </div>
        </div>

        {/* Buy button */}
        <button
          className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${
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

  // 半圆进度条组件
  const SemiCircleProgress = ({ value }: { value: number }) => {
    const size = 56;
    const strokeWidth = 4;
    const radius = (size - strokeWidth) / 2;
    const center = size / 2;

    // 根据主题决定颜色（浅色模式下交换背景弧与进度弧颜色）
    const { isLight } = useTheme();
    const bgArcColor = isLight ? "#e5e5e5" : "#3a3a3a";
    const progressArcColor = isLight ? "#3a3a3a" : "#e5e5e5";

    // 弧度从左下到右下，约220度
    const startAngle = 200;
    const endAngle = -20;
    const totalAngle = startAngle - endAngle;

    const toRad = (deg: number) => (deg * Math.PI) / 180;

    // 起点和终点坐标
    const startX = center + radius * Math.cos(toRad(startAngle));
    const startY = center - radius * Math.sin(toRad(startAngle));
    const endX = center + radius * Math.cos(toRad(endAngle));
    const endY = center - radius * Math.sin(toRad(endAngle));

    // 进度点位置
    const progressAngle = startAngle - (value / 100) * totalAngle;
    const dotX = center + radius * Math.cos(toRad(progressAngle));
    const dotY = center - radius * Math.sin(toRad(progressAngle));

    // 弧长计算
    const arcLength = (totalAngle / 360) * 2 * Math.PI * radius;
    const progressLength = (value / 100) * arcLength;

    return (
      <div
        className="relative shrink-0"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* 背景弧 */}
          <path
            d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${
              totalAngle > 180 ? 1 : 0
            } 1 ${endX} ${endY}`}
            fill="none"
            stroke={bgArcColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* 进度弧 */}
          <path
            d={`M ${startX} ${startY} A ${radius} ${radius} 0 ${
              totalAngle > 180 ? 1 : 0
            } 1 ${endX} ${endY}`}
            fill="none"
            stroke={progressArcColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${progressLength} ${arcLength}`}
          />
          {/* 红点指示器 */}
          <circle cx={dotX} cy={dotY} r="4" fill="#ef4444" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
          <div className="text-sm font-bold text-(--text-primary)">
            {value}%
          </div>
          <div className="text-[8px] text-(--text-secondary)">chance</div>
        </div>
      </div>
    );
  };

  // Default view
  return (
    <div
      className="p-4 rounded-xl border border-(--border) bg-(--bg-card) cursor-pointer transition-all duration-200 hover:bg-(--bg-hover) hover:-translate-y-1 hover:shadow-lg h-[180px] flex flex-col"
    >
      {/* Header with icon, title and semi-circle progress */}
      <div className="flex items-start gap-3 mb-3">
        <ProxyImage
          // 中文注释：默认视图同样使用图片代理，确保列表页大量图片加载更快、更稳
          src={market.icon}
          alt=""
          className="w-12 h-12 rounded-lg object-cover shrink-0"
          fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIGZpbGw9IiMyYTJhMmEiLz48L3N2Zz4="
        />
        <h3 className="flex-1 text-sm font-medium text-(--text-primary) leading-snug line-clamp-2">
          {market.title}
        </h3>
        {!isResolved && <SemiCircleProgress value={percentage} />}
      </div>

      {/* Yes/No buttons or Resolved state */}
      {isResolved ? (
        <div className="mb-4 py-3 rounded-lg text-center bg-[rgba(59,130,246,0.15)] text-[#3b82f6] border border-[rgba(59,130,246,0.3)] font-medium">
          Resolved
        </div>
      ) : (
        <div className="flex gap-2 mb-4">
          <button
            // onClick={(e) => {
            //   e.stopPropagation();
            //   handleBuyClick("yes");
            // }}
            className="group flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold bg-[rgba(0,255,0,0.15)] text-(--green) hover:bg-[rgba(0,255,0,0.25)] transition-colors"
          >
            <span className="relative block text-center">
              <span className="group-hover:opacity-0 block">{yesText}</span>
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                {formatPercentage(percentage)}
              </span>
            </span>
          </button>
          <button
            // onClick={(e) => {
            //   e.stopPropagation();
            //   handleBuyClick("no");
            // }}
            className="group flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold bg-[rgba(255,71,87,0.15)] text-(--red) hover:bg-[rgba(255,71,87,0.25)] transition-colors"
          >
            <span className="relative block text-center">
              <span className="group-hover:opacity-0 block">{noText}</span>
              <span className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                {formatPercentage(100 - percentage)}
              </span>
            </span>
          </button>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-(--text-secondary)">
          <span>{market.volume} {t.common.volume}</span>
          <BarChart3 size={12} />
        </div>
        <div className="flex items-center gap-2">
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
    </div>
  );
};

export default React.memo(ImageCard);
