"use client";

/**
 * CryptoDetailPage - Crypto 市场详情页主入口。
 * 大块逻辑已拆出：
 *   - CryptoOutcomeGraph.tsx    展开后的价格走势图
 *   - CryptoOrderBookView.tsx   展开后的 mock 订单簿视图
 *   - CryptoResolvedList.tsx    "View Resolved" 折叠列表
 *   - CryptoRelatedSidebar.tsx  右侧相关推荐侧栏
 */

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMarketStore } from "@/lib/store/cryptoStore";
import { useTranslation, useLocale } from "@/lib/i18n";
import { Gift, RotateCw, RefreshCw } from "lucide-react";
import { MarketItem } from "@/types/crypto";
import { mockOutcomes } from "../mockData";
import MarketDetailTabs from "@/components/detail/MarketDetailTabs";
import MarketContext from "@/components/crypto/MarketContext";
import Rules from "@/components/crypto/Rules";
import ProxyImage from "@/components/common/ProxyImage";
import OutcomeGraph from "./CryptoOutcomeGraph";
import CryptoOrderBookView, { generateOrderBook } from "./CryptoOrderBookView";
import CryptoResolvedList from "./CryptoResolvedList";
import CryptoRelatedSidebar from "./CryptoRelatedSidebar";

// 获取资产图标的辅助函数
const getAssetIcon = (asset: string) => {
  switch (asset) {
    case "BTC":
      return "https://cryptologos.cc/logos/bitcoin-btc-logo.png";
    case "ETH":
      return "https://cryptologos.cc/logos/ethereum-eth-logo.png";
    case "SOL":
      return "https://cryptologos.cc/logos/solana-sol-logo.png";
    case "XRP":
      return "https://cryptologos.cc/logos/xrp-xrp-logo.png";
    case "DOGE":
      return "https://cryptologos.cc/logos/dogecoin-doge-logo.png";
    default:
      return "https://cryptologos.cc/logos/bitcoin-btc-logo.png";
  }
};

export default function CryptoDetailPage() {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const params = useParams();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const router = useRouter();
  const { markets, fetchMarkets } = useMarketStore();
  const [market, setMarket] = useState<MarketItem | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const [showResolved, setShowResolved] = useState(false);
  // 可展开列表项状态
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<
    "orderbook" | "graph" | "resolution"
  >("graph");

  const [contextStatus, setContextStatus] = useState<
    "idle" | "loading" | "done"
  >("idle");
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [fullContextText, setFullContextText] = useState("");
  const [displayedContextText, setDisplayedContextText] = useState("");
  // Rules 状态
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const MOCK_CONTEXT_TEXT = `In the past week, as of December 25, 2025, recent news and market sentiment around Bitcoin's price predictions for the year highlight a mix of cautious optimism and volatility. Bitcoin is currently trading near $87,000, with reports of ETF outflows and a miner hashrate drop adding downward pressure. However, wallet accumulation and institutional buying interest between $80,000–$90,000 provide support. Forecasts range widely, from a potential rebound to $105,000 by year-end to bearish corrections targeting $75,000–$85,000. Macro factors like gold's outperformance and global financial trends continue to influence probabilities for various price outcomes.`;

  // 获取市场数据
  useEffect(() => {
    if (markets.length === 0) {
      fetchMarkets();
    }
  }, [markets.length, fetchMarkets]);

  // 根据 ID 查找市场
  useEffect(() => {
    if (markets.length > 0 && params?.id) {
      const foundMarket = markets.find((m) => m.id === params.id);
      setMarket(foundMarket || null);
    }
  }, [markets, params?.id]);

  useEffect(() => {
    if (!market || !sentinelRef.current) return;

    const sentinelEl = sentinelRef.current;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsScrolled(!entry.isIntersecting);
      },
      {
        rootMargin: "-50px 0px 0px 0px",
        threshold: 0,
      }
    );

    observer.observe(sentinelEl);

    return () => {
      observer.unobserve(sentinelEl);
      observer.disconnect();
    };
  }, [market]);

  // 打字机效果逻辑
  useEffect(() => {
    if (contextStatus === "done" && isContextExpanded && !hasTyped) {
      let i = 0;
      setDisplayedContextText("");
      const interval = setInterval(() => {
        setDisplayedContextText(MOCK_CONTEXT_TEXT.slice(0, i));
        i++;
        if (i > MOCK_CONTEXT_TEXT.length) {
          clearInterval(interval);
          setHasTyped(true);
        }
      }, 10);
      return () => clearInterval(interval);
    } else if (hasTyped) {
      setDisplayedContextText(MOCK_CONTEXT_TEXT);
    }
  }, [contextStatus, isContextExpanded, hasTyped]);

  const handleGenerateClick = () => {
    setContextStatus("loading");
    setTimeout(() => {
      setContextStatus("done");
      setIsContextExpanded(true);
    }, 2000);
  };

  // 从概率字符串中提取数字
  const parsePercentage = (prob: string) => {
    return parseFloat(prob.replace("%", "")) || 50;
  };

  if (!market) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-(--bg-primary)">
        <div className="text-(--text-secondary)">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-(--bg-primary) pb-20 relative">
      <div className="max-w-[1280px] mx-auto grid grid-cols-12 gap-8 px-6">
        <div
          ref={sentinelRef}
          className="absolute top-0 left-0 w-full h-px pointer-events-none opacity-0 z-0"
        />
        {/* 左侧主内容 */}
        <div className="col-span-12 lg:col-span-8">
          {/* Header Section - Sticky */}
          <div ref={headerRef} className="sticky top-[120px] z-40 -mx-6 px-6">
            <div
              className={`transition-all duration-100 ease-in-out border-b ${
                isScrolled
                  ? "bg-(--bg-primary)/95 backdrop-blur-md py-3 border-(--border) shadow-lg"
                  : "pt-8 pb-6 bg-transparent border-transparent"
              }`}
            >
              {/* 第一行：图标 + 标题 + 倒计时 */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1">
                  {/* 资产图标 */}
                  <div
                    className={`rounded-xl bg-orange-500 flex items-center justify-center transition-all duration-100 shrink-0 ${
                      isScrolled ? "w-10 h-10 p-1.5" : "w-16 h-16 p-3.5"
                    }`}
                  >
                    <ProxyImage
                      /**
                       * 中文注释：
                       * - Crypto 资产图标来自第三方站点（cryptologos.cc）
                       * - 生产环境走图片代理，可明显提升海外用户加载速度与稳定性
                       */
                      src={getAssetIcon(market.asset)}
                      className="w-full h-full object-contain invert"
                      alt="asset"
                    />
                  </div>
                  {/* 市场标题 */}
                  <h1
                    className={`font-semibold! text-2xl! text-pretty ${
                      isScrolled ? "text-[18px]" : "text-[32px]"
                    }`}
                  >
                    {market.question}
                  </h1>
                </div>

                {/* 倒计时 */}
                <div
                  className={`flex items-center gap-5 transition-all duration-100 ${
                    isScrolled
                      ? "scale-90 origin-right translate-y-0"
                      : "scale-100"
                  }`}
                >
                  {[
                    { val: "07", label: "DAYS" },
                    { val: "17", label: "HRS" },
                    { val: "51", label: "MINS" },
                  ].map((tItem, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <span className="text-[24px] font-bold text-(--text-primary) leading-none">
                        {tItem.val}
                      </span>
                      <span className="text-[9px] text-(--text-secondary) font-black mt-1.5 tracking-wider uppercase">
                        {tItem.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 第二行：交易量信息 */}
              <div
                className={`transition-all duration-100 overflow-hidden ${
                  isScrolled ? "opacity-0 max-h-0" : "opacity-100 max-h-10 mt-5"
                }`}
              >
                <div className="text-(--text-secondary) text-[14px] font-medium pl-1">
                  {market.volume || "$152,218,277"} {t.common.volume}
                </div>
              </div>
            </div>
          </div>

          {/* 列表头部 */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-bold text-(--text-secondary) uppercase tracking-widest px-2 py-3 border-b border-(--border)">
              <span className="w-1/3">Outcome</span>
              <span className="flex-1 text-center flex items-center justify-center gap-1.5 mr-10">
                % Chance <RotateCw className="w-3 h-3" />
              </span>
              <div className="w-[240px]" />
            </div>

            {/* 结果列表 - 可展开 */}
            <div className="divide-y divide-(--border)">
              {mockOutcomes.map((o, idx) => {
                const isExpanded = expandedIndex === idx;
                return (
                  <div key={idx} className="flex flex-col">
                    {/* 列表项 - 可点击展开 */}
                    <div
                      onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                      className={`group flex items-center justify-between py-5 px-2 hover:bg-(--bg-secondary) transition-all cursor-pointer ${
                        isExpanded ? "bg-(--bg-secondary)" : ""
                      }`}
                    >
                      <div className="w-1/3 flex flex-col gap-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-(--text-secondary) text-[14px] font-bold">
                            ↑
                          </span>
                          <span className="text-[17px] font-bold text-(--text-primary) border-b border-dashed border-(--border) pb-0.5 group-hover:border-(--text-secondary) transition-colors cursor-help">
                            {o.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] text-(--text-secondary) font-bold">
                          <span>
                            {o.vol} {t.common.volume}
                          </span>
                          {o.hasGift && (
                            <Gift className="w-3.5 h-3.5 text-(--text-tertiary)" />
                          )}
                        </div>
                      </div>

                      <div className="flex-1 text-center">
                        <span
                          className={`text-[28px] font-bold tracking-tighter transition-colors ${
                            isExpanded
                              ? "text-(--text-primary)"
                              : "text-(--text-secondary) group-hover:text-(--text-primary)"
                          }`}
                        >
                          {o.prob}
                        </span>
                      </div>

                      <div className="w-[240px] flex gap-2.5 justify-end">
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex flex-col items-center justify-center bg-[#294a4c] hover:bg-[#00d684] text-[#3eae6b] hover:text-white rounded-md px-4 py-2 w-[115px] transition-all shadow-lg shadow-[#00c076]/10"
                        >
                          <span className="text-[13px] font-black uppercase leading-tight">
                            {t.market.buyYes}
                          </span>
                          <span className="text-[11px] font-bold opacity-80 leading-tight">
                            {o.yesPrice}
                          </span>
                        </button>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="flex flex-col items-center justify-center bg-[#2d2424] hover:bg-[#ff4d4d] text-[#ff4d4d] hover:text-white rounded-md px-4 py-2 w-[115px] transition-all border border-[#451a1a] hover:border-transparent group/no"
                        >
                          <span className="text-[13px] font-black uppercase leading-tight">
                            {t.market.buyNo}
                          </span>
                          <span className="text-[11px] font-bold opacity-80 leading-tight group-hover/no:text-white">
                            {o.noPrice}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* 展开的内容区域 */}
                    {isExpanded &&
                      (() => {
                        const percentage = parsePercentage(o.prob);
                        const orderBook = generateOrderBook(percentage);
                        return (
                          <div className="bg-(--bg-card) border-y border-(--border) px-4 pb-4">
                            {/* 标签页导航 */}
                            <div className="flex items-center justify-between py-3">
                              <div className="flex gap-4">
                                {[
                                  {
                                    key: "orderbook" as const,
                                    label: t.market.orderBook,
                                  },
                                  {
                                    key: "graph" as const,
                                    label: t.market.chart.graph,
                                  },
                                  {
                                    key: "resolution" as const,
                                    label: t.market.chart.resolution,
                                  },
                                ].map((tab) => (
                                  <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`text-sm font-medium transition-colors ${
                                      activeTab === tab.key
                                        ? "text-(--text-primary)"
                                        : "text-(--text-secondary) hover:text-(--text-primary)"
                                    }`}
                                  >
                                    {tab.label}
                                  </button>
                                ))}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-(--text-secondary)">
                                <RefreshCw size={14} />
                                <span>0.1¢</span>
                              </div>
                            </div>

                            {/* Order Book 内容 */}
                            {activeTab === "orderbook" && (
                              <CryptoOrderBookView
                                orderBook={orderBook}
                                percentage={percentage}
                              />
                            )}

                            {/* Graph 内容 */}
                            {activeTab === "graph" && (
                              <OutcomeGraph
                                percentage={percentage}
                                label={o.label}
                              />
                            )}

                            {/* Resolution 内容 */}
                            {activeTab === "resolution" && (
                              <div className="py-4 text-sm text-(--text-secondary)">
                                <p>{t.market.chart.resolutionSource}</p>
                                <p className="mt-2">
                                  {t.market.chart.resolutionDesc}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 已结算的市场列表 */}
          <CryptoResolvedList
            showResolved={showResolved}
            onToggle={() => setShowResolved(!showResolved)}
          />

          {/* Market Context 组件 */}
          <MarketContext
            contextStatus={contextStatus}
            isExpanded={isContextExpanded}
            onExpandToggle={() => setIsContextExpanded(!isContextExpanded)}
            onGenerateClick={handleGenerateClick}
            displayedText={displayedContextText}
            questionText={market.question}
          />

          {/* 规则折叠面板组件 */}
          <Rules
            isExpanded={isRulesExpanded}
            onToggle={() => setIsRulesExpanded(!isRulesExpanded)}
          />

          {/* 评论区 */}
          <MarketDetailTabs marketId={market.id} />
        </div>

        {/* 右侧边栏 - Sticky */}
        <CryptoRelatedSidebar />
      </div>
    </div>
  );
}
