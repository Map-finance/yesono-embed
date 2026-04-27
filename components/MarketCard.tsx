"use client";

import React from "react";
import { Market } from "@/types/types";
import { VSCard, ImageCard, MultiOptionCard } from "./cards";

interface MarketCardProps {
  market: Market;
  onFavoriteChange?: () => void;
}

const MarketCard: React.FC<MarketCardProps> = ({
  market,
  onFavoriteChange,
}) => {
  switch (market.cardType) {
    case "vs":
      return (
        <VSCard
          market={market}
          onFavoriteChange={onFavoriteChange}
        />
      );
    case "image":
      return (
        <ImageCard
          market={market}
          onFavoriteChange={onFavoriteChange}
        />
      );
    case "multi":
      return (
        <MultiOptionCard
          market={market}
          onFavoriteChange={onFavoriteChange}
        />
      );
    default:
      return (
        <MultiOptionCard
          market={market}
          onFavoriteChange={onFavoriteChange}
        />
      );
  }
};

export default MarketCard;
