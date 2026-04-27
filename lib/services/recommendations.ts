/**
 * 个性化推荐服务
 * 简化版：只获取后端推荐的数据，不涉及复杂的配置系统
 */

import { Market } from '@/types/types';

export interface RecommendationResponse {
  markets: Market[];
  categories: string[];
}

/**
 * 获取个性化推荐
 * @param userId 用户ID
 * @param category 分类（可选）
 */
export async function getRecommendations(
  _userId?: string,
  _category?: string
): Promise<RecommendationResponse> {
  return { markets: [], categories: [] };
}

/**
 * 获取推荐分类标签
 */
export async function getRecommendedCategories(
  userId?: string
): Promise<string[]> {
  const { categories } = await getRecommendations(userId);
  return categories;
}

