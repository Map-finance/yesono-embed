/**
 * Event 频率标签工具 — 统一"短期市场"的识别口径(\d+m / \d+h)
 *
 * 短期市场 = 分钟 / 小时频率(5m / 10m / 15m / 30m / 1h / 4h …),
 * 这些市场用 trade-by-trade 概率图(ShortTermOutcomeGraph)更合适;
 * daily / weekly / 其它长周期市场仍走聚合曲线(MarketChart / OutcomeGraph),
 * 故这里只匹配 \d+[mh],不包括 daily/weekly。
 *
 * 与 showPriceChartOption 的区别:那个判断是"该不该显示资产价格图",
 * 依赖后端 needTimeTagTags 列表(可能含 finance / daily / weekly);
 * 本工具不依赖后端列表,纯前端正则,语义只覆盖"短期 trade-by-trade 概率图"。
 */

const SHORT_TERM_RE = /^\d+[mh]$/i;

/** slug 是否是短期频率(\d+m 或 \d+h,大小写不敏感) */
export function isShortTermFrequencySlug(slug?: string | null): boolean {
  if (!slug) return false;
  return SHORT_TERM_RE.test(String(slug).trim());
}

/** 从 event.tags 中取第一个短期频率 slug;无则 undefined */
export function getShortTermFrequencySlug(
  tags?: { slug?: string }[] | null
): string | undefined {
  if (!Array.isArray(tags)) return undefined;
  const t = tags.find((x) => isShortTermFrequencySlug(x?.slug));
  return t?.slug;
}

/** 把短期 slug 解析成毫秒(用于反推图表窗口长度);不识别返回 null */
export function parseShortTermFrequencyMs(slug?: string | null): number | null {
  if (!slug) return null;
  const m = String(slug).trim().match(/^(\d+)\s*([mh])$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return m[2].toLowerCase() === "h" ? n * 60 * 60_000 : n * 60_000;
}
