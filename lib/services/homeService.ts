/**
 * 首页 API 服务?
 * 基于 docs/API_HOME.md 文档
 */

import {
  ApiResponse,
  NavigationItem,
  TagTreeNode,
  EventsResp,
  EventsQuery,
  EventSummary,
  PolymarketEventResp,
} from "@/types/home";
import { getValidAccessToken } from "@/lib/api";
import { getAuthApiUrl } from "@/lib/config/authApiUrl";

const NEED_TIME_TAG_TAGS_CACHE_TTL_MS = 30 * 60 * 1000;
let needTimeTagTagsCache: { data: string[]; fetchedAt: number } | null = null;
let needTimeTagTagsInFlight: Promise<string[]> | null = null;

async function getAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const token = await getValidAccessToken();
    if (token) return token;
  } catch (e) {
    console.warn(
      "[homeService] Failed to resolve access token",
      e
    );
  }
  return null;
}

/**
 * 获取通用请求头（包含认证和多语言?
 */
async function getCommonHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (typeof window !== "undefined") {
    const locale = localStorage.getItem("locale") || 'en';
    if (locale) {
      headers["Accept-Language"] = locale;
    }
  } else {
    // server side: try to read cookie 'locale' via next/headers
    try {
      // dynamic import to avoid bundling next/headers into client bundle
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const locale = cookieStore.get("locale")?.value as string | undefined;
      if (locale) {
        headers["Accept-Language"] = locale;
      }
    } catch (e) {
      // ignore if next/headers not available
    }
  }

  const token = await getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  return headers;
}

/**
 * 仅获?API 动态导航项（不含固定项?
 */
export async function getDynamicNavigation(): Promise<NavigationItem[]> {
  try {
    // 直接访问 API
    const response = await fetch(getAuthApiUrl("/api/navigation"), {
      method: "GET",
      headers: await getCommonHeaders(),
    });

    if (!response.ok) {
      console.error(
        "[homeService] getDynamicNavigation failed:",
        response.status
      );
      return [];
    }

    const result: ApiResponse<NavigationItem[]> = await response.json();

    if (result.success && result.data) {
      return result.data;
    }

    return [];
  } catch (error) {
    console.error("[homeService] getDynamicNavigation error:", error);
    return [];
  }
}

// ============== 子标签树 API ==============

/**
 * 获取子标签树
 * @param slug - root Slug
 * @param withCount - 是否返回 count
 */
export async function getTagTree(
  slug?: string,
  withCount: boolean = false,
  category?: string
): Promise<TagTreeNode[]> {
  try {
    const params = new URLSearchParams();
    if (slug) {
      params.append("slug", slug);
    }
    if (category) {
      params.append("category", category);
    }
    // 直接访问 API
    const response = await fetch(
      `${getAuthApiUrl("/api/tag")}?${params.toString()}`,
      {
        method: "GET",
        headers: await getCommonHeaders(),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("[homeService] getTagTree failed:", response.status);
      return [];
    }

    const result: ApiResponse<TagTreeNode[]> = await response.json();

    if (result.success && result.data) {
      // API 可能返回 label 而非 name，统一映射
      return result.data.map((node: any) => ({
        ...node,
        name: node.name || node.label || "",
        children: node.children?.map((child: any) => ({
          ...child,
          name: child.name || child.label || "",
        })),
      }));
    }

    return [];
  } catch (error) {
    console.error("[homeService] getTagTree error:", error);
    return [];
  }
}

/**
 * 扁平化标签树（用于横向标签显示）
 */
export function flattenTagTree(nodes: TagTreeNode[]): TagTreeNode[] {
  const result: TagTreeNode[] = [];

  function traverse(node: TagTreeNode) {
    result.push({ ...node, children: undefined });
    if (node.children) {
      node.children.forEach(traverse);
    }
  }

  nodes.forEach(traverse);
  return result;
}

/**
 * 判断标签树是否为扁平结构（横向）
 * 如果没有子节点或只有一层子节点，则为扁平结?
 */
export function isHorizontalTagTree(nodes: TagTreeNode[]): boolean {
  return nodes.every((node) => !node.children || node.children.length === 0);
}

// ============== 事件列表 API ==============

/**
 * 获取事件列表
 */
export async function getEvents(query: EventsQuery = {}): Promise<EventsResp> {
  try {
    const params = new URLSearchParams();

    // category 参数（navigation 接口返回?slug?
    if (query.category) params.append("category", query.category);
    // tag_slug 参数
    if (query.tag_slug) params.append("tag_slug", query.tag_slug);
    if (query.series_slug) params.append("series_slug", query.series_slug);
    if (query.active !== undefined)
      params.append("active", String(query.active));
    if (query.closed !== undefined)
      params.append("closed", String(query.closed));
    if (query.archived !== undefined)
      params.append("archived", String(query.archived));
    if (query.collected) params.append("collected", "true");
    if (query.search) params.append("search", query.search);
    if (query.q) params.append("q", query.q);
    // 排序参数：支持多字段格式?"-volume,+startdate"，默?-volume
    params.append("order", query.order || "-volume");
    if (query.limit !== undefined) params.append("limit", String(query.limit));
    if (query.offset !== undefined)
      params.append("offset", String(query.offset));

    // 直接访问 API
    const url = `${getAuthApiUrl("/api/events")}${
      params.toString() ? `?${params.toString()}` : ""
    }`;

    const response = await fetch(url, {
      method: "GET",
      headers: await getCommonHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[homeService] getEvents failed:", response.status);
      return { total: 0, nextOffset: 0, events: [] };
    }

    const result = await response.json();

    if (result.success && result.data) {
      // 实际 API 返回: { code, success, data: EventSummary[], msg }
      // data 直接是事件数组，不是 { total, nextOffset, events } 对象
      if (Array.isArray(result.data)) {
        const events = result.data as EventSummary[];
        const currentOffset = query.offset || 0;
        return {
          total: currentOffset + events.length,
          nextOffset: currentOffset + events.length,
          events,
        };
      }

      // 兼容文档格式: { code, success, data: { total, nextOffset, events }, msg }
      if (result.data.events) {
        return result.data as EventsResp;
      }
    }
    return { total: 0, nextOffset: 0, events: [] };
  } catch (error) {
    console.error("[homeService] getEvents error:", error);
    return { total: 0, nextOffset: 0, events: [] };
  }
}

// ============== Crypto 事件列表 API ==============

export interface CryptoEventsQuery {
  slug: string; // 标签 slug: crypto / bitcoin / 5M ?
  limit?: number;
  offset?: number;
  searchText?: string; // 模糊查询
  orderBy?: string; // 排序字段: volume | volume24hr | startdate | enddate | liquidity | createdat | updatedat
  ascending?: boolean; // 是否升序
}

/**
 * 获取 Crypto 事件列表
 * GET /api/crypto?slug=xxx&limit=20&offset=0
 */
export async function getCryptoEvents(
  query: CryptoEventsQuery
): Promise<EventsResp> {
  try {
    const params = new URLSearchParams();
    params.append("slug", query.slug);
    if (query.limit !== undefined) params.append("limit", String(query.limit));
    if (query.offset !== undefined)
      params.append("offset", String(query.offset));
    if (query.searchText) params.append("searchText", query.searchText);
    if (query.orderBy) params.append("orderBy", query.orderBy);
    if (query.ascending !== undefined)
      params.append("ascending", String(query.ascending));

    const url = `${getAuthApiUrl("/api/crypto")}?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: await getCommonHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[homeService] getCryptoEvents failed:", response.status);
      return { total: 0, nextOffset: 0, events: [] };
    }

    const result = await response.json();

    if (result.success && result.data) {
      if (Array.isArray(result.data)) {
        const events = result.data as EventSummary[];
        const currentOffset = query.offset || 0;
        return {
          total: currentOffset + events.length,
          nextOffset: currentOffset + events.length,
          events,
        };
      }

      if (result.data.events) {
        return result.data as EventsResp;
      }
    }

    return { total: 0, nextOffset: 0, events: [] };
  } catch (error) {
    console.error("[homeService] getCryptoEvents error:", error);
    return { total: 0, nextOffset: 0, events: [] };
  }
}

/**
 * Fetch time-tag slugs used by market detail time filtering.
 * GET /api/need-time-tag-tags
 */
export async function getNeedTimeTagTags(
  forceRefresh: boolean = false
): Promise<string[]> {
  const now = Date.now();
  if (
    !forceRefresh &&
    needTimeTagTagsCache &&
    now - needTimeTagTagsCache.fetchedAt < NEED_TIME_TAG_TAGS_CACHE_TTL_MS
  ) {
    return needTimeTagTagsCache.data;
  }

  if (!forceRefresh && needTimeTagTagsInFlight) {
    return needTimeTagTagsInFlight;
  }

  needTimeTagTagsInFlight = (async () => {
    try {
      const response = await fetch(getAuthApiUrl("/api/need-time-tag-tags"), {
        method: "GET",
        headers: await getCommonHeaders(),
        cache: "no-store",
      });

      if (!response.ok) {
        console.error(
          "[homeService] getNeedTimeTagTags failed:",
          response.status
        );
        return [];
      }

      const result: ApiResponse<string[]> = await response.json();
      if (!result.success || !Array.isArray(result.data)) {
        return [];
      }

      const tags = Array.from(
        new Set(
          result.data.filter((item): item is string => typeof item === "string")
        )
      );
      needTimeTagTagsCache = { data: tags, fetchedAt: Date.now() };
      return tags;
    } catch (error) {
      console.error("[homeService] getNeedTimeTagTags error:", error);
      return [];
    } finally {
      needTimeTagTagsInFlight = null;
    }
  })();

  return needTimeTagTagsInFlight;
}

// ============== Crypto End Dates API ==============

export interface CryptoEndDateItem {
  slug: string;
  endDate: number;
}

/**
 * 根据 tags_slug 获取 endDate ?slug 列表
 * POST /api/crypto/end-dates
 * 请求体为 tag slug 字符串数?
 * 返回?10 条的 slug ?endDate
 */
export async function getCryptoEndDates(
  tagSlugs: string[]
): Promise<CryptoEndDateItem[]> {
  try {
    const response = await fetch(getAuthApiUrl("/api/crypto/end-dates"), {
      method: "POST",
      headers: await getCommonHeaders(),
      body: JSON.stringify(tagSlugs),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[homeService] getCryptoEndDates failed:", response.status);
      return [];
    }

    const result = await response.json();

    if (result.success && Array.isArray(result.data)) {
      return result.data as CryptoEndDateItem[];
    }

    return [];
  } catch (error) {
    console.error("[homeService] getCryptoEndDates error:", error);
    return [];
  }
}

/**
 * 根据 slug 获取事件详情
 * GET /api/event/{slug}
 * 返回 PolymarketEventResp 结构
 */
export async function getEventBySlug(
  slug: string
): Promise<PolymarketEventResp | null> {
  try {
    const response = await fetch(getAuthApiUrl(`/api/event/${slug}`), {
      method: "GET",
      headers: await getCommonHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[homeService] getEventBySlug failed:", response.status);
      return null;
    }

    const result = await response.json();

    if (result.success && result.data) {
      return result.data as PolymarketEventResp;
    }

    return null;
  } catch (error) {
    console.error("[homeService] getEventBySlug error:", error);
    return null;
  }
}

/**
 * 根据标签获取事件列表
 */
export async function getEventsByTag(
  tagSlug: string,
  options: Omit<EventsQuery, "tag_slug"> = {}
): Promise<EventsResp> {
  return getEvents({ tag_slug: tagSlug, ...options });
}

/**
 * 搜索事件
 */
export async function searchEvents(
  keyword: string,
  options: Omit<EventsQuery, "search"> = {}
): Promise<EventsResp> {
  return getEvents({ search: keyword, ...options });
}

// ============== 工具函数 ==============

/**
 * 格式化交易量显示
 */
export function formatVolume(volume: number | null | undefined): string {
  if (volume == null) return "$0";
  if (volume >= 1000000) {
    return `$${(volume / 1000000).toFixed(1)}M`;
  }
  if (volume >= 1000) {
    return `$${(volume / 1000).toFixed(1)}K`;
  }
  return `$${volume.toFixed(0)}`;
}

/**
 * 格式化时间戳为相对时?
 */
export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const isZh = typeof window !== "undefined" && (localStorage.getItem("locale") === "zh-CN" || localStorage.getItem("locale") === "zh-TW");

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return isZh ? "刚刚" : "Just now";
  if (minutes < 60) return isZh ? `${minutes}分钟前` : `${minutes}m ago`;
  if (hours < 24) return isZh ? `${hours}小时前` : `${hours}h ago`;
  if (days < 7) return isZh ? `${days}天前` : `${days}d ago`;

  return new Date(timestamp).toLocaleDateString(isZh ? "zh-CN" : undefined);
}

/**
 * 格式化结束时?
 */
export function formatEndTime(timestamp: number | null | undefined): string {
  if (timestamp == null) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const isZh = typeof window !== "undefined" && (localStorage.getItem("locale") === "zh-CN" || localStorage.getItem("locale") === "zh-TW");
  const loc = isZh ? "zh-CN" : "en-US";

  const timeStr = date.toLocaleTimeString(loc, {
    hour: "2-digit",
    minute: "2-digit",
  });

  // 如果是今?
  if (date.toDateString() === now.toDateString()) {
    return `${isZh ? "今天" : "Today"} ${timeStr}`;
  }

  // 如果是明?
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return `${isZh ? "明天" : "Tomorrow"} ${timeStr}`;
  }

  // 其他日期
  return date.toLocaleDateString(loc, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

