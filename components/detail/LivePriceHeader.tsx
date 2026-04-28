"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NumberFlow from "@number-flow/react";
import { getAssetColor } from "@/utils/format";
import { useTranslation } from "@/lib/i18n";
import { getAuthApiUrl } from "@/lib/config/authApiUrl";

interface LivePriceHeaderProps {
  isLive: boolean; // Computed by parent, true if we haven't reached endDate
  currentPrice: number;
  priceChange: number;
  endDate?: number; // timestamp in milliseconds
  symbol?: string;
  /** 市场频率标签，如 "5m" / "15m" / "1h" / "4h" / "daily" / "weekly" */
  frequencySlug?: string;
  /** 当前处于 LIVE 状态的市场 slug，用于"Go to live market"跳转 */
  liveMarketSlug?: string;
}

const PRICE_API_BASE = getAuthApiUrl('/api/crypto/chainlink/price');

const DEFAULT_LIVE_PRICE_HEADER_TEXT = {
  currentPrice: "Current price",
  priceToBeat: "Price to beat",
  finalPrice: "Final price",
  goToLiveMarket: "Go to live market",
  liveButton: "Live",
  countdown: {
    days: "Days",
    hours: "Hours",
    minutes: "Mins",
    seconds: "Secs",
  },
};

function getMarketRouteSuffix(pathname: string) {
  const match = pathname.match(/^\/market\/[^/]+(\/.*)?$/);
  return match?.[1] ?? "";
}

function parseFrequencyOffsetMs(frequencySlug?: string): number | null {
  if (!frequencySlug) return null;

  const minuteMatch = frequencySlug.match(/^(\d+)M$/);
  if (minuteMatch) return Number(minuteMatch[1]) * 60 * 1000;

  const hourMatch = frequencySlug.match(/^(\d+)H$/);
  if (hourMatch) return Number(hourMatch[1]) * 60 * 60 * 1000;

  const dayMatch = frequencySlug.match(/^(\d+)D$/);
  if (dayMatch) return Number(dayMatch[1]) * 24 * 60 * 60 * 1000;

  const weekMatch = frequencySlug.match(/^(\d+)W$/);
  if (weekMatch) return Number(weekMatch[1]) * 7 * 24 * 60 * 60 * 1000;

  if (frequencySlug === "DAILY" || frequencySlug === "daily") {
    return 24 * 60 * 60 * 1000;
  }
  if (frequencySlug === "WEEKLY" || frequencySlug === "weekly") {
    return 7 * 24 * 60 * 60 * 1000;
  }

  return null;
}

async function fetchChainlinkPrice(
  symbol: string,
  payloadTimestamp: number
): Promise<number | null> {
  try {
    const url = `${PRICE_API_BASE}?symbol=${encodeURIComponent(
      symbol
    )}&payloadTimestamp=${payloadTimestamp}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.data?.value === "number" ? data.data.value : null;
  } catch (e) {
    console.warn('[LivePriceHeader] Failed to fetch live price', e);
    return null;
  }
}

export default function LivePriceHeader({
  isLive,
  currentPrice,
  priceChange,
  endDate,
  symbol,
  frequencySlug,
  liveMarketSlug,
}: LivePriceHeaderProps) {
  const pathname = usePathname();
  const { t, locale } = useTranslation();
  const isPositive = priceChange >= 0;
  const assetColor = getAssetColor(symbol);
  // Green for up, red for down. Match Polymarket styling.
  const changeColor = isPositive ? "text-[#00C213]" : "text-[#FF453A]";
  const changeSymbol = isPositive ? "▲" : "▼";
  const livePriceHeaderText =
    (t.market as any).livePriceHeader ?? DEFAULT_LIVE_PRICE_HEADER_TEXT;
  const routeSuffix = getMarketRouteSuffix(pathname);
  const countdownText =
    livePriceHeaderText.countdown ?? DEFAULT_LIVE_PRICE_HEADER_TEXT.countdown;
  const formatChange = `$${Math.abs(priceChange).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const [priceToBeat, setPriceToBeat] = useState<number | null>(null);
  const [finalPrice, setFinalPrice] = useState<number | null>(null);
  const hasFetchedFinalRef = useRef(false);

  // Fetch Price to beat once when endDate / symbol / frequencySlug are available
  useEffect(() => {
    if (!endDate || !symbol) {
      setPriceToBeat(null);
      return;
    }
    hasFetchedFinalRef.current = false;
    setFinalPrice(null);
    setPriceToBeat(null);
    const offsetMs = parseFrequencyOffsetMs(frequencySlug);
    if (offsetMs === null) {
      return;
    }
    const ts = endDate - offsetMs;
    fetchChainlinkPrice(symbol, ts).then((price) => {
      if (price !== null) setPriceToBeat(price);
    });
  }, [endDate, symbol, frequencySlug]);

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
      // isLive just became false (market ended) — fetch Final Price exactly once
      if (!isLive && endDate && symbol && !hasFetchedFinalRef.current) {
        hasFetchedFinalRef.current = true;
        fetchChainlinkPrice(symbol, endDate).then((price) => {
          if (price !== null) setFinalPrice(price);
        });
      }
      return;
    }

    const updateCountdown = () => {
      const difference = endDate - Date.now();
      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        // Fallback: countdown loop hits zero before isLive prop updates
        if (!hasFetchedFinalRef.current && symbol) {
          hasFetchedFinalRef.current = true;
          fetchChainlinkPrice(symbol, endDate).then((price) => {
            if (price !== null) setFinalPrice(price);
          });
        }
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
  }, [endDate, isLive, symbol]);

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
            {currentPrice !== 0 && (
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
        ) : liveMarketSlug ? (
          <Link
            href={`/market/${liveMarketSlug}${routeSuffix}`}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#1f2937]/50 hover:bg-[#374151]/50 rounded-full transition-colors border border-[rgba(255,255,255,0.1)]"
          >
            <div className="relative flex items-center justify-center w-3 h-3">
              <div className="absolute inset-0 rounded-full bg-[#FF453A]/40"></div>
              <div className="absolute inset-0 rounded-full bg-[#FF453A] animate-ping opacity-75"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF453A] relative z-10"></div>
            </div>
            <span className="text-sm font-semibold text-white sm:hidden">
              {livePriceHeaderText.liveButton}
            </span>
            <span className="hidden sm:inline text-sm font-semibold text-white">
              {livePriceHeaderText.goToLiveMarket}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-gray-400"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        ) : (
          <button
            disabled
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[#1f2937]/30 rounded-full border border-[rgba(255,255,255,0.1)] opacity-50 cursor-not-allowed"
          >
            <div className="relative flex items-center justify-center w-3 h-3">
              <div className="absolute inset-0 rounded-full bg-[#FF453A]/40"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF453A] relative z-10"></div>
            </div>
            <span className="text-sm font-semibold text-white sm:hidden">
              {livePriceHeaderText.liveButton}
            </span>
            <span className="hidden sm:inline text-sm font-semibold text-white">
              {livePriceHeaderText.goToLiveMarket}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
