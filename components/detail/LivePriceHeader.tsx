"use client";

import React, { useState, useEffect } from "react";
import NumberFlow from "@number-flow/react";
import { getAssetColor } from "@/utils/format";
import { useTranslation } from "@/lib/i18n";
import { serverNow } from "@/lib/utils/serverTime";
import GoToLiveMarketButton from "./GoToLiveMarketButton";

interface LivePriceHeaderProps {
  isLive: boolean; // Computed by parent, true if we haven't reached endDate
  currentPrice: number;
  priceChange: number;
  /** 开盘价（Price to beat）/ 收盘价（Final price），由父组件 LivePriceChart 统一拉取下发 */
  priceToBeat?: number | null;
  finalPrice?: number | null;
  endDate?: number; // timestamp in milliseconds
  symbol?: string;
  /** 市场频率标签，如 "5m" / "15m" / "1h" / "4h" / "daily" / "weekly" */
  frequencySlug?: string;
  /** 当前处于 LIVE 状态的市场 slug，用于"Go to live market"跳转 */
  liveMarketSlug?: string;
}

const DEFAULT_LIVE_PRICE_HEADER_TEXT = {
  currentPrice: "Current price",
  priceToBeat: "Price to beat",
  finalPrice: "Final price",
  goToLiveMarket: "Go to live market",
  liveButton: "Live",
  settling: "Settling…",
  countdown: {
    days: "Days",
    hours: "Hours",
    minutes: "Mins",
    seconds: "Secs",
  },
};

export default function LivePriceHeader({
  isLive,
  currentPrice,
  priceChange,
  priceToBeat = null,
  finalPrice = null,
  endDate,
  symbol,
  liveMarketSlug,
}: LivePriceHeaderProps) {
  const { t, locale } = useTranslation();
  // 价差用「头部实际展示的两个价格（都按 2 位小数四舍五入）」相减，保证
  // 价差 === 目标价 − 最终价（显示值）。openPrice/closePrice 是后端全精度数，
  // 直接用全精度算会出现视觉上 3.69、却显示成 3.68 的割裂。缺价格时回退到 priceChange。
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const comparePrice = isLive ? currentPrice : finalPrice;
  const displayChange =
    priceToBeat != null && comparePrice != null
      ? round2(comparePrice) - round2(priceToBeat)
      : priceChange;
  const isPositive = displayChange >= 0;
  const assetColor = getAssetColor(symbol);
  // Green for up, red for down. Match Polymarket styling.
  const changeColor = isPositive ? "text-[#00C213]" : "text-[#FF453A]";
  const changeSymbol = isPositive ? "▲" : "▼";
  const livePriceHeaderText =
    (t.market as any).livePriceHeader ?? DEFAULT_LIVE_PRICE_HEADER_TEXT;
  const countdownText =
    livePriceHeaderText.countdown ?? DEFAULT_LIVE_PRICE_HEADER_TEXT.countdown;
  const settlingText =
    livePriceHeaderText.settling ?? DEFAULT_LIVE_PRICE_HEADER_TEXT.settling;
  // 已结束但后端结算价(finalPrice/closePrice)还没到 → 结算中:显示占位、不展示最后
  // 一跳价 / 涨跌,对齐 Polymarket(结算价只认后端,过渡期显示 pending,不拿最后一跳冒充)
  const isSettling = !isLive && finalPrice === null;
  const formatChange = `$${Math.abs(displayChange).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  // priceToBeat（开盘价）/ finalPrice（收盘价）由父组件 LivePriceChart 经
  // useEventSettlementPrices 统一拉取并下发，保证与折线图末点同源。

  // Internal ticking state to guarantee smooth 1s updates for NumberFlow animation
  // without relying on parent re-renders which might get batched or delayed
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    // If not live, or missing endDate, zero out the countdown
    if (!isLive || !endDate) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      return;
    }

    const updateCountdown = () => {
      // 用服务器校准时间(WS tick 时间戳校准);没收到 WS 时 serverNow() 退化为本地 Date.now()
      const difference = endDate - serverNow();
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor(
          (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        ),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      });
    };

    updateCountdown(); // Run once immediately

    // Use requestAnimationFrame for smoother updates
    let animationFrameId: number;
    let lastUpdate = Date.now();

    const tick = () => {
      const now = Date.now();
      if (now - lastUpdate >= 1000) {
        updateCountdown();
        lastUpdate = now;
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [endDate, isLive]);

  return (
    <div className="flex items-start sm:items-center justify-between w-full py-2 mb-4 gap-3">
      {/* Left side: Prices */}
      <div className="flex items-center min-w-0">
        {/* Price to beat */}
        <div className="flex flex-col opacity-100 min-w-0">
          <div className="flex items-center gap-1 justify-between">
            <span className="text-xs font-semibold text-(--text-secondary)/80">
              {livePriceHeaderText.priceToBeat}
            </span>
          </div>
          <span className="mt-1 tracking-wide font-[620] text-(--text-secondary) text-xl sm:text-2xl leading-none">
            {priceToBeat !== null
              ? `$${priceToBeat.toLocaleString(locale, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : "—"}
          </span>
        </div>

        {/* Vertical Divider */}
        <div className="w-px h-8 border-r border-(--border) my-auto mx-2 sm:mx-3 lg:mx-5"></div>

        {/* Current / Final price */}
        <div className="flex flex-col opacity-100 min-w-0">
          <div className="flex items-center gap-1 justify-between">
            <span
              className={`text-xs font-semibold ${
                !isLive ? "text-(--text-primary)/80" : ""
              }`}
              style={isLive ? { color: assetColor, opacity: 0.85 } : {}}
            >
              {isLive
                ? livePriceHeaderText.currentPrice
                : livePriceHeaderText.finalPrice}
            </span>
            {/* 未开始的市场没有开盘价基准(priceToBeat=null,初始价显示「—」),涨跌无从谈起,
                不展示;结算中(isSettling)同样不展示;有基准价后才显示「当前/最终价 − 开盘价」 */}
            {!isSettling && currentPrice !== 0 && priceToBeat != null && (
              <span className={`text-[11px] font-semibold ${changeColor}`}>
                {changeSymbol} {formatChange}
              </span>
            )}
          </div>
          <div
            className={`mt-1 tracking-wide font-[620] text-xl sm:text-2xl leading-none flex items-center ${
              !isLive ? "text-(--text-primary)" : ""
            }`}
            style={isLive ? { color: assetColor } : {}}
          >
            {isLive ? (
              <NumberFlow
                value={currentPrice}
                format={{
                  style: "currency",
                  currency: "USD",
                  currencyDisplay: "narrowSymbol",
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }}
              />
            ) : finalPrice !== null ? (
              <span>
                $
                {finalPrice.toLocaleString(locale, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            ) : isSettling ? (
              // 结算中:后端结算价未到的过渡态(对齐 Polymarket,不显示最后一跳价)
              <span className="text-base sm:text-lg text-(--text-secondary) animate-pulse">
                {settlingText}
              </span>
            ) : (
              <span className="text-(--text-secondary)">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Countdown or Go to live market button */}
      <div className="shrink-0">
        {isLive ? (
          <div className="hidden sm:flex items-center gap-3 lg:gap-4">
            {timeLeft.days > 0 && (
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-[#FF453A] leading-none mb-1">
                  <NumberFlow
                    value={timeLeft.days}
                    format={{ minimumIntegerDigits: 2 }}
                  />
                </span>
                <span className="text-[10px] text-(--text-secondary) uppercase font-bold tracking-wider">
                  {countdownText.days}
                </span>
              </div>
            )}
            {timeLeft.hours > 0 && (
              <div className="flex flex-col items-center">
                <span className="text-3xl font-bold text-[#FF453A] leading-none mb-1">
                  <NumberFlow
                    value={timeLeft.hours}
                    format={{ minimumIntegerDigits: 2 }}
                  />
                </span>
                <span className="text-[10px] text-(--text-secondary) uppercase font-bold tracking-wider">
                  {countdownText.hours}
                </span>
              </div>
            )}
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold text-[#FF453A] leading-none mb-1">
                <NumberFlow
                  value={timeLeft.minutes}
                  format={{ minimumIntegerDigits: 2 }}
                />
              </span>
              <span className="text-[10px] text-(--text-secondary) uppercase font-bold tracking-wider">
                {countdownText.minutes}
              </span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold text-[#FF453A] leading-none mb-1">
                <NumberFlow
                  value={timeLeft.seconds}
                  format={{ minimumIntegerDigits: 2 }}
                />
              </span>
              <span className="text-[10px] text-(--text-secondary) uppercase font-bold tracking-wider">
                {countdownText.seconds}
              </span>
            </div>
          </div>
        ) : (
          <GoToLiveMarketButton liveMarketSlug={liveMarketSlug} />
        )}
      </div>
    </div>
  );
}
