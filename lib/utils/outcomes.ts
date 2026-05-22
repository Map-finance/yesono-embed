import { PolymarketMarketResp } from "@/types/home";

export interface OutcomeLike {
  name?: string;
  outcome?: string;
  outcomeKey?: string;
  originalIndex?: number | null;
  // 常见的附加字段（不同接口/模块会用到）
  tokenId?: string | number | null;
  tradingPair?: string | null;
  clobPairId?: string | number | null;
}

export interface BinaryOutcomeLabels {
  yes: string;
  no: string;
  up: string;
  down: string;
}

/** 统一获取 outcome 显示文案：优先 name，其次 outcome，其次根据 outcomeKey 映射 */
export function getOutcomeLabel(outcome?: OutcomeLike | null): string {
  if (!outcome) return "";
  const rawName = (outcome.name ?? outcome.outcomeKey ?? "").trim();
  return rawName;

}

export function normalizeBinaryOutcomeLabel(
  label: string | undefined,
  fallback: string,
  translations: BinaryOutcomeLabels
): string {
  const text = label?.trim();
  if (!text) return fallback;

  switch (text.toLowerCase()) {
    case "yes":
      return translations.yes;
    case "no":
      return translations.no;
    case "up":
      return translations.up;
    case "down":
      return translations.down;
    default:
      return text;
  }
}

/** 按 originalIndex 排序；没有 originalIndex 的排在后面，保持相对顺序 */
export function sortOutcomesByOriginalIndex<T extends OutcomeLike>(
  outcomes: T[] | undefined | null
): T[] {
  if (!outcomes || outcomes.length <= 1) return outcomes ? [...outcomes] : [];
  return [...outcomes].sort((a, b) => {
    const ai = a.originalIndex;
    const bi = b.originalIndex;
    const aValid = typeof ai === "number";
    const bValid = typeof bi === "number";
    if (aValid && bValid) return (ai as number) - (bi as number);
    if (aValid && !bValid) return -1;
    if (!aValid && bValid) return 1;
    return 0;
  });
}

/**
 * 取二元市场的 [yesLabel, noLabel] 显示文案。
 * 与 OutcomeRow / outcome 详情页保持同一套逻辑：按 originalIndex 排序后，
 * 对前两个 outcome 做 yes/no/up/down 归一；不足两项时回退到传入的 yes/no 文案。
 */
export function getBinaryOutcomeLabels(
  market: PolymarketMarketResp | null | undefined,
  translations: BinaryOutcomeLabels
): [string, string] {
  const outcomesRaw: any = (market as any)?.marketOutcomes;
  const outcomes: OutcomeLike[] = Array.isArray(outcomesRaw)
    ? outcomesRaw
    : typeof outcomesRaw === "string"
    ? (() => {
        try {
          return JSON.parse(outcomesRaw);
        } catch {
          return [];
        }
      })()
    : [];
  const sorted = sortOutcomesByOriginalIndex(outcomes);
  if (sorted.length >= 2) {
    return [
      normalizeBinaryOutcomeLabel(
        getOutcomeLabel(sorted[0]),
        translations.yes,
        translations
      ),
      normalizeBinaryOutcomeLabel(
        getOutcomeLabel(sorted[1]),
        translations.no,
        translations
      ),
    ];
  }
  return [translations.yes, translations.no];
}

/**
 * 从市场数据中提取选项名称列表，优先使用 marketOutcomes 的 name 字段，如果没有则解析 outcomes 字段
 * @param market
 * @returns
 */
export const getOutcomesByMarket = (market: PolymarketMarketResp): string[] => {
  let outcomes: string[] = [];
  if (market.marketOutcomes && market.marketOutcomes.length > 0) {
    market.marketOutcomes.sort((a, b) => {
      const ai = a.originalIndex;
      const bi = b.originalIndex;
      const aValid = typeof ai === "number";
      const bValid = typeof bi === "number";
      if (aValid && bValid) return (ai as number) - (bi as number);
      if (aValid && !bValid) return -1;
      if (!aValid && bValid) return 1;
      return 0;
    }).forEach((o) => {
      if (o.name) {
        outcomes.push(o.name);
      }
    });
  } else if (market.outcomes) {
    const outcomesArray = JSON.parse(market.outcomes);
    if (Array.isArray(outcomesArray) && outcomesArray.every((o) => typeof o === "string")) {
      outcomes = outcomesArray;
    }
  }

  return outcomes;
}
