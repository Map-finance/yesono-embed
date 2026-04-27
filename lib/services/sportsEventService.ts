/**
 * 体育赛事 API 服务层
 * 基于 docs/API_SPORTS_EVENT.md
 */

import {
  SportsEventDetail,
  SportsEventsQuery,
  SportsEventsResponse,
  SportsEventDetailResponse,
} from '@/types/sports';
import { getAuthApiUrl } from '@/lib/config/authApiUrl';

// API 基础路径 - 与 homeService 保持一致
const API_BASE_URL = getAuthApiUrl('').replace(/\/$/, '');

function getSportsHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const locale = localStorage.getItem('locale');
    if (locale) headers['Accept-Language'] = locale;
  }
  return headers;
}

/**
 * 获取体育赛事列表
 * GET /api/sports/events?tags=sports,soccer,bundesliga&tab=games
 */
export async function getSportsEvents(
  query: SportsEventsQuery = {}
): Promise<SportsEventDetail[]> {
  const params = new URLSearchParams();

  if (query.tags) params.append('tags', query.tags);
  if (query.tab) params.append('tab', query.tab);
  if (query.limit !== undefined) params.append('limit', String(query.limit));
  if (query.offset !== undefined) params.append('offset', String(query.offset));

  try {
    const url = `${API_BASE_URL}/api/sports/events?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getSportsHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[sportsEventService] getSportsEvents failed:', response.status);
      return [];
    }

    const result: SportsEventsResponse = await response.json();

    if (result.success && Array.isArray(result.data)) {
      return result.data;
    }

    return [];
  } catch (error) {
    console.error('[sportsEventService] getSportsEvents error:', error);
    return [];
  }
}

/**
 * 获取体育赛事详情
 * GET /api/sports/events/{slug}
 */
export async function getSportsEventBySlug(
  slug: string
): Promise<SportsEventDetail | null> {
  try {
    const url = `${API_BASE_URL}/api/sports/events/${slug}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: getSportsHeaders(),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[sportsEventService] getSportsEventBySlug failed:', response.status);
      return null;
    }

    const result: SportsEventDetailResponse = await response.json();

    if (result.success && result.data) {
      return result.data;
    }

    return null;
  } catch (error) {
    console.error('[sportsEventService] getSportsEventBySlug error:', error);
    return null;
  }
}
