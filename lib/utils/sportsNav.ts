/**
 * 体育市场导航工具函数
 * - 判断是否为体育市场（tags 中包含 slug === "games"）
 * - 构建体育市场比赛视图 URL
 */

/**
 * 判断是否为体育市场
 * 规则：tags 中只要有一个 tag 的 slug 属性是 "games" 则为体育市场
 */
export function isSportsEvent(tags?: { slug: string }[]): boolean {
  return tags?.some((t) => t.slug === "games") ?? false;
}

/**
 * 解析赛事开赛时间 → Date（毫秒时间戳)。
 *
 * 背景:后端把比赛时间放在 startDate(毫秒时间戳字符串,如 "1776938400000"),endDate 常返 null。
 * 早前各处误用 endDate → new Date(Number(null)) = new Date(0) = 1970-01-01,
 * 在 UTC+8 下显示成「1月1日 上午8:00」,所有赛事时间日期全错。
 *
 * 这里统一:优先 startDate,回退 endDate,两者都非法(null/空/NaN/<=0)时返回 null ——
 * 调用方据此显示「待定」而不是回落到 epoch。
 */
export function resolveEventDate(
  event: { startDate?: string | number | null; endDate?: string | number | null } | null | undefined
): Date | null {
  if (!event) return null;
  for (const raw of [event.startDate, event.endDate]) {
    if (raw == null || raw === "") continue;
    const ms = Number(raw);
    if (Number.isFinite(ms) && ms > 0) return new Date(ms);
  }
  return null;
}

/**
 * 构建体育市场比赛视图 URL
 * 格式: /sports?tag={leafTag}&tags={tagsChain}&event={eventSlug}
 */
export function buildSportsEventUrl(
  eventSlug: string,
  tags?: { slug: string }[]
): string {
  const params = new URLSearchParams();

  if (tags && tags.length > 0) {
    // 过滤掉 "games" 标记 tag，保留体育分类链
    const sportsTags = tags.filter((t) => t.slug !== "games");
    if (sportsTags.length > 0) {
      const tagsChain = sportsTags.map((t) => t.slug).join(",");
      const leafTag = sportsTags[sportsTags.length - 1].slug;
      params.set("tag", leafTag);
      params.set("tags", tagsChain);
    }
  }

  params.set("event", eventSlug);
  return `/sports?${params.toString()}`;
}

/**
 * 根据 tags / category 判断并返回正确的跳转路径
 * 体育市场 → /sports?event=xxx
 * 通用市场 → /market/xxx
 */
export function getMarketNavigationUrl(
  slug: string,
  tags?: { slug: string }[],
  category?: string
): string {
  if (isSportsEvent(tags) || category?.toLowerCase() === "sports") {
    return buildSportsEventUrl(slug, tags);
  }
  return `/market/${slug}`;
}
