"use client";

import React from "react";
import { Market } from "@/types/types";
import { VSCard, ImageCard, MultiOptionCard } from "./cards";

interface MarketCardProps {
  market: Market;
  onFavoriteChange?: (slug: string, isFavorite: boolean) => void;
  showBookmark?: boolean;
}

const MarketCard: React.FC<MarketCardProps> = ({
  market,
  onFavoriteChange,
  showBookmark = true,
}) => {
  switch (market.cardType) {
    case "vs":
      return (
        <VSCard
          market={market}
          onFavoriteChange={onFavoriteChange}
          showBookmark={showBookmark}
        />
      );
    case "image":
      return (
        <ImageCard
          market={market}
          onFavoriteChange={onFavoriteChange}
          showBookmark={showBookmark}
        />
      );
    case "multi":
      return (
        <MultiOptionCard
          market={market}
          onFavoriteChange={onFavoriteChange}
          showBookmark={showBookmark}
        />
      );
    default:
      return (
        <MultiOptionCard
          market={market}
          onFavoriteChange={onFavoriteChange}
          showBookmark={showBookmark}
        />
      );
  }
};

export default React.memo(MarketCard);
