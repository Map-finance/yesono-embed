export interface StepConfig {
  component: React.ComponentType<any>;
  props?: Record<string, any>;
}

export interface CreateMarketData {
    prediction?: string;
    title?: string;
    endDate?: string;
    rules?: string;
    category?: string;
    token?: string;
    image?: string | null;
    proposerReward?: string;
    stakeDeposit?: string;
    marketType?: 'general' | 'sports';
    // 新增字段 - Sports 市场
    sportType?: string;
    gameId?: string;
    conditionType?: string;
    conditionSettings?: Record<string, any>;
    // 新增字段 - 链上数据
    questionId?: string;
    ancillaryData?: string;
    generatedTitle?: string;
    generatedDescription?: string;
}

// 定义哪些分类属于运动市场
export const SPORTS_CATEGORIES = ["Sports"];

// 根据分类判断市场类型
export function getMarketTypeByCategory(category?: string): 'general' | 'sports' {
    if (!category) return 'general';
    return SPORTS_CATEGORIES.includes(category) ? 'sports' : 'general';
}
