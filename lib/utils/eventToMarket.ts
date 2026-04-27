/**
 * 事件数据转换工具
 * 将 API 返回的 EventSummary 转换为 UI 组件使用的 Market 类型
 */

import { EventSummary, PolymarketEventResp } from "@/types/home";
import { Market, MarketOption, CardType } from "@/types/types";
import { getOutcomeLabel, sortOutcomesByOriginalIndex } from "@/lib/utils/outcomes";
import { formatVolume } from "@/lib/services/homeService";

/**
 * 格式化百分比显示
 * - 0% 或负值显示为 "<1%"
 * - 100% 或更高显示为 "100%"
 */
export function formatPercentage(percentage: number): string {
  if (percentage <= 0) return "<1%";
  if (percentage >= 100) return "100%";
  return `${percentage}%`;
}

/**
 * 将 EventSummary 转换为 Market 类型
 * 每个 event 作为一个卡片，内部的 markets 作为选项列表显示
 * 每个选项显示 market 的问题/标题，以及 Yes/No 概率
 */
export function eventToMarket(event: EventSummary): Market {

  
  // 将每个 market 作为一个选项，显示 Yes 的概率
  const options: MarketOption[] = [];

  if (event.markets && event.markets.length > 0) {
    // 过滤掉 status 为 RESOLVED 的 market
    const activeMarkets = event.markets.filter((m) => m.status !== "RESOLVED");
    
    activeMarkets.forEach((market) => {
      // 优先使用 rowOutcomePrice 作为卡片显示的百分比
      // rowOutcomePrice: "[\"0\", \"1\"]" => yes 0%, no 100%
      let yesPrice = 0.5;

      try {
        // 优先使用 rowOutcomePrice
        const rowPrices = market.rowOutcomePrice
          ? JSON.parse(market.rowOutcomePrice)
          : null;
        if (rowPrices && rowPrices.length > 0) {
          yesPrice = parseFloat(rowPrices[0]) || 0;
        } else {
          // fallback 到 outcomes 中的 price
          const yesOutcome = market.outcomes?.find(
            (o) =>
              o.name?.toLowerCase() === "yes" ||
              o.outcomeKey?.toLowerCase() === "yes"
          );
          yesPrice = yesOutcome?.price ?? 0.5;
        }
      } catch {
        console.warn('[eventToMarket] Failed to parse market outcome prices, using fallback yesPrice');
        // fallback 到 outcomes 中的 price
        const yesOutcome = market.outcomes?.find(
          (o) =>
            o.name?.toLowerCase() === "yes" ||
            o.outcomeKey?.toLowerCase() === "yes"
        );
        yesPrice = yesOutcome?.price ?? 0.5;
      }

      // 解析按钮文案：优先使用 rawOutcomes，其次 outcomes.name/outcomeKey，兜底 Yes/No
      let yesLabel = "Yes";
      let noLabel = "No";
      try {
        const rawOutcomes = (market as any).rawOutcomes
          ? JSON.parse((market as any).rawOutcomes as string)
          : null;
        if (Array.isArray(rawOutcomes) && rawOutcomes.length >= 2) {
          yesLabel = String(rawOutcomes[0] ?? "Yes");
          noLabel = String(rawOutcomes[1] ?? "No");
        } else if (market.outcomes && market.outcomes.length >= 2) {
          const sorted = sortOutcomesByOriginalIndex(market.outcomes as any);
          yesLabel = getOutcomeLabel(sorted[0]) || "Yes";
          noLabel = getOutcomeLabel(sorted[1]) || "No";
        }
      } catch {
        console.warn('[eventToMarket] Failed to parse rawOutcomes, using fallback labels');
        if (market.outcomes && market.outcomes.length >= 2) {
          const sorted = sortOutcomesByOriginalIndex(market.outcomes as any);
          yesLabel = getOutcomeLabel(sorted[0]) || "Yes";
          noLabel = getOutcomeLabel(sorted[1]) || "No";
        }
      }

      
      options.push({
        label: market.groupItemTitle || market.question || "Market",
        percentage: Math.round(yesPrice * 100),
        icon: undefined,
        yesLabel,
        noLabel,
      });
    });
  }

  // 如果没有 markets，使用默认的单个 Yes/No 选项
  if (options.length === 0) {
    options.push({
      label: event.title,
      percentage: event.stats?.chance
        ? Math.round(event.stats.chance * 100)
        : 50,
    });
  }

  // 格式化日期
  let date: string | undefined;
  if (event.endTime) {
    const endDate = new Date(event.endTime);
    date = endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  // 如果只有 1 个 market 使用 image 卡片，否则使用 multi 卡片
  const cardType: CardType = options.length <= 1 ? "image" : "multi";

  // 判断是否已结算 - 检查所有 markets 的 status 是否全部为 RESOLVED
  const isResolved =
    event.closed ||
    event.archived ||
    (event.markets && event.markets.length > 0
      ? event.markets.every((m) => m.status === "RESOLVED")
      : false);

  return {
    id: String(event.id),
    slug: event.slug,
    icon: event.icon || event.image || "",
    title: event.title,
    options,
    date,
    volume: formatVolume(event.volume || 0),
    cardType,
    isLive: event.isLive,
    liveLabel: event.isLive ? "LIVE" : undefined,
    backgroundImage: event.image,
    timeframe: event.subtitle,
    isResolved,
    isFavorite: event.favorite ?? false,
  };
}

/**
 * 批量转换 EventSummary 数组
 */
export function eventsToMarkets(events: EventSummary[]): Market[] {
  return events.map(eventToMarket);
}

/**
 * 将 PolymarketEventResp 转换为 Market 类型
 */
export function polymarketEventToMarket(event: PolymarketEventResp): Market {
  const options: MarketOption[] = [];

  if (event.markets && event.markets.length > 0) {
    event.markets.forEach((market) => {
      // 优先使用 rowOutcomePrice 作为卡片显示的百分比
      // rowOutcomePrice: "[\"0\", \"1\"]" => yes <1%, no 100%
      let yesPrice = 0.5;
      try {
        // 优先使用 rowOutcomePrice
        const rowPrices = market.rowOutcomePrice
          ? JSON.parse(market.rowOutcomePrice)
          : null;
        if (rowPrices && rowPrices.length > 0) {
          yesPrice = parseFloat(rowPrices[0]) || 0;
        } else {
          // fallback 到 outcomePrices
          const prices = JSON.parse(market.outcomePrices || "[]");
          if (prices.length > 0) {
            yesPrice = parseFloat(prices[0]) || 0.5;
          }
        }
      } catch(err) {
        console.error("Error parsing rowOutcomePrice or outcomePrices:", err);
      }

      // 同样使用 rawOutcomes / outcomes 推导按钮文案
      let yesLabel = "Yes";
      let noLabel = "No";
      try {
        const rawOutcomes = (market as any).rawOutcomes
          ? JSON.parse((market as any).rawOutcomes as string)
          : null;
        if (Array.isArray(rawOutcomes) && rawOutcomes.length >= 2) {
          yesLabel = String(rawOutcomes[0] ?? "Yes");
          noLabel = String(rawOutcomes[1] ?? "No");
        }
      } catch(err) {
        console.error("Error parsing rawOutcomes:", err);
      }

      options.push({
        label: market.groupItemTitle || market.question || "Market",
        percentage: Math.round(yesPrice * 100),
        icon: undefined,
        yesLabel,
        noLabel,
      });
    });
  }

  if (options.length === 0) {
    options.push({
      label: event.title,
      percentage: 50,
    });
  }

  let date: string | undefined;
  if (event.endDate) {
    const endDate = new Date(event.endDate);
    date = endDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }

  const cardType: CardType = options.length <= 1 ? "image" : "multi";

  // 判断是否已结算
  const isResolved = event.closed || event.archived;

  return {
    id: String(event.id),
    slug: event.slug,
    icon: event.icon || event.image || "",
    title: event.title,
    options,
    date,
    volume: formatVolume(event.volume || 0),
    cardType,
    isLive: event.active,
    liveLabel: event.active ? "LIVE" : undefined,
    backgroundImage: event.image,
    isResolved,
  };
}

/**
 * 从 EventSummary 提取参与者图片（用于 VS 卡片）
 */
export function getParticipantImages(event: EventSummary): {
  home?: string;
  away?: string;
} {
  if (!event.participants || event.participants.length < 2) {
    return {};
  }

  const homeParticipant =
    event.participants.find((p) => p.alignment === "home") ||
    event.participants[0];
  const awayParticipant =
    event.participants.find((p) => p.alignment === "away") ||
    event.participants[1];

  return {
    home: homeParticipant?.image,
    away: awayParticipant?.image,
  };
}

/**
 * 从 EventSummary 获取主要 market 的 outcomes
 */
export function getPrimaryOutcomes(event: EventSummary) {
  if (!event.markets || event.markets.length === 0) {
    return [];
  }

  const primaryMarket = event.markets[0];
  return primaryMarket.outcomes || [];
}
