"use client";

/**
 * CryptoOrderBookView - Crypto 详情页展开后的 mock 订单簿视图。
 * 从 app/crypto/[id]/page.tsx 拆出，机械搬运无修改。
 */

import React from "react";
import { useTranslation } from "@/lib/i18n";

// ========== Order Book 相关 ==========
export interface OrderBookEntry {
  price: number;
  shares: number;
  total: number;
}

// 生成模拟订单簿数据
export const generateOrderBook = (
  percentage: number
): { asks: OrderBookEntry[]; bids: OrderBookEntry[] } => {
  const basePrice = percentage / 100;
  const asks: OrderBookEntry[] = [];
  const bids: OrderBookEntry[] = [];

  // Asks (卖单) - 价格从低到高
  for (let i = 0; i < 4; i++) {
    const price = Math.round((basePrice + 0.001 + i * 0.001) * 1000) / 10;
    const shares = Math.round(Math.random() * 400000 + 3000);
    asks.push({ price, shares, total: Math.round((shares * price) / 100) });
  }

  // Bids (买单) - 价格从高到低
  for (let i = 0; i < 4; i++) {
    const price = Math.round((basePrice - 0.001 - i * 0.001) * 1000) / 10;
    const shares = Math.round(Math.random() * 400000 + 3000);
    bids.push({ price, shares, total: Math.round((shares * price) / 100) });
  }

  return { asks: asks.reverse(), bids };
};

interface CryptoOrderBookViewProps {
  orderBook: { asks: OrderBookEntry[]; bids: OrderBookEntry[] };
  percentage: number;
}

const CryptoOrderBookView: React.FC<CryptoOrderBookViewProps> = ({
  orderBook,
  percentage,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      {/* Trade Yes 表格 */}
      <div className="text-xs text-(--text-secondary) uppercase mb-2 flex items-center gap-2">
        {t.market.buyYes}
        <span className="text-(--text-tertiary)">⊡</span>
      </div>

      {/* 表头 */}
      <div className="grid grid-cols-3 text-xs text-(--text-secondary) py-1 border-b border-(--border)">
        <span className="text-center">Price</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Total</span>
      </div>

      {/* Asks */}
      {orderBook.asks.map((entry, i) => (
        <div
          key={`ask-${i}`}
          className="grid grid-cols-3 text-xs py-1.5 relative"
        >
          <div
            className="absolute left-0 top-0 bottom-0 bg-[rgba(239,68,68,0.15)]"
            style={{
              width: `${Math.min(entry.shares / 5000, 100)}%`,
            }}
          />
          <span className="text-center text-(--green) relative z-10">
            {entry.price}¢
          </span>
          <span className="text-right text-(--text-primary) relative z-10">
            {entry.shares.toLocaleString()}
          </span>
          <span className="text-right text-(--text-secondary) relative z-10">
            ${entry.total.toLocaleString()}
          </span>
        </div>
      ))}

      {/* Asks 标签 */}
      <div className="flex items-center gap-2 py-2">
        <span className="px-2 py-0.5 rounded text-[10px] bg-[rgba(239,68,68,0.2)] text-(--red)">
          {t.market.asks}
        </span>
      </div>

      {/* Last / Spread */}
      <div className="flex justify-between text-xs text-(--text-secondary) py-2 border-y border-(--border)">
        <span>
          {t.market.last} {percentage.toFixed(1)}¢
        </span>
        <span>{t.market.spread} 0.1¢</span>
      </div>

      {/* Bids 标签 */}
      <div className="flex items-center gap-2 py-2">
        <span className="px-2 py-0.5 rounded text-[10px] bg-[rgba(34,197,94,0.2)] text-(--green)">
          {t.market.bids}
        </span>
      </div>

      {/* Bids */}
      {orderBook.bids.map((entry, i) => (
        <div
          key={`bid-${i}`}
          className="grid grid-cols-3 text-xs py-1.5 relative"
        >
          <div
            className="absolute left-0 top-0 bottom-0 bg-[rgba(34,197,94,0.15)]"
            style={{
              width: `${Math.min(entry.shares / 5000, 100)}%`,
            }}
          />
          <span className="text-center text-(--green) relative z-10">
            {entry.price}¢
          </span>
          <span className="text-right text-(--text-primary) relative z-10">
            {entry.shares.toLocaleString()}
          </span>
          <span className="text-right text-(--text-secondary) relative z-10">
            ${entry.total.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

export default CryptoOrderBookView;
