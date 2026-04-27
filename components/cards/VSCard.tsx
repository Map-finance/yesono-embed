"use client";

/**
 * VS Card - 对战类型卡片
 * 用于体育赛事、电竞比赛等两方对决场景
 */

import React from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { Market } from "@/types/types";
import ProxyImage from "@/components/common/ProxyImage";
import { useTranslation } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";

interface VSCardProps {
  market: Market;
  onFavoriteChange?: () => void;
}

const VSCard: React.FC<VSCardProps> = ({
  market,
  onFavoriteChange,
}) => {
  const { t } = useTranslation();
  const toast = useToast();
  const team1 = market.options[0];
  const team2 = market.options[1];

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

  return (
    <div
      className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] cursor-pointer transition-all duration-200 hover:bg-[var(--bg-hover)] hover:-translate-y-1 hover:shadow-lg"
    >
      {/* Team rows */}
      <div className="space-y-2 mb-4">
        {/* Team 1 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {team1?.icon ? (
              <ProxyImage
                src={team1.icon}
                alt=""
                className="w-6 h-6 rounded object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded bg-[var(--bg-secondary)] flex items-center justify-center text-xs font-bold text-[var(--accent)]">
                0
              </div>
            )}
            <span className="text-sm text-[var(--text-primary)]">
              {team1?.label}
            </span>
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {team1?.percentage}%
          </span>
        </div>

        {/* Team 2 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {team2?.icon ? (
              <ProxyImage
                src={team2.icon}
                alt=""
                className="w-6 h-6 rounded object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded bg-[var(--red)] flex items-center justify-center text-xs font-bold text-white">
                1
              </div>
            )}
            <span className="text-sm text-[var(--text-primary)]">
              {team2?.label}
            </span>
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {team2?.percentage}%
          </span>
        </div>
      </div>

      {/* Team selection buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex-1 py-2 px-3 rounded-md text-xs font-semibold bg-[var(--accent)] text-black hover:opacity-90 transition-opacity"
        >
          {team1?.label}
        </button>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex-1 py-2 px-3 rounded-md text-xs font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-opacity"
        >
          {team2?.label}
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-[var(--border)]">
        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          {market.isLive && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[var(--red)] animate-pulse"></span>
              <span className="text-[var(--red)] font-medium">LIVE</span>
            </span>
          )}
          <span>${market.volume} {t.common.volume}</span>
          {market.liveLabel && (
            <span className="text-[var(--text-secondary)]">
              · {market.liveLabel}
            </span>
          )}
        </div>
        <button
          onClick={handleFavoriteClick}
          className={`p-1.5 rounded transition-colors ${
            market.isFavorite
              ? "text-[var(--accent)] hover:text-[var(--accent)]"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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

export default VSCard;
