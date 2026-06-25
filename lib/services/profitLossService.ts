/**
 * 盈亏统计服务 - Profit Loss Statistics Service
 * 基于文档 docs/API_PROFIT_LOSS_STATISTICS.md 实现
 */

import { authFetch, getLanguageHeaders } from '../api';
import { getAuthApiUrl } from '@/lib/config/authApiUrl';

const AUTH_BASE_URL = getAuthApiUrl('/api');

// ============== 类型定义 ==============

// 盈亏统计周期类型
export type StatisticsPeriodType = '1D' | '1W' | '1M' | '1Y';

// 排行榜周期类型
export type LeaderboardPeriodType = 'Today' | 'Weekly' | 'Monthly' | 'All';

// 盈亏统计数据点
export interface ProfitLossStatisticsItem {
  time: string;           // ISO 8601 时间
  pnlValue: string;       // 盈亏金额
  pnlRate: string;        // 收益率百分比
  endEquity: string;      // 期末权益
}

// 排行榜用户数据
export interface LeaderboardUser {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  avatarGradient: string | null;
  profitLoss: string;
  volume: string;
}

// 排行榜响应数据
export interface LeaderboardData {
  list: LeaderboardUser[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

// 个人排名概览
export interface MyOverviewData {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  avatarGradient: string | null;
  profitLoss: number;
  volume: number;
}

// API 响应格式
export interface ApiResponse<T> {
  success: boolean;
  code: number;
  msg: string;
  data: T;
}

// 图表数据格式 (用于前端展示)
export interface ChartDataPoint {
  time: string;
  val: number;
  fullTime: string;
}

// ============== API 请求函数 ==============

/**
 * 基础请求函数
 */
async function request<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  console.log('🌐 [ProfitLoss] 发起请求:', { url, method: options.method || 'GET' });

  try {
    const response = await authFetch(url, {
      ...options,
      headers: {
        ...getLanguageHeaders(),
        ...(options.headers || {}),
      },
      mode: 'cors',
      credentials: 'include'
    } as RequestInit);

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ [ProfitLoss] 请求失败:', result);
      throw new Error(result?.msg || response.statusText);
    }

    console.log('✅ [ProfitLoss] 请求成功:', result);
    return result;
  } catch (error) {
    console.error('❌ [ProfitLoss] 请求异常:', error);
    throw error;
  }
}

// ============== 盈亏汇总 API ==============

/**
 * 盈亏汇总（按时间窗）
 * 接口：GET /api/profit-loss/pnl-summary
 * 用于盈亏图头部"对应窗口的总盈亏"展示，避免默认值落在最后一个曲线点
 * 上（曲线点是某时刻 endEquity 衍生值，跟"窗口累计盈亏"语义不同）
 */
export interface ProfitLossSummary {
  todayPnlValue: number;
  weeklyPnlValue: number;
  monthlyPnlValue: number;
  yearlyPnlValue: number;
  totalPnlValue: number;
}

export async function getProfitLossSummary(
  userId?: string,
): Promise<ApiResponse<ProfitLossSummary>> {
  const query = new URLSearchParams();
  if (userId) query.append('userId', userId);
  const qs = query.toString();
  const url = `${AUTH_BASE_URL}/profit-loss/pnl-summary${qs ? `?${qs}` : ''}`;
  return request<ProfitLossSummary>(url);
}

/**
 * 把 UI timeRange 映射到 summary 上的对应字段
 * 1D → todayPnlValue, 1W → weeklyPnlValue, 1M → monthlyPnlValue,
 * 1Y → yearlyPnlValue, ALL → totalPnlValue
 * 找不到 / summary 为空时返回 null（调用方再回退到曲线点）
 */
export function getSummaryValueForRange(
  summary: ProfitLossSummary | null,
  timeRange: string,
): number | null {
  if (!summary) return null;
  switch (timeRange) {
    case '1D':
      return summary.todayPnlValue;
    case '1W':
      return summary.weeklyPnlValue;
    case '1M':
      return summary.monthlyPnlValue;
    case '1Y':
      return summary.yearlyPnlValue;
    case 'ALL':
      return summary.totalPnlValue;
    default:
      return summary.totalPnlValue;
  }
}

// ============== 盈亏统计曲线 API ==============

/**
 * 获取盈亏统计曲线数据
 * @param periodType 周期类型: 1D(日), 1W(周), 1M(月), 1Y(年)
 */
export async function getProfitLossStatistics(
  periodType: StatisticsPeriodType = '1D',
  userId?: string
): Promise<ApiResponse<ProfitLossStatisticsItem[]>> {
  console.log('📤 API: 获取盈亏统计数据...', { periodType, userId });
  const query = new URLSearchParams({ periodType });
  if (userId) query.append('userId', userId);
  const url = `${AUTH_BASE_URL}/profit-loss/statistics?${query.toString()}`;
  return request<ProfitLossStatisticsItem[]>(url);
}

/**
 * 将 API 返回的数据转换为图表格式
 */
export function transformToChartData(
  data: ProfitLossStatisticsItem[],
  periodType: StatisticsPeriodType
): ChartDataPoint[] {
  return data.map((item) => {
    // 后端返回的 time 目前是字符串形式的毫秒时间戳，例如 "1773360000000"
    // 这里统一转换为 number，再交给 Date 处理，避免出现 "Invalid Date"
    const timestamp =
      typeof item.time === "number" ? item.time : Number(item.time);
    const date = new Date(timestamp);
    let time: string;
    let fullTime: string;

    console.log('time',item,date);
    
    // 如果后端时间字段异常，避免在前端展示 "Invalid Date"
    if (!Number.isFinite(timestamp) || Number.isNaN(date.getTime())) {
      return {
        time: String(item.time ?? ""),
        val: parseFloat(item.pnlValue),
        // 留空让前端用时间范围标签兜底
        fullTime: "",
      };
    }

    switch (periodType) {
      case '1D':
        // 日: 显示小时
        time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        fullTime = date.toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true
        });
        break;
      case '1W':
        // 周: 显示星期几
        time = date.toLocaleDateString('en-US', { weekday: 'short' });
        fullTime = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        break;
      case '1M':
        // 月: 显示日期
        time = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        fullTime = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        break;
      case '1Y':
        // 年: 显示月份
        time = date.toLocaleDateString('en-US', { month: 'short' });
        fullTime = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        break;
      default:
        time = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        fullTime = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    return {
      time,
      val: parseFloat(item.pnlValue),
      fullTime,
    };
  });
}

// ============== 排行榜 API ==============

/**
 * 获取排行榜数据
 * @param params 查询参数
 */
type LeaderboardQuery = {
  periodType?: LeaderboardPeriodType;
  searchName?: string;
  page?: number;
  size?: number;
};

function buildLeaderboardUrl(path: string, params: LeaderboardQuery): string {
  const { periodType = 'All', searchName, page = 1, size = 20 } = params;
  const queryParams = new URLSearchParams();
  queryParams.append('periodType', periodType);
  queryParams.append('page', page.toString());
  queryParams.append('size', size.toString());
  if (searchName) {
    queryParams.append('searchName', searchName);
  }
  return `${AUTH_BASE_URL}/${path}?${queryParams.toString()}`;
}

export async function getLeaderboard(
  params: LeaderboardQuery = {}
): Promise<ApiResponse<LeaderboardData>> {
  console.log('📤 API: 获取排行榜数据...', params);
  return request<LeaderboardData>(buildLeaderboardUrl('profit-loss/leaderboard', params));
}

/** 按交易量排行榜(参数/响应与 getLeaderboard 完全一致,仅 endpoint 不同) */
export async function getVolumeLeaderboard(
  params: LeaderboardQuery = {}
): Promise<ApiResponse<LeaderboardData>> {
  console.log('📤 API: 获取交易量排行榜...', params);
  return request<LeaderboardData>(buildLeaderboardUrl('profit-loss/volume-leaderboard', params));
}

/**
 * 获取当前用户排名概览（通过 token 识别用户，无需传 userId）
 * @param periodType 周期类型，与排行榜一致
 */
export async function getMyOverview(
  periodType?: LeaderboardPeriodType
): Promise<ApiResponse<MyOverviewData>> {
  const queryParams = periodType ? `?periodType=${periodType}` : '';
  const url = `${AUTH_BASE_URL}/profit-loss/my-overview${queryParams}`;
  return request<MyOverviewData>(url);
}

/** 当前用户的交易量排名(无参/响应与 getMyOverview 一致,仅 endpoint 不同) */
export async function getMyVolumeOverview(
  periodType?: LeaderboardPeriodType
): Promise<ApiResponse<MyOverviewData>> {
  const queryParams = periodType ? `?periodType=${periodType}` : '';
  const url = `${AUTH_BASE_URL}/profit-loss/my-volume-overview${queryParams}`;
  return request<MyOverviewData>(url);
}

// ============== Hook 辅助函数 ==============

/**
 * 将周期类型从前端格式转换为 API 格式
 */
export function mapTimeRangeToStatisticsPeriod(timeRange: string): StatisticsPeriodType {
  switch (timeRange) {
    case '1D':
      return '1D';
    case '1W':
      return '1W';
    case '1M':
      return '1M';
    case 'ALL':
    case '1Y':
      return '1Y';
    default:
      return '1D';
  }
}

/**
 * 将周期类型从前端格式转换为排行榜 API 格式
 */
export function mapTimeRangeToLeaderboardPeriod(timeRange: string): LeaderboardPeriodType {
  switch (timeRange) {
    case 'Today':
      return 'Today';
    case 'Weekly':
      return 'Weekly';
    case 'Monthly':
      return 'Monthly';
    case 'All':
    default:
      return 'All';
  }
}
