import { Response } from "@/types/resoonse";
import { http, ApiResponse } from "./request";
import { HoldRankGroup } from "@/types/types";
import { getEmbedToken } from "@/lib/embed/EmbedContext";
import { getAuthApiHost } from "@/lib/config/authApiUrl";

const BASE_URL = process.env.NEXT_PUBLIC_C2C_API_BASE_URL!;
const API_HOST = getAuthApiHost();
const AUTH_BASE_URL = `${API_HOST}/api`;

export const getLanguageHeaders = () => {
  let lang = "en";
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("locale");
      if (stored) lang = stored;
    } catch (e) {
      console.warn("[API] Failed to read locale from localStorage", e);
    }
  }
  return { "Accept-Language": lang };
};

export async function getValidAccessToken(): Promise<string | null> {
  return getEmbedToken();
}

export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<globalThis.Response> {
  const accessToken = getEmbedToken();
  const headers = new Headers(options.headers || {});
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, {
    ...options,
    headers,
  });
}

async function request(
  url: string,
  options: RequestInit = {},
  headers: Record<string, string> = {}
) {
  const method = (options.method || "GET").toUpperCase();
  const config: any = { headers: { ...(headers || {}) } };
  const data =
    (options as any).body !== undefined ? (options as any).body : undefined;

  let resp: any;
  if (method === "GET") {
    resp = await http.get(url, config);
  } else if (method === "POST") {
    resp = await http.post(url, data, config);
  } else if (method === "PUT") {
    resp = await http.put(url, data, config);
  } else if (method === "DELETE") {
    resp = await http.delete(url, config);
  } else {
    resp = await http.post(url, data, config);
  }

  return resp && resp.data ? resp.data : resp;
}

export async function favoriteEvent(params: {
  isFavorite: boolean;
  slug: string;
}) {
  return request(
    `${API_HOST}/favorite/event`,
    {
      method: "POST",
      body: JSON.stringify(params),
    },
    getLanguageHeaders()
  );
}

export async function getHoldRank(query: {
  marketId: string | number;
  limit: number;
}): Promise<Response<HoldRankGroup[]>> {
  return request(
    `${AUTH_BASE_URL}/holdings-rank?marketId=${query.marketId}&limit=${query.limit}`,
    {},
    {}
  );
}

export async function getHoldRankPnl(query: {
  marketId: string | number;
}): Promise<Response<HoldRankGroup[]>> {
  return request(
    `${AUTH_BASE_URL}/holdings-rank/pnl?marketId=${query.marketId}`,
    {},
    {}
  );
}

export async function getComments({
  marketId,
  orderBy = "time",
}: {
  marketId: string;
  orderBy: "time" | "like";
}) {
  return request(
    `${AUTH_BASE_URL}/comments?marketId=${marketId}&orderBy=${orderBy}`,
    {},
    {}
  );
}

export async function getSubComments(commentId: number) {
  return request(`${AUTH_BASE_URL}/comments/${commentId}/replies`, {}, {});
}

export type Fidelity =
  | "1MIN"
  | "5MINS"
  | "15MINS"
  | "30MINS"
  | "1HOUR"
  | "4HOURS"
  | "1DAY";

export interface PricePoint {
  t: number;
  p: number;
}

export interface OrderBookEntry {
  price: string;
  size: string;
}

export interface OrderBookData {
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

export interface PriceHistoryData {
  history: PricePoint[];
  orderbook: OrderBookData | null;
  havePoly: boolean;
  polyMarketId: string | null;
  polyAssetId: string | null;
}

export interface PriceHistoryResponse {
  code: number;
  message: string;
  data: PriceHistoryData;
}

export async function getPriceHistory(
  market: string,
  startTs: number,
  fidelity: Fidelity
): Promise<PriceHistoryResponse> {
  return request(
    `${AUTH_BASE_URL}/price-history?startTs=${startTs}&market=${market}&fidelity=${fidelity}`,
    {},
    {}
  );
}

export type { ApiResponse };
