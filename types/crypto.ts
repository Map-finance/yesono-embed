export interface Outcome {
  label: string;
  probability: string;
}

export interface MarketItem {
  id: string;
  question: string;
  category: string;
  asset: "BTC" | "ETH" | "SOL" | "XRP" | "DOGE" | "OTHER";
  volume: string;
  outcomes: Outcome[];
  isLive: boolean;
  hasGift?: boolean;
}

export type SortOption = "volume" | "newest" | "ending-soon";

export interface MarketStore {
  markets: MarketItem[];
  filteredMarkets: MarketItem[];
  loading: boolean;
  searchQuery: string;
  selectedCategory: string;
  selectedAsset: string;
  setSearchQuery: (query: string) => void;
  setCategory: (category: string) => void;
  setAsset: (asset: string) => void;
  applyFilters: () => void;
  fetchMarkets: () => Promise<void>;
}
