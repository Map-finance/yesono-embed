/**
 * SportsEventDetailView 内部用到的纯转换函数（无 React 依赖）。
 * 把 SportsEventDetail 投影成 MarketChart / ActivityFeed 等组件期望的 Market/PolymarketMarketResp 形状。
 */

import type { SportsEventDetail, SportsMarketItem } from "@/types/sports";
import type { Market } from "@/types/types";
import type { PolymarketMarketResp } from "@/types/home";

/**
 * 构造 MarketChart 所需的 (market, eventMarkets) — 取 moneyline 三个 market。
 * 返回 null 表示不应渲染图表。
 */
export function toChartData(
  eventData: SportsEventDetail | null
): { market: Market; eventMarkets: PolymarketMarketResp[] } | null {
  if (!eventData) return null;
  const moneylineItems = eventData.market?.moneyline || [];
  if (moneylineItems.length === 0) return null;

  const market: Market = {
    id: eventData.id,
    slug: eventData.slug,
    icon: eventData.icon || "",
    title: eventData.title,
    options: moneylineItems.map((m) => {
      const yes =
        m.outcomes?.find((o) => o.outcome === "Yes") || m.outcomes?.[0];
      return {
        label: m.marketTitle.replace(/\s*\(.*?\)/, "").trim(),
        percentage: yes ? Math.round(parseFloat(yes.price) * 100) : 50,
      };
    }),
    volume: "",
    isLive: false,
    isResolved: false,
    isFavorite: false,
  };

  const eventMarkets: PolymarketMarketResp[] = moneylineItems.map((m) => ({
    id: m.marketId,
    question: m.marketTitle,
    groupItemTitle: m.marketTitle.replace(/\s*\(.*?\)/, "").trim(),
    conditionId: "",
    slug: eventData.slug,
    outcomes: JSON.stringify(m.outcomes?.map((o) => o.outcome) || []),
    outcomePrices: JSON.stringify(m.outcomes?.map((o) => o.price) || []),
    clobTokenIds: JSON.stringify(m.outcomes?.map((o) => o.id) || []),
    active: true,
    closed: false,
    volume: 0,
    image: eventData.image || "",
    icon: eventData.icon || "",
  })) as any[];

  return { market, eventMarkets };
}

/** 构造 PolymarketMarketResp[]，用于 ActivityFeed/TopHolders/Positions 等下游组件。 */
export function toPolymarketMarkets(
  eventData: SportsEventDetail | null
): PolymarketMarketResp[] {
  if (!eventData?.market) return [];
  const allItems: SportsMarketItem[] = [];
  for (const items of Object.values(eventData.market)) {
    if (Array.isArray(items)) allItems.push(...items);
  }
  return allItems.map((m) => ({
    id: m.marketId,
    question: m.marketTitle,
    groupItemTitle: m.marketTitle,
    conditionId: "",
    slug: eventData.slug,
    outcomes: JSON.stringify(m.outcomes?.map((o) => o.outcome) || []),
    outcomePrices: JSON.stringify(m.outcomes?.map((o) => o.price) || []),
    clobTokenIds: JSON.stringify(m.outcomes?.map((o) => o.id) || []),
    active: true,
    closed: false,
    volume: 0,
    image: eventData.image || "",
    icon: eventData.icon || "",
  })) as any[];
}
