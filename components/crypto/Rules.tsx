"use client";

import React from "react";
import { ChevronDown } from "lucide-react";
import ProxyImage from "@/components/common/ProxyImage";

interface RulesProps {
  /** 是否展开规则详情 */
  isExpanded: boolean;
  /** 切换展开状态 */
  onToggle: () => void;
  /** 规则简介文本（收起时显示） */
  summaryText?: string;
  /** 规则详情内容（展开时显示的额外段落） */
  detailParagraphs?: string[];
  /** 创建时间 */
  createdAt?: string;
  /** 解析器地址 */
  resolverAddress?: string;
  /** 解析源链接 */
  sourceLink?: string;
}

/**
 * Rules - 规则折叠面板组件
 * 用于展示市场规则，支持展开/收起
 */
const Rules: React.FC<RulesProps> = ({
  isExpanded,
  onToggle,
  summaryText = 'This market will immediately resolve to "Yes" if any Binance 1 minute candle for Bitcoin (BTCUSDT) between December 30, 2024, 20:00',
  detailParagraphs = [
    'and December 31, 2025, 23:59 in the ET timezone has a final "High" price of $1,000,000 or higher. Otherwise, this market will resolve to "No."',
    'The resolution source for this market is Binance, specifically the BTCUSDT "High" prices available at',
    "Please note that the outcome of this market depends solely on the price data from the Binance BTCUSDT trading pair. Prices from other exchanges, different trading pairs, or spot markets will not be considered for the resolution of this market.",
  ],
  createdAt = "Dec 31, 2024, 6:06 AM GMT+8",
  resolverAddress = "0x6A9D22261...",
  sourceLink = "https://www.binance.com/en/trade/BTC_USDT",
}) => {
  return (
    <div className="mt-8">
      <h3 className="text-[16px] font-bold text-white mb-6">Rules</h3>

      <div className="space-y-4">
        <p className="text-[15px] leading-relaxed text-slate-300">
          {summaryText}
          {!isExpanded && <span className="ml-1 text-slate-500">...</span>}
        </p>

        {/* 隐藏的详细规则内容 */}
        <div
          className={`grid transition-all duration-300 ease-in-out ${
            isExpanded
              ? "grid-rows-[1fr] opacity-100"
              : "grid-rows-[0fr] opacity-0 overflow-hidden"
          }`}
        >
          <div className="overflow-hidden space-y-4">
            <p className="text-[15px] leading-relaxed text-slate-300">
              {detailParagraphs[0]}
            </p>
            <p className="text-[15px] leading-relaxed text-slate-300">
              {detailParagraphs[1]}{" "}
              <a href={sourceLink} className="text-blue-400 hover:underline">
                {sourceLink}
              </a>
              , with the chart settings on &quot;1m&quot; for one-minute candles
              selected on the top bar.
            </p>
            <p className="text-[15px] leading-relaxed text-slate-300">
              {detailParagraphs[2]}
            </p>

            <div className="pt-4">
              <p className="text-[14px] text-slate-500 font-bold">
                Created At: <span className="text-slate-400">{createdAt}</span>
              </p>
            </div>

            {/* UMA Resolver Card */}
            <div className="mt-6 p-5 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center gap-4 group cursor-pointer hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded bg-[#e31a31] flex items-center justify-center p-2 shrink-0">
                <ProxyImage
                  src="https://cryptologos.cc/logos/uma-uma-logo.png"
                  className="w-full h-full object-contain invert"
                  alt="UMA"
                />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="text-[14px] font-bold text-slate-400">
                  Resolver
                </div>
                <div className="text-[15px] font-medium text-blue-400 truncate group-hover:underline">
                  {resolverAddress}
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-full text-[13px] font-bold transition-all shadow-md active:scale-95">
                Propose resolution
              </button>
            </div>
          </div>
        </div>

        {/* Toggle Button */}
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 text-[14px] font-bold text-white hover:text-slate-300 transition-colors mt-2"
        >
          {isExpanded ? "Show less" : "Show more"}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-300 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
    </div>
  );
};

export default Rules;
