"use client";

/**
 * MarketSection - 详情视图中的单个市场分类卡片
 * 可展开显示 OrderBook（参考 games 卡片展开）
 * 用于 Moneyline、Spreads、Totals、Both Teams to Score 等
 */

import React, { useState, useMemo, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, RefreshCcw } from "lucide-react";
import { SportsMarketItem } from "@/types/sports";
import { useTranslation } from "@/lib/i18n";
import {
  fillEvenSplitWhenAllZero,
  formatOutcomeProbabilityCents,
} from "@/utils/format";
import GameButton from "@/components/sports/Live/GameButton";
import {
  isMarketResolved,
  getMoneylineSettlementLabel,
  getSpreadSettlementLabel,
  getTotalSettlementLabel,
  ResolvedBadge,
} from "./settlement";
import Tabs from "@/components/ui/Tabs";
import IconButton from "@/components/ui/IconButton";
import SpotOrderbook from "@/components/detail/SpotOrderbook";
import SportsOutcomeGraph from "./SportsOutcomeGraph";
import MarketChart from "@/components/detail/MarketChart";
import { Market } from "@/types/types";
import { PolymarketMarketResp } from "@/types/home";
import {
  getOutcomeLabel,
  sortOutcomesByOriginalIndex,
} from "@/lib/utils/outcomes";

/** 可复用的 LineValue 切换器：黄色倒三角固定居中，选中按钮通过 translateX 滑动到中间 */
function LineValueSwitcher({
  lines,
  activeIdx,
  onSelect,
}: {
  lines: { value: number; idx: number }[];
  activeIdx: number;
  onSelect: (idx: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [tx, setTx] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    const inner = innerRef.current;
    if (!container || !inner) return;
    const btn = inner.querySelector(`[data-line-idx="${activeIdx}"]`) as HTMLElement | null;
    if (!btn) return;
    // btn.offsetLeft 是相对于 innerRef 的偏移
    const offset = btn.offsetLeft + btn.offsetWidth / 2 - container.offsetWidth / 2;
    setTx(-offset);
  }, [activeIdx, lines]);

  return (
    <div
      className="relative mt-2 border-t border-(--border)"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 固定居中的黄色倒三角，紧贴上方 border 线 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-px z-10 text-(--accent) text-[10px] leading-none pointer-events-none">
        ▼
      </div>
      <div className="flex items-center justify-center pt-3">
        <button
          className="p-1 text-(--text-tertiary) hover:text-(--text-primary) shrink-0"
          onClick={() => onSelect(Math.max(0, activeIdx - 1))}
        >
          <ChevronLeft size={14} />
        </button>
        <div ref={containerRef} className="overflow-hidden flex-1 min-w-0">
          <div
            ref={innerRef}
            className="flex items-center gap-3 w-max transition-transform duration-300 ease-in-out"
            style={{ transform: `translateX(${tx}px)` }}
          >
            {lines.map((lv) => {
              const isActive = lv.idx === activeIdx;
              return (
                <button
                  key={lv.idx}
                  data-line-idx={lv.idx}
                  onClick={() => onSelect(lv.idx)}
                  className={`relative flex items-center justify-center h-6 px-2 shrink-0 transition-all duration-200 ${
                    isActive
                      ? "text-(--text-primary)"
                      : "text-(--text-tertiary) hover:text-(--text-secondary)"
                  }`}
                >
                  <span
                    className={`transition-all duration-200 ${
                      isActive ? "text-sm font-bold" : "text-xs font-normal"
                    }`}
                  >
                    {lv.value}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        <button
          className="p-1 text-(--text-tertiary) hover:text-(--text-primary) shrink-0"
          onClick={() => onSelect(Math.min(lines.length - 1, activeIdx + 1))}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

interface MarketSectionProps {
  title: string;
  volume?: string;
  markets: SportsMarketItem[];
  onOutcomeClick?: (item: SportsMarketItem, idx: number) => void;
  selectedMarketId?: string;
  /** 当前选中的 outcome 索引（0 或 1） */
  selectedOutcomeIdx?: number;
  /** 是否为 spread/total 类型（需要 lineValue 切换器） */
  hasLineValues?: boolean;
  /** market 类型标识（spreads / totals 用于专有渲染） */
  sectionKey?: string;
  /** 主队缩写（spreads 按锢 originalIndex=0 显示） */
  homeAbbr?: string;
  /** 客队缩写（spreads 按锢 originalIndex=1 显示） */
  awayAbbr?: string;
  /** 多线图表数据（用于 moneyline 显示所有 market 曲线） */
  chartMarket?: Market;
  chartEventMarkets?: PolymarketMarketResp[];
}

function getAbbr(title: string): string {
  const clean = title.replace(/\s*\(.*?\)/, "").trim();
  const words = clean.split(/\s+/);
  const word = words.find((w) => w.length > 2) || words[0] || "";
  return word.slice(0, 4).toUpperCase();
}

function formatPrice(price: string): string {
  // clamp 100/0 边界（详见 utils/format.ts）
  return formatOutcomeProbabilityCents(parseFloat(price));
}

/**
 * 组内全 0 时把每个 outcome 价格替换成平分概率，然后按 outcomeIdx 取出格式化。
 * 用于"该 market 内 outcomes 全 0"（市场无流动性）时显示 50/50 而非 0.1¢/0.1¢。
 */
function formatPriceWithinMarket(
  item: SportsMarketItem | undefined,
  outcomeIdx: number,
): string {
  if (!item) return "—";
  const sorted = sortOutcomesByOriginalIndex(item.outcomes || []);
  if (!sorted[outcomeIdx]) return "—";
  const filled = fillEvenSplitWhenAllZero(sorted.map((o) => o.price));
  return formatOutcomeProbabilityCents(filled[outcomeIdx]);
}

function getYesPrice(item?: SportsMarketItem): string {
  // YES outcome 在该 market 内 sorted index = 0；走 group 兜底（全 0 显 50¢）
  return formatPriceWithinMarket(item, 0);
}

function getSignedLineForOutcome(item: SportsMarketItem, outcomeOriginalIndex: number): string {
  const lv = item.lineValue;
  if (lv === null || lv === undefined) return "";
  const absLv = Math.abs(lv);
  if (outcomeOriginalIndex === 0) {
    return lv < 0 ? String(lv) : `-${absLv}`;
  } else {
    const neg = -lv;
    return neg > 0 ? `+${neg}` : String(neg);
  }
}

function groupByLineValue(markets: SportsMarketItem[]): [number, SportsMarketItem[]][] {
  const map = new Map<number, SportsMarketItem[]>();
  markets.forEach((m) => {
    const lv = Math.abs(m.lineValue ?? 0);
    if (!map.has(lv)) map.set(lv, []);
    map.get(lv)!.push(m);
  });
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}

/** Spread 用：每个 market 独立一组，不去重 */
function groupEachByMarket(markets: SportsMarketItem[]): [number, SportsMarketItem[]][] {
  return markets.map((m) => [Math.abs(m.lineValue ?? 0), [m]]);
}

// 颜色常量
const GREEN_ACTIVE = "#3bab68";
const RED_ACTIVE = "#e13737";
const UNSELECTED_BG = "rgba(200,200,200,0.2)";

const MarketSection: React.FC<MarketSectionProps> = ({
  title,
  volume,
  markets,
  onOutcomeClick,
  selectedMarketId,
  selectedOutcomeIdx,
  hasLineValues = false,
  sectionKey,
  homeAbbr = "",
  awayAbbr = "",
  chartMarket,
  chartEventMarkets,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [lineIdx, setLineIdx] = useState(0);

  const lineGroups = useMemo(
    () => hasLineValues
      ? (sectionKey === "spreads" ? groupEachByMarket(markets) : groupByLineValue(markets))
      : [],
    [markets, hasLineValues, sectionKey]
  );

  // hasLineValues 时每组只有 1 个 market，lineIdx 对应第 lineIdx 个 market
  const currentMarkets = hasLineValues
    ? lineGroups[lineIdx]?.[1] || []
    : markets;

  // 判断是否为 moneyline 类型
  const isMoneyline = markets.length > 0 && markets[0]?.subType === "moneyline";

  const handleClick = (e: React.MouseEvent, item: SportsMarketItem, idx: number) => {
    e.stopPropagation();
    onOutcomeClick?.(item, idx);
  };

  /** Spreads: 当前组的单个 market 显示 home/away 2 按钮(originalIndex决定) */
  const renderSpreadButtons = (items: SportsMarketItem[]) => {
    const item = items[0];
    if (!item) return <span className="opacity-40">-</span>;
    const sorted = sortOutcomesByOriginalIndex(item.outcomes || []);
    const homeOutcome = sorted.find(o => o.originalIndex === 0);
    const awayOutcome = sorted.find(o => o.originalIndex === 1);
    const rawLv = item.lineValue ?? 0;
    const homeLvStr = rawLv > 0 ? `+${rawLv}` : rawLv !== 0 ? String(rawLv) : "";
    const awayLv = -rawLv;
    const awayLvStr = awayLv > 0 ? `+${awayLv}` : awayLv !== 0 ? String(awayLv) : "";
    const homeAbbrFromOutcome = homeOutcome ? getAbbr(homeOutcome.outcome) : (homeAbbr || "H");
    const awayAbbrFromOutcome = awayOutcome ? getAbbr(awayOutcome.outcome) : (awayAbbr || "A");
    const isSelected = selectedMarketId === item.marketId;
    // 组内全 0 时 home/away 平分（各 50%），避免显示 0.1¢/0.1¢ 误导
    const filledPrices = fillEvenSplitWhenAllZero(sorted.map((o) => o.price));
    const homePriceLabel = homeOutcome
      ? formatOutcomeProbabilityCents(filledPrices[sorted.indexOf(homeOutcome)])
      : "—";
    const awayPriceLabel = awayOutcome
      ? formatOutcomeProbabilityCents(filledPrices[sorted.indexOf(awayOutcome)])
      : "—";
    return (
      <div className="flex gap-1.5 flex-wrap">
        <GameButton
          key={`${item.marketId}-home`}
          size="sm"
          variant="secondary"
          color={isSelected ? GREEN_ACTIVE : UNSELECTED_BG}
          textColor={isSelected ? "#fff" : "var(--text-primary)"}
          className="min-w-[90px]"
          onClick={(e) => handleClick(e, item, 0)}
        >
          <span className="uppercase opacity-80 text-xs">{homeAbbrFromOutcome}</span>
          {homeLvStr && <span className="ml-1 text-xs">{homeLvStr}</span>}
          <span className="ml-1 font-bold">{homePriceLabel}</span>
        </GameButton>
        <GameButton
          key={`${item.marketId}-away`}
          size="sm"
          variant="secondary"
          color={isSelected ? RED_ACTIVE : UNSELECTED_BG}
          textColor={isSelected ? "#fff" : "var(--text-primary)"}
          className="min-w-[90px]"
          onClick={(e) => handleClick(e, item, 1)}
        >
          <span className="uppercase opacity-80 text-xs">{awayAbbrFromOutcome}</span>
          {awayLvStr && <span className="ml-1 text-xs">{awayLvStr}</span>}
          <span className="ml-1 font-bold">{awayPriceLabel}</span>
        </GameButton>
      </div>
    );
  };

  /** Totals: 每个 market 双按钮 (Over/Under)，线値显示绝对値 */
  const renderTotalButtons = (items: SportsMarketItem[]) => (
    <div className="flex gap-2 flex-wrap">
      {items.map((item) => {
        const sorted = sortOutcomesByOriginalIndex(item.outcomes || []);
        const outcome0 = sorted[0];
        const outcome1 = sorted[1];
        const isThisMarket = selectedMarketId === item.marketId;
        const absLine = item.lineValue != null ? Math.abs(item.lineValue) : "";
        const active0 = isThisMarket && selectedOutcomeIdx === 0;
        const active1 = isThisMarket && selectedOutcomeIdx === 1;
        // 组内全 0 时 O/U 平分（各 50%）
        const filledPrices = fillEvenSplitWhenAllZero(sorted.map((o) => o.price));
        const price0Label = outcome0
          ? formatOutcomeProbabilityCents(filledPrices[0])
          : "—";
        const price1Label = outcome1
          ? formatOutcomeProbabilityCents(filledPrices[1])
          : "—";
        return (
          <div key={item.marketId} className="flex gap-1.5">
            <GameButton
              size="sm"
              variant="secondary"
              color={active0 ? GREEN_ACTIVE : UNSELECTED_BG}
              textColor={active0 ? "#fff" : "var(--text-primary)"}
              className="min-w-[90px]"
              onClick={(e) => handleClick(e, item, 0)}
            >
              <span className="uppercase opacity-80 text-xs">O</span>
              {absLine !== "" && <span className="ml-1 text-xs">{absLine}</span>}
              <span className="ml-1 font-bold">{price0Label}</span>
            </GameButton>
            <GameButton
              size="sm"
              variant="secondary"
              color={active1 ? RED_ACTIVE : UNSELECTED_BG}
              textColor={active1 ? "#fff" : "var(--text-primary)"}
              className="min-w-[90px]"
              onClick={(e) => handleClick(e, item, 1)}
            >
              <span className="uppercase opacity-80 text-xs">U</span>
              {absLine !== "" && <span className="ml-1 text-xs">{absLine}</span>}
              <span className="ml-1 font-bold">{price1Label}</span>
            </GameButton>
          </div>
        );
      })}
    </div>
  );

  // Render buttons for current markets
  const renderButtons = () => {
    // 检查当前显示的 markets 是否全部已结算
    const allResolved = currentMarkets.length > 0 && currentMarkets.every(isMarketResolved);
    if (allResolved) {
      const s = t.sports.settlement;
      let label: string;
      if (sectionKey === "spreads") {
        label = getSpreadSettlementLabel(currentMarkets[0], s);
      } else if (sectionKey === "totals") {
        label = getTotalSettlementLabel(currentMarkets[0], s);
      } else {
        // moneyline 或其他类型
        label = getMoneylineSettlementLabel(currentMarkets, s);
      }
      return <ResolvedBadge label={label} />;
    }

    // Spreads: 当前分组的单个 market，显示 home/away 2 按钮
    if (sectionKey === "spreads") {
      return renderSpreadButtons(currentMarkets);
    }
    // Totals: 双按钮 (O/U)，线値显绝对値
    if (sectionKey === "totals") {
      return renderTotalButtons(currentMarkets);
    }
    // 非 moneyline 类型：其他二元类型（保留原来逻辑）
    if (!isMoneyline) {
      return renderTotalButtons(currentMarkets);
    }

    // Moneyline: render all buttons inline
    return (
      <div className="flex gap-2 flex-wrap">
        {markets.map((item) => {
          const isDraw = item.marketTitle.toLowerCase().startsWith("draw");
          const abbr = isDraw ? "DRAW" : getAbbr(item.marketTitle);
          const isActive = selectedMarketId === item.marketId;
          return (
            <GameButton
              key={item.marketId}
              size="sm"
              variant={isDraw ? "secondary" : "primary"}
              color={isActive ? "#d4a017" : UNSELECTED_BG}
              textColor={isActive ? "#fff" : "var(--text-primary)"}
              className="min-w-[100px]"
              onClick={(e) => handleClick(e, item, 0)}
            >
              <span className="uppercase opacity-80">{abbr}</span>
              <span className="ml-1 font-bold">{getYesPrice(item)}</span>
            </GameButton>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="border border-(--border) rounded-lg overflow-hidden cursor-pointer"
      onClick={() => setIsExpanded((p) => !p)}
    >
      <div className="p-3 hover:bg-(--bg-secondary)/30 transition-all">
        {/* 标题 + 按钮：桌面端同行，移动端上下排列 */}
        <div className="flex items-center justify-between gap-3 max-sm:flex-col max-sm:items-stretch">
          <div className="shrink-0 min-w-0">
            <div className="text-sm font-semibold text-(--text-primary) truncate">
              {title}
            </div>
            {volume && (
              <div className="text-xs text-(--text-tertiary)">
                ${volume} {t.sports.game.vol}.
              </div>
            )}
          </div>
          {/* 按钮居右，移动端全宽 */}
          <div className="shrink-0 max-sm:w-full" onClick={(e) => e.stopPropagation()}>
            {renderButtons()}
          </div>
        </div>

        {/* LineValue 切换器：spreads 和 totals 均需要 */}
        {hasLineValues && lineGroups.length > 1 && (
          <LineValueSwitcher
            lines={lineGroups.map(([lv], i) => ({ value: Math.abs(lv), idx: i }))}
            activeIdx={lineIdx}
            onSelect={(idx) => {
              setLineIdx(idx);
              // 切换 lineValue 时同步到交易面板
              const newGroup = lineGroups[idx]?.[1];
              if (newGroup?.[0] && onOutcomeClick) {
                onOutcomeClick(newGroup[0], 0);
              }
            }}
          />
        )}
      </div>

      {/* 展开面板：OrderBook / Graph */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isExpanded ? "600px" : "0",
          opacity: isExpanded ? 1 : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isExpanded && (
          <Tabs
            items={[
              {
                label: t.sports.game.orderBook,
                value: "orderbook",
                content: (() => {
                  const obMarket =
                    currentMarkets.find((m) => m.marketId === selectedMarketId) ||
                    currentMarkets[0];
                  if (!obMarket) {
                    return (
                      <div className="p-4 text-center text-(--text-tertiary) text-sm">
                        {t.sports.game.noEvents}
                      </div>
                    );
                  }
                  return (
                    <SpotOrderbook
                      key={obMarket.marketId}
                      ticker={getAbbr(obMarket.marketTitle)}
                      marketId={obMarket.marketId}
                      marketOutcomes={
                        obMarket.outcomes?.map((o: any) => ({
                          tokenId: String(o.tokenId || o.id),
                          originalIndex: o.originalIndex,
                          tradingPair: o.tradingPair || undefined,
                        })) || []
                      }
                      selectedSide={selectedOutcomeIdx === 1 ? "no" : "yes"}
                    />
                  );
                })(),
              },
              {
                label: t.sports.game.graph,
                value: "graph",
                content: (() => {
                  // 如果有多线图表数据（moneyline），使用 MarketChart
                  if (chartMarket && chartEventMarkets) {
                    return (
                      <div className="p-2">
                        <MarketChart
                          market={chartMarket}
                          eventMarkets={chartEventMarkets}
                        />
                      </div>
                    );
                  }
                  // 否则使用单线 SportsOutcomeGraph
                  const graphMarket =
                    currentMarkets.find((m) => m.marketId === selectedMarketId) ||
                    currentMarkets[0];
                  if (!graphMarket) {
                    return (
                      <div className="p-4 text-center text-(--text-tertiary) text-sm">
                        {t.sports.game.noEvents}
                      </div>
                    );
                  }
                  return (
                    <SportsOutcomeGraph
                      key={graphMarket.marketId}
                      marketId={graphMarket.marketId}
                      label={graphMarket.marketTitle.replace(/\s*\(.*?\)/, "").trim()}
                      isVisible={isExpanded}
                    />
                  );
                })(),
              },
            ]}
            defaultValue="orderbook"
            rightSlot={
              <div className="mr-2">
                <IconButton size="sm">
                  <RefreshCcw size={14} />
                </IconButton>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
};

export default MarketSection;
