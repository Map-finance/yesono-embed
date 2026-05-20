"use client";

import React from "react";
import { getAssetColor } from "@/utils/format";

interface ChartToggleSwitchProps {
  activeChart: "probability" | "price";
  onChange: (view: "probability" | "price") => void;
  symbol?: string; // e.g. "btc", "eth", "sol", "xrp"
}

export default function ChartToggleSwitch({
  activeChart,
  onChange,
  symbol = "btc",
}: ChartToggleSwitchProps) {
  // Whether the price chart is active
  const isPrice = activeChart === "price";
  const assetColor = getAssetColor(symbol);

  // Determine the asset icon
  const getAssetIcon = () => {
    const s = symbol.toLowerCase();
    if (s.includes("eth")) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18px"
          height="18px"
          viewBox="0 0 18 18"
          className="transition-all duration-200 group-hover:text-(--tabs-asset-color)"
        >
          <path
            d="M3.25 9.5L9 16.75L14.75 9.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M14.75 9.5L9 1.25L3.25 9.5L9 12L14.75 9.5Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M9 1.25V12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    }
    if (s.includes("sol")) {
      return (
        <svg
          height="18"
          width="18"
          viewBox="0 0 18 18"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-all duration-200 group-hover:text-(--tabs-asset-color)"
        >
          <path
            d="M4.75291 11.5971C4.83008 11.52 4.93378 11.4766 5.0423 11.4766H15.0866C15.2699 11.4766 15.3615 11.6984 15.2313 11.8262L13.2466 13.811C13.1694 13.8882 13.0657 13.9316 12.9572 13.9316H2.91286C2.72958 13.9316 2.63794 13.7097 2.76817 13.5819L4.75291 11.5971Z"
            fill="currentColor"
          />
          <path
            d="M4.75291 4.18894C4.83008 4.11177 4.93378 4.06836 5.0423 4.06836H15.0866C15.2699 4.06836 15.3615 4.29023 15.2313 4.41804L13.2466 6.40037C13.1694 6.47754 13.0657 6.52095 12.9572 6.52095H2.91286C2.72958 6.52095 2.63794 6.29909 2.76817 6.17127L4.75291 4.18894Z"
            fill="currentColor"
          />
          <path
            d="M13.2466 7.86911C13.1694 7.79194 13.0657 7.74854 12.9572 7.74854H2.91286C2.72958 7.74854 2.63794 7.9704 2.76817 8.09822L4.75291 10.0805C4.83008 10.1577 4.93378 10.2011 5.0423 10.2011H15.0866C15.2699 10.2011 15.3615 9.97926 15.2313 9.85145L13.2466 7.86911Z"
            fill="currentColor"
          />
        </svg>
      );
    }
    if (s.includes("xrp")) {
      return (
        <svg
          height="18"
          width="18"
          viewBox="0 0 18 18"
          xmlns="http://www.w3.org/2000/svg"
          className="transition-all duration-200 group-hover:text-(--tabs-asset-color)"
        >
          <path
            d="M13.4545 3.54541H15.2772L11.4851 7.46841C10.1125 8.88849 7.88691 8.88849 6.51423 7.46841L2.72217 3.54541H4.54483L7.42556 6.52562C8.29492 7.425 9.70439 7.425 10.5738 6.52562L13.4545 3.54541Z"
            fill="currentColor"
          />
          <path
            d="M4.52189 14.4542H2.69922L6.5147 10.5069C7.88738 9.08688 10.1129 9.08688 11.4857 10.5069L15.3011 14.4542H13.4784L10.5743 11.4497C9.70486 10.5503 8.2954 10.5503 7.42604 11.4497L4.52189 14.4542Z"
            fill="currentColor"
          />
        </svg>
      );
    }
    // Default: BTC
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18px"
        height="18px"
        viewBox="0 0 18 18"
        className="transition-all duration-200 group-hover:text-(--tabs-asset-color)"
      >
        <line
          x1="11.809"
          y1="2.445"
          x2="11.253"
          y2="4.654"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <line
          x1="8.89"
          y1="14.041"
          x2="8.334"
          y2="16.25"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M6.283,3.403l6.074,1.529c1.22,.307,1.96,1.545,1.653,2.765h0c-.307,1.22-1.545,1.96-2.765,1.653l-3.865-.973"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <path
          d="M7.38,8.376l4.418,1.112c1.372,.345,2.205,1.738,1.859,3.11h0c-.345,1.372-1.738,2.205-3.11,1.86l-6.626-1.668"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
        <line
          x1="9.048"
          y1="1.75"
          x2="5.573"
          y2="15.555"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    );
  };

  return (
    <div className="relative border border-(--border) rounded-lg p-1 lg:bg-background lg:backdrop-blur-none bg-(--bg-secondary) backdrop-blur-xs inline-flex">
      <div
        role="group"
        dir="ltr"
        className="flex items-center justify-center flex-row gap-0.5"
        tabIndex={0}
        style={{ outline: "none" }}
      >
        {/* Probability Chart Button (Left) */}
        <button
          type="button"
          data-state={!isPrice ? "on" : "off"}
          role="radio"
          aria-checked={!isPrice}
          onClick={() => onChange("probability")}
          className={`relative z-10 gap-2 rounded-lg text-sm font-medium transition-all duration-125 outline-hidden disabled:pointer-events-none disabled:opacity-50 px-1.5 min-w-8 size-8 shrink-0 flex items-center justify-center p-0! hover:bg-(--bg-hover) cursor-pointer
          ${
            !isPrice
              ? "text-[#3b82f6]"
              : "text-(--text-secondary) hover:text-(--text-primary)"
          }`}
          tabIndex={!isPrice ? 0 : -1}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18px"
            height="18px"
            viewBox="0 0 18 18"
            className="w-[unset]! h-[unset]! pointer-events-none shrink-0 transition-all duration-200"
          >
            <path
              d="M2.75,10.75l3.646-3.646c.195-.195,.512-.195,.707,0l3.293,3.293c.195,.195,.512,.195,.707,0l4.146-4.146"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
            <path
              d="M2.75,2.75V12.75c0,1.105,.895,2,2,2H15.25"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>

        {/* Live Price Chart Button (Right) */}
        <button
          type="button"
          data-state={isPrice ? "on" : "off"}
          role="radio"
          aria-checked={isPrice}
          onClick={() => onChange("price")}
          className={`relative z-10 gap-2 rounded-lg text-sm font-medium transition-all duration-125 outline-hidden disabled:pointer-events-none disabled:opacity-50 px-1.5 min-w-8 size-8 shrink-0 flex items-center justify-center p-0! hover:bg-(--bg-hover) cursor-pointer group
          ${
            !isPrice &&
            "text-(--text-secondary) hover:text-(--text-primary)"
          }`}
          style={isPrice ? { color: assetColor } : {}}
          tabIndex={isPrice ? 0 : -1}
        >
          {getAssetIcon()}
        </button>
      </div>

      {/* Sliding Background Block */}
      {/* 注意：垂直居中只用内联 transform 的 -50%，不要再加 Tailwind 的 -translate-y-1/2。
          v4 里 translate 工具走独立的 `translate` 属性，会和内联 `transform` 叠加，
          导致 Y 方向被平移两次（-100%），滑块顶出容器。 */}
      <div
        className={`absolute pointer-events-none top-1/2 w-8 h-8 shrink-0 rounded-sm transition-all! duration-200 z-0
        ${!isPrice ? "bg-[#3b82f6]/10 dark:bg-[#3b82f6]/20" : ""}`}
        style={{
          ...(isPrice ? { backgroundColor: assetColor, opacity: 0.15 } : {}),
          transform: `translate(calc(${isPrice ? 34 : 0}px), -50%)`,
          width: "calc(32px)",
          transformOrigin: "center center",
        }}
      ></div>
    </div>
  );
}
