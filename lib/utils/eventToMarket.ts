/**
 * 事件数据转换工具
 * 将 API 返回的 EventSummary 转换为 UI 组件使用的 Market 类型
 */

import { EventSummary, PolymarketEventResp } from "@/types/home";
import { Market, MarketOption, CardType } from "@/types/types";
import { getOutcomeLabel, sortOutcomesByOriginalIndex } from "@/lib/utils/outcomes";
import { formatVolume } from "@/lib/services/homeService";
import {
  clampOutcomeProbabilityPercent,
  fillEvenSplitWhenAllZero,
} from "@/utils/format";

/**
 * 格式化百分比显示
 * - 0% 或负值显示为 "<1%"
 * - 100% 或更高显示为 ">99%"（之前显示 "100%"，对未结算预测市场来说是误导：
 *   暗示"绝对发生"。原始 ratio 0.9995 经 Math.round(*100) 落到 100 是常见情况，
 *   实际市场始终有套利空间，不会真的 100%）
 * - NaN / 非有限数 → "—"
 */
export function formatPercentage(percentage: number): string {
  if (!Number.isFinite(percentage)) return "—";
  if (percentage <= 0) return "<1%";
  if (percentage >= 100) return ">99%";
  return `${percentage}%`;
}

/**
 * rawOutcomes 的元素后端返回两种格式：
 *   - 旧/常规：字符串数组   ["YES","NO"]
 *   - 新/部分：对象数组     [{name:"YES",outcomeKey:"YES",originalIndex:0},...]
 * 统一取出可显示的 label，避免 String(对象) 渲染成 "[object Object]"。
 */
function normalizeRawOutcomeLabel(item: unknown, fallback: string): string {
  if (item == null) return fallback;
  if (typeof item === "string") return item || fallback;
  if (typeof item === "object") {
    const o = item as Record<string, unknown>;
    if (typeof o.name === "string" && o.name) return o.name;
    if (typeof o.outcomeKey === "string" && o.outcomeKey) return o.outcomeKey;
    return fallback;
  }
  return String(item) || fallback;
}

/** 卡片/列表里只展示可交易（ACTIVE）的 market，排除草稿/部署中/已结算等中间态 */
function isDisplayableMarket(status: string | null | undefined): boolean {
  return status !== "RESOLVED" && status !== "DRAFT" && status !== "DEPLOYING";
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
    // 只展示可交易的 market，排除 RESOLVED/DRAFT/DEPLOYING（草稿/部署中是脏数据
    // 或半成品，不该出现在卡片上 —— 之前只排了 RESOLVED，导致 DRAFT 测试市场漏出）
    const activeMarkets = event.markets.filter((m) => isDisplayableMarket(m.status));
    
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
          // 全 0 行情（无盘口）按 1/N 均分，避免卡片百分比显示成误导性的 1%/99%
          const [yesFilled] = fillEvenSplitWhenAllZero(rowPrices);
          yesPrice = yesFilled ?? (parseFloat(rowPrices[0]) || 0);
        } else {
          // fallback 到 outcomes 中的 price：按 "yes" 命名找；Up/Down 等非 yes/no 命名
          // 找不到时回退到第一个 outcome（与 outcomePrices 顺序一致），避免恒取默认 0.5
          const yesOutcome =
            market.outcomes?.find(
              (o) =>
                o.name?.toLowerCase() === "yes" ||
                o.outcomeKey?.toLowerCase() === "yes"
            ) ?? market.outcomes?.[0];
          yesPrice = yesOutcome?.price ?? 0.5;
        }
      } catch {
        console.warn('[eventToMarket] Failed to parse market outcome prices, using fallback yesPrice');
        // fallback 到 outcomes 中的 price：同上，非 yes/no 命名回退到第一个 outcome
        const yesOutcome =
          market.outcomes?.find(
            (o) =>
              o.name?.toLowerCase() === "yes" ||
              o.outcomeKey?.toLowerCase() === "yes"
          ) ?? market.outcomes?.[0];
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
          yesLabel = normalizeRawOutcomeLabel(rawOutcomes[0], "Yes");
          noLabel = normalizeRawOutcomeLabel(rawOutcomes[1], "No");
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
        percentage: clampOutcomeProbabilityPercent(yesPrice),
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
    // 排除草稿/部署中的 market（详情页保留 RESOLVED 以便展示已结算结果）
    const displayMarkets = event.markets.filter(
      (m) => (m as any).status !== "DRAFT" && (m as any).status !== "DEPLOYING",
    );
    displayMarkets.forEach((market) => {
      // 优先使用 rowOutcomePrice 作为卡片显示的百分比
      // rowOutcomePrice: "[\"0\", \"1\"]" => yes <1%, no 100%
      let yesPrice = 0.5;
      try {
        // 优先使用 rowOutcomePrice
        const rowPrices = market.rowOutcomePrice
          ? JSON.parse(market.rowOutcomePrice)
          : null;
        if (rowPrices && rowPrices.length > 0) {
          // 全 0 行情（无盘口）按 1/N 均分，避免卡片百分比显示成误导性的 1%/99%
          const [yesFilled] = fillEvenSplitWhenAllZero(rowPrices);
          yesPrice = yesFilled ?? (parseFloat(rowPrices[0]) || 0);
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
          yesLabel = normalizeRawOutcomeLabel(rawOutcomes[0], "Yes");
          noLabel = normalizeRawOutcomeLabel(rawOutcomes[1], "No");
        }
      } catch(err) {
        console.error("Error parsing rawOutcomes:", err);
      }

      options.push({
        label: market.groupItemTitle || market.question || "Market",
        percentage: clampOutcomeProbabilityPercent(yesPrice),
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
