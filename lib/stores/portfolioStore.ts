import { create } from "zustand";

export interface PortfolioItem {
  unionKey: string;
  marketId: number;
  marketOutcomeId: number;
  name: string;
  price: number;
  calculatedBalance: number;
  value: number;
}

interface PortfolioState {
  /** 现金余额 */
  cash: number;
  /** 总资产（cash + 持仓价值） */
  portfolio: number;
  /** 持仓明细 */
  items: PortfolioItem[];
  /** 是否正在加载 */
  isLoading: boolean;
  /** 更新 portfolio 数据 */
  setPortfolioData: (data: {
    cash: number;
    portfolio: number;
    items?: PortfolioItem[];
  }) => void;
  /** 设置加载状态 */
  setLoading: (loading: boolean) => void;
  /** 重置（登出时） */
  reset: () => void;
}

export const usePortfolioStore = create<PortfolioState>()((set) => ({
  cash: 0,
  portfolio: 0,
  items: [],
  isLoading: true,
  setPortfolioData: (data) =>
    set({
      cash: data.cash,
      portfolio: data.portfolio,
      items: data.items || [],
      isLoading: false,
    }),
  setLoading: (loading) => set({ isLoading: loading }),
  reset: () => set({ cash: 0, portfolio: 0, items: [], isLoading: true }),
}));
