"use client";

/**
 * OutcomeRow - 单个 outcome 行（桌面 + 移动布局，含展开后的 orderbook/graph/resolution tabs）。
 * 从 OutcomeList.tsx 拆出，机械搬运无修改。
 */

import React, { useState, useMemo, memo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  getOutcomeLabel,
  normalizeBinaryOutcomeLabel,
  sortOutcomesByOriginalIndex,
} from "@/lib/utils/outcomes";
import { formatNumber } from "@/utils/format";
import { formatPercentage } from "@/lib/utils/eventToMarket";
import { useTradingStore } from "@/lib/store/tradingStore";
import SpotOrderbook from "./SpotOrderbook";
import BuyButton from "./BuyButton";
import OutcomeGraph from "./OutcomeGraph";
import { formatButtonPrice, type DisplayOption } from "./OutcomeList.helpers";

interface OutcomeRowProps {
  option: DisplayOption;
  index: number;
  isExpanded: boolean;
  selectOutcomeId: string | null;
  marketId: string;
  onToggleExpand: (index: number, e: React.MouseEvent) => void;
  onSelectOutcomeId: (id: string) => void;
  onSelectOutcome: (option: DisplayOption, tokenId: string) => void;
  onMobileTrade?: (index: number, side: "yes" | "no") => void;
}

const OutcomeRow = memo(
  ({
    option,
    index,
    isExpanded,
    selectOutcomeId,
    marketId,
    onToggleExpand,
    onSelectOutcomeId,
    onSelectOutcome,
    onMobileTrade,
  }: OutcomeRowProps) => {
    const { t } = useTranslation();
    // 精准 selector：只在 direction / market 变化时重渲染
    // orderBookRaw 订阅独立保留，仅用于触发实时价格更新（已被 tradingStore 节流到 500ms）
    const direction = useTradingStore((s) => s.direction);
    const market = useTradingStore((s) => s.market);
    const getOrderBook = useTradingStore((s) => s.getOrderBook);
    useTradingStore((s) => s.orderBookRaw); // 订阅 orderBookRaw 变化以刷新买卖盘价格

    const [activeTab, setActiveTab] = useState<
      "orderbook" | "graph" | "resolution"
    >("orderbook");

    // token ids (prefer clobTokenIds, fallback to parsedTokenIds)
    const volume = option.volume;
    const tokenIds = useMemo(() => {
      if (option.clobTokenIds.length > 0) {
        return option.clobTokenIds;
      }
      const clobTokenIdsJson = option.marketData?.clobTokenIds || "[]";
      try {
        const parsed = JSON.parse(clobTokenIdsJson);
        if (
          Array.isArray(parsed) &&
          parsed.every((id) => typeof id === "string")
        ) {
          return parsed;
        }
      } catch (e) {
        console.warn("Failed to parse clobTokenIds from marketData:", e);
      }
      return [];
    }, [option.clobTokenIds, option.marketData?.clobTokenIds]);

    const yesTokenId = tokenIds[0] || "";
    const noTokenId = tokenIds[1] || "";
    const marketOutcomes = useMemo(
      () => (option.marketData?.marketOutcomes || []) as any[],
      [option.marketData?.marketOutcomes]
    );

    const sortedOutcomes = useMemo(
      () => sortOutcomesByOriginalIndex(marketOutcomes),
      [marketOutcomes]
    );

    const [yesAssetId, noAssetId] = useMemo(() => {
      const yes = sortedOutcomes[0];
      const no = sortedOutcomes[1];
      return [
        String(yes?.tradingPair || yes?.tokenId || ""),
        String(no?.tradingPair || no?.tokenId || ""),
      ];
    }, [sortedOutcomes]);

    const [yesLabel, noLabel] = useMemo(() => {
      if (sortedOutcomes.length >= 2) {
        const label0 = getOutcomeLabel(sortedOutcomes[0]);
        const label1 = getOutcomeLabel(sortedOutcomes[1]);
        return [
          normalizeBinaryOutcomeLabel(label0, t.common.yes as string, {
            yes: t.common.yes as string,
            no: t.common.no as string,
            up: t.common.up as string,
            down: t.common.down as string,
          }),
          normalizeBinaryOutcomeLabel(label1, t.common.no as string, {
            yes: t.common.yes as string,
            no: t.common.no as string,
            up: t.common.up as string,
            down: t.common.down as string,
          }),
        ];
      }
      return [t.common.yes as string, t.common.no as string];
    }, [
      sortedOutcomes,
      t.common.yes,
      t.common.no,
      t.common.up,
      t.common.down,
    ]);

    // 订单簿的 key 必须与 WS 推送的 asset_id 一致：这里是 tradingPair（如 `${marketId}-YES-USDT`）。
    // tokenId / clobTokenIds 是链上 tokenId，不用于索引 WS 订单簿，避免出现"看得到挂单但取不到深度"的问题。
    const yesOrderBook = getOrderBook(yesAssetId || "");
    const noOrderBook = getOrderBook(noAssetId || "");

    const yesRaw = useMemo(() => {
      if (market?.id === option.marketId) {
        const side = direction === "buy" ? yesOrderBook?.asks?.[0] : yesOrderBook?.bids?.[0];
        const px = side ? Number(side.price) : NaN;
        return Number.isFinite(px) && px > 0 ? px : option.yesPriceRaw;
      }
      return option.yesPriceRaw;
    }, [market, option.marketId, direction, yesOrderBook, option.yesPriceRaw]);

    const noRaw = useMemo(() => {
      if (market?.id === option.marketId) {
        const side = direction === "buy" ? noOrderBook?.asks?.[0] : noOrderBook?.bids?.[0];
        const px = side ? Number(side.price) : NaN;
        return Number.isFinite(px) && px > 0 ? px : option.noPriceRaw;
      }
      return option.noPriceRaw;
    }, [market, option.marketId, direction, noOrderBook, option.noPriceRaw]);

    const yesPrice = formatButtonPrice(yesRaw);
    const noPrice = formatButtonPrice(noRaw);

    const tabs = [
      { id: "orderbook", label: t.market.orderBook },
      { id: "graph", label: t.market.chart.graph },
      { id: "resolution", label: t.market.chart.resolution },
    ] as const;

    return (
      <div
        className={`rounded-xl border transition-all ${
          isExpanded
            ? "border-(--accent) bg-(--bg-card)"
            : "border-(--border) bg-(--bg-card) hover:border-(--border-light)"
        }`}
      >
        {/* Desktop Layout */}
        <div
          onClick={(e) => onToggleExpand(index, e)}
          className="hidden lg:flex items-center justify-between p-4 cursor-pointer"
        >
          <div className="flex-1">
            <div className="font-medium text-(--text-primary)">
              {option.label}
            </div>
            <div className="text-xs text-(--text-secondary) mt-1">
              {formatNumber(Number(volume))} {t.common.volume}
            </div>
          </div>

          <div className="w-24 text-center">
            {!option.isResolved && (
              <>
                <span className="text-lg font-semibold text-(--text-primary)">
                  {formatPercentage(option.percentage)}
                </span>
                {option.change !== undefined && (
                  <span
                    className={`ml-2 text-xs ${option.change >= 0 ? "text-(--green)" : "text-(--red)"}`}
                  >
                    {option.change >= 0 ? "▲" : "▼"}
                    {Math.abs(option.change)}%
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3 justify-end">
            {option.isResolved ? (
              <div className="px-4 py-2 rounded-lg bg-[rgba(59,130,246,0.15)] text-[#3b82f6] border border-[rgba(59,130,246,0.3)] font-medium">
                {t.market.resolved}: {option.resolvedOutcome || yesLabel}
              </div>
            ) : (
              <>
                <BuyButton
                  label={`${direction === "buy" ? t.common.buy : t.common.sell} ${yesLabel}`}
                  price={yesPrice}
                  color="yes"
                  selected={selectOutcomeId === yesTokenId}
                  onClick={() => onSelectOutcome(option, yesTokenId)}
                />
                <BuyButton
                  label={`${direction === "buy" ? t.common.buy : t.common.sell} ${noLabel}`}
                  price={noPrice}
                  color="no"
                  selected={selectOutcomeId === noTokenId}
                  onClick={() => onSelectOutcome(option, noTokenId)}
                />
              </>
            )}
            {isExpanded ? (
              <ChevronUp size={20} className="text-(--text-secondary)" />
            ) : (
              <ChevronDown size={20} className="text-(--text-secondary)" />
            )}
          </div>
        </div>

        {/* Mobile Layout */}
        <div
          onClick={(e) => onToggleExpand(index, e)}
          className="lg:hidden p-4 cursor-pointer"
        >
          <div className="flex items-start justify-between mb-1">
            <div className="flex-1">
              <div className="font-semibold text-lg text-(--text-primary)">
                {option.label}
              </div>
              <div className="text-sm text-(--text-secondary) mt-0.5">
                {formatNumber(Number(volume))} {t.common.volume}
              </div>
            </div>
            {!option.isResolved && (
              <span className="text-2xl font-bold text-(--text-primary)">
                {formatPercentage(option.percentage)}
              </span>
            )}
          </div>

          {option.isResolved ? (
            <div className="mt-3 py-3 rounded-lg text-center bg-[rgba(59,130,246,0.15)] text-[#3b82f6] border border-[rgba(59,130,246,0.3)] font-medium">
              {t.market.resolved}: {option.resolvedOutcome || yesLabel}
            </div>
          ) : (
            <div className="flex gap-3 mt-3">
              <BuyButton
                label={`${direction === "buy" ? t.common.buy : t.common.sell} ${yesLabel}`}
                price={yesPrice}
                color="yes"
                selected={selectOutcomeId === yesTokenId}
                onClick={() => {
                  onSelectOutcome(option, yesTokenId);
                  if (onMobileTrade) onMobileTrade(index, "yes");
                }}
                className="flex-1"
              />
              <BuyButton
                label={`${direction === "buy" ? t.common.buy : t.common.sell} ${noLabel}`}
                price={noPrice}
                color="no"
                selected={selectOutcomeId === noTokenId}
                onClick={() => {
                  onSelectOutcome(option, noTokenId);
                  if (onMobileTrade) onMobileTrade(index, "no");
                }}
                className="flex-1"
              />
            </div>
          )}
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 border-t border-(--border)">
            <div className="flex items-center justify-between py-3">
              <div className="flex gap-4">
                {tabs
                  .filter((tab) => !option.isResolved || tab.id !== "orderbook")
                  .map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? "text-(--text-primary)"
                          : "text-(--text-secondary) hover:text-(--text-primary)"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
              </div>
            </div>

            {activeTab === "orderbook" && !option.isResolved && (
              <SpotOrderbook
                ticker={`${marketId}-${option.label}`}
                basePrice={option.percentage / 100}
                label={option.label}
                marketId={String(option.marketId)}
                marketSource={option.marketData?.source}
                marketOutcomes={option.marketData?.marketOutcomes}
                selectedSide={selectOutcomeId === noTokenId ? "no" : "yes"}
                onSideChange={(side) =>
                  onSelectOutcomeId(side === "no" ? noTokenId : yesTokenId)
                }
              />
            )}

            {activeTab === "graph" && (
              <OutcomeGraph
                percentage={option.percentage}
                change={option.change}
                label={option.label}
                marketId={String(option.marketId)}
                isVisible={isExpanded && activeTab === "graph"}
              />
            )}

            {activeTab === "resolution" && (
              <div className="py-4 text-sm text-(--text-secondary)">
                <p>{t.market.chart.resolutionSource}</p>
                <p className="mt-2">{t.market.chart.resolutionDesc}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
  (prev, next) => {
    if (prev.option !== next.option) return false;
    if (prev.index !== next.index) return false;
    if (prev.isExpanded !== next.isExpanded) return false;
    if (prev.marketId !== next.marketId) return false;

    // If only selectOutcomeId changed
    if (prev.selectOutcomeId !== next.selectOutcomeId) {
      const tokenIds =
        next.option.clobTokenIds.length > 0
          ? next.option.clobTokenIds
          : (() => {
              const clobTokenIdsJson =
                next.option.marketData?.clobTokenIds || "[]";
              try {
                const parsed = JSON.parse(clobTokenIdsJson);
                return Array.isArray(parsed) &&
                  parsed.every((id) => typeof id === "string")
                  ? parsed
                  : [];
              } catch (e) {
                console.warn("[OutcomeList] Failed to parse clobTokenIds", e);
                return [];
              }
            })();
      const yesId = tokenIds[0];
      const noId = tokenIds[1];
      const prevRelated =
        prev.selectOutcomeId === yesId || prev.selectOutcomeId === noId;
      const nextRelated =
        next.selectOutcomeId === yesId || next.selectOutcomeId === noId;
      // If neither were related, no need to update.
      if (!prevRelated && !nextRelated) return true;
      // If relevant changed, or relevance changed, update.
      return false;
    }

    return true;
  }
);
OutcomeRow.displayName = "OutcomeRow";

export default OutcomeRow;
