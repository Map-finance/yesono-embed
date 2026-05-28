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
import { useTradingStore, useSideQuotes } from "@/lib/store/tradingStore";
import {
  resolveButtonPrices,
  resolveYesPercent,
} from "@/lib/utils/outcomePricing";
import SpotOrderbook from "./SpotOrderbook";
import BuyButton from "./BuyButton";
import OutcomeGraph from "./OutcomeGraph";
import ShortTermOutcomeGraph from "./ShortTermOutcomeGraph";
import { isShortTermFrequencySlug } from "@/lib/utils/eventFrequency";
import { formatButtonPrice, type DisplayOption } from "./OutcomeList.helpers";
import { getSettlementDisplay } from "@/lib/utils/settlementResult";

interface OutcomeRowProps {
  option: DisplayOption;
  index: number;
  isExpanded: boolean;
  selectOutcomeId: string | null;
  marketId: string;
  /** 该 market 的结算结果（YES 侧赔付比例）；null/undefined 时回退到 outcomePrices 推断 */
  settlementValue?: number | null;
  /** 事件级"已截止"（客户端到达 endDate）；与逐市场 isEnded 取或，作为禁止下单的即时信号 */
  eventEnded?: boolean;
  /** 事件 slug,透传给 SpotOrderbook 显示会话级交易量(对齐 Polymarket) */
  eventSlug?: string;
  /** 频率 slug(短期 \d+m/\d+h 时切到 trade-by-trade 概率图) */
  frequencySlug?: string;
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
    settlementValue,
    eventEnded,
    eventSlug,
    frequencySlug,
    onToggleExpand,
    onSelectOutcomeId,
    onSelectOutcome,
    onMobileTrade,
  }: OutcomeRowProps) => {
    const { t } = useTranslation();
    // 精准 selector：只在 direction 变化时重渲染。
    // 实时盘口经 useSideQuotes（shallow）订阅：只有选中市场的 key 在 orderBookRaw 中、
    // 其 6 个报价值才会变动并触发本行重渲染，未选中行恒为 0、shallow 相等不重渲染。
    const direction = useTradingStore((s) => s.direction);

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

    // 短期市场概率图过滤候选(YES 侧 = sortedOutcomes[0],即 originalIndex 0):
    // - assetCandidates 走 trade.assetId(WS 推送时可能用 tokenId 或 tradingPair)
    // - outcomeNames 走 trade.outcome 字符串(后端 /trades1/all 当前 assetId 多为 null,实际靠这个匹配)
    const yesAssetCandidates = useMemo(() => {
      const yes = sortedOutcomes[0] as any;
      if (!yes) return [] as string[];
      return [yes?.tokenId, yes?.tradingPair].filter(Boolean).map((v) => String(v));
    }, [sortedOutcomes]);
    const yesOutcomeNames = useMemo(() => {
      const yes = sortedOutcomes[0] as any;
      if (!yes) return [] as string[];
      return [yes?.outcome, yes?.outcomeKey, yes?.name]
        .filter(Boolean)
        .map((v) => String(v));
    }, [sortedOutcomes]);
    // 短期概率图标题用 YES outcome 短名(如 "Up"),不是整段市场问题(option.label)
    const shortTermGraphLabel = useMemo(() => {
      const raw = yesOutcomeNames[0];
      if (!raw) return option.label;
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }, [yesOutcomeNames, option.label]);

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

    // 结算结果五态展示（优先用 settlement-result 接口；无值时回退到 resolvedOutcome 文案）
    const settlementDisplay = useMemo(
      () =>
        option.isResolved
          ? getSettlementDisplay(settlementValue, {
              yes: yesLabel,
              no: noLabel,
              halfWin: t.market.settlement.halfWin,
              halfLose: t.market.settlement.halfLose,
              push: t.market.settlement.push,
            })
          : null,
      [option.isResolved, settlementValue, yesLabel, noLabel, t.market.settlement]
    );

    // 已截止但未结算：以后端权威信号为准（逐市场 isEnded = closed/停止接单）。
    // endDate 到点（eventEnded）只在父组件触发轮询刷新 eventMarkets，拉到 closed 后这里随之
    // 翻转 —— 对齐 Polymarket（endDate 过了未 closed 仍可下单），不用客户端 endDate 直接禁单。
    const tradingEnded = !option.isResolved && option.isEnded;

    // 取价口径与右侧 TradingPanel 统一(见 lib/utils/outcomePricing.ts):
    // 按钮价优先实时盘口(BUY=bestAsk/SELL=bestBid),概率优先盘口 midpoint,无盘口回退静态。
    // 订单簿 key 必须与 WS 推送的 asset_id 一致：tradingPair（如 `${marketId}-YES-USDT`），
    // 即 yesAssetId / noAssetId（链上 tokenId 不用于索引订单簿）。
    // 实时盘口仅"当前选中市场"在 tradingStore 中存在，故只有选中行实时、其余行回退静态。
    const q = useSideQuotes(yesAssetId || "", noAssetId || "");
    const yesQuote = { bestAsk: q.yesAsk, bestBid: q.yesBid, mid: q.yesMid };
    const noQuote = { bestAsk: q.noAsk, bestBid: q.noBid, mid: q.noMid };

    const { yes: yesPriceRatio, no: noPriceRatio } = resolveButtonPrices({
      direction,
      yesQuote,
      noQuote,
      yesStatic: option.yesPriceRaw,
      noStatic: option.noPriceRaw,
    });
    const yesPrice = formatButtonPrice(yesPriceRatio);
    const noPrice = formatButtonPrice(noPriceRatio);
    // 概率%:优先 YES 盘口 midpoint,无盘口回退既有静态 option.percentage(其口径含 rowOutcomePrice)
    const displayPercent = resolveYesPercent(yesQuote, option.percentage);
    // 实时涨跌箭头:静态 24h 变化(option.change)叠加"自快照以来的实时移动"(displayPercent − 静态 %)。
    // = 当前价 − 24h 前价,不会重复计数。选中行有盘口→跟着实时动;未选中行两者相等→退化为纯 24h 静态。
    const intradayMove = displayPercent - option.percentage;
    const effectiveChange = Math.round((option.change ?? 0) + intradayMove);
    const showChange = option.change !== undefined || intradayMove !== 0;

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
                  {formatPercentage(displayPercent)}
                </span>
                {showChange && (
                  <span
                    className={`ml-2 text-xs ${effectiveChange >= 0 ? "text-(--green)" : "text-(--red)"}`}
                  >
                    {effectiveChange >= 0 ? "▲" : "▼"}
                    {Math.abs(effectiveChange)}%
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3 justify-end">
            {option.isResolved ? (
              settlementDisplay ? (
                <div
                  className="px-4 py-2 rounded-lg border font-medium"
                  style={{
                    color: settlementDisplay.accent,
                    backgroundColor: settlementDisplay.bg,
                    borderColor: settlementDisplay.border,
                  }}
                >
                  {t.market.resolved}: {settlementDisplay.label}
                </div>
              ) : (
                <div className="px-4 py-2 rounded-lg bg-[rgba(59,130,246,0.15)] text-[#3b82f6] border border-[rgba(59,130,246,0.3)] font-medium">
                  {t.market.resolved}: {option.resolvedOutcome || yesLabel}
                </div>
              )
            ) : tradingEnded ? (
              <div className="px-4 py-2 rounded-lg bg-[rgba(107,114,128,0.12)] text-(--text-secondary) border border-[rgba(107,114,128,0.25)] font-medium">
                {t.market.settlement.awaiting}
              </div>
            ) : (
              <>
                <BuyButton
                  label={`${direction === "BUY" ? t.common.buy : t.common.sell} ${yesLabel}`}
                  price={yesPrice}
                  color="yes"
                  selected={selectOutcomeId === yesTokenId}
                  onClick={() => onSelectOutcome(option, yesTokenId)}
                />
                <BuyButton
                  label={`${direction === "BUY" ? t.common.buy : t.common.sell} ${noLabel}`}
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
                {formatPercentage(displayPercent)}
              </span>
            )}
          </div>

          {option.isResolved ? (
            settlementDisplay ? (
              <div
                className="mt-3 py-3 rounded-lg text-center border font-medium"
                style={{
                  color: settlementDisplay.accent,
                  backgroundColor: settlementDisplay.bg,
                  borderColor: settlementDisplay.border,
                }}
              >
                {t.market.resolved}: {settlementDisplay.label}
              </div>
            ) : (
              <div className="mt-3 py-3 rounded-lg text-center bg-[rgba(59,130,246,0.15)] text-[#3b82f6] border border-[rgba(59,130,246,0.3)] font-medium">
                {t.market.resolved}: {option.resolvedOutcome || yesLabel}
              </div>
            )
          ) : tradingEnded ? (
            <div className="mt-3 py-3 rounded-lg text-center bg-[rgba(107,114,128,0.12)] text-(--text-secondary) border border-[rgba(107,114,128,0.25)] font-medium">
              {t.market.settlement.awaiting}
            </div>
          ) : (
            <div className="flex gap-3 mt-3">
              <BuyButton
                label={`${direction === "BUY" ? t.common.buy : t.common.sell} ${yesLabel}`}
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
                label={`${direction === "BUY" ? t.common.buy : t.common.sell} ${noLabel}`}
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
                eventSlug={eventSlug}
              />
            )}

            {activeTab === "graph" &&
              (isShortTermFrequencySlug(frequencySlug) ? (
                <ShortTermOutcomeGraph
                  eventId={option.eventId}
                  eventSlug={eventSlug}
                  yesAssetCandidates={yesAssetCandidates}
                  yesOutcomeNames={yesOutcomeNames}
                  frequencySlug={frequencySlug}
                  endDateMs={option.marketData?.endDate}
                  label={shortTermGraphLabel}
                  isVisible={isExpanded && activeTab === "graph"}
                  isLive={!(option.isResolved || tradingEnded || eventEnded)}
                />
              ) : (
                <OutcomeGraph
                  percentage={option.percentage}
                  change={option.change}
                  label={option.label}
                  marketId={String(option.marketId)}
                  isVisible={isExpanded && activeTab === "graph"}
                />
              ))}

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
    // 结算结果异步到达 / 事件截止状态变化时，必须重渲染以更新五态徽标 / "等待结算"态
    if (prev.settlementValue !== next.settlementValue) return false;
    if (prev.eventEnded !== next.eventEnded) return false;
    if (prev.isExpanded !== next.isExpanded) return false;
    if (prev.marketId !== next.marketId) return false;
    // 频率变化(切事件 / 加载完成)要重渲染,以便短期/普通概率图正确切换
    if (prev.frequencySlug !== next.frequencySlug) return false;

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
