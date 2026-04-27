import { create } from "zustand";

type Direction = "buy" | "sell";

interface OrderBookSide {
  price: string;
  size: string;
}

interface OrderBook {
  bids: OrderBookSide[];
  asks: OrderBookSide[];
}

interface TradingState {
  direction: Direction;
  market: any | null;
  event: any | null;
  selectOutcomeId: string | null;
  orderBookRaw: Record<string, OrderBook | null>;
  setDirection: (d: Direction) => void;
  setMarket: (m: any | null) => void;
  setEvent: (e: any | null) => void;
  setSelectOutcomeId: (id: string | null) => void;
  getOrderBook: (key?: string) => OrderBook | null;
}

export const useTradingStore = create<TradingState>((set, get) => ({
  direction: "buy",
  market: null,
  event: null,
  selectOutcomeId: null,
  orderBookRaw: {},
  setDirection: (direction) => set({ direction }),
  setMarket: (market) => set({ market }),
  setEvent: (event) => set({ event }),
  setSelectOutcomeId: (selectOutcomeId) => set({ selectOutcomeId }),
  getOrderBook: (key) => {
    if (!key) return null;
    return get().orderBookRaw[key] ?? null;
  },
}));
