"use client";


import MarketGrid from "@/components/MarketGrid";
import { getRecommendations } from "@/lib/services/recommendations";
import { Market } from "@/types/types";
import { useEffect, useState } from "react";

export default function PropsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 加载个性化推荐数据
  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const userId =
        typeof window !== "undefined"
          ? localStorage.getItem("userId") || "anonymous"
          : "anonymous";

      const data = await getRecommendations(userId, "All");

      setMarkets(data.markets);
    } catch (error) {
      console.error("Error loading recommendations:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <MarketGrid
      markets={markets}
      columns={3}
      loading={loading}
      emptyMessage="暂无推荐数据"
      onFavoriteChange={loadRecommendations}
    />
  );
}
