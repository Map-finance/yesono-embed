import { create } from "zustand";
import { MarketStore, MarketItem } from "../../types/crypto";
// 删除这行: import { geminiService } from "../services/geminiService";
import { mockCryptoMarkets } from "@/app/crypto/mockData";

export const useMarketStore = create<MarketStore>((set, get) => ({
  markets: [],
  filteredMarkets: [],
  loading: false,
  searchQuery: "",
  selectedCategory: "Crypto",
  selectedAsset: "All",

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().applyFilters();
  },

  setCategory: (category) => {
    set({ selectedCategory: category });
    get().applyFilters();
  },

  setAsset: (asset) => {
    set({ selectedAsset: asset });
    get().applyFilters();
  },

  applyFilters: () => {
    const { markets, searchQuery, selectedAsset } = get();
    let filtered = [...markets];

    if (searchQuery) {
      filtered = filtered.filter((m) =>
        m.question.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedAsset !== "All") {
      filtered = filtered.filter((m) => m.asset === selectedAsset);
    }

    set({ filteredMarkets: filtered });
  },

  fetchMarkets: async () => {
    set({ loading: true });
    try {
      // 使用 mock 数据替代 API 调用
      // 模拟网络延迟
      await new Promise((resolve) => setTimeout(resolve, 500));
      const markets = mockCryptoMarkets;
      set({ markets, filteredMarkets: markets, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },
}));
