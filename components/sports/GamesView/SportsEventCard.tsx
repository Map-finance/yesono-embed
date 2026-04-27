"use client";

/**
 * SportsEventCard - 体育赛事卡片
 * 参考 Live/GameCard 样式
 * - 点击卡片主体展开 OrderBook
 * - Game View 按钮跳转到赛事详情页
 * - Moneyline: 使用 GameButton 彩色按钮
 * - Spread/Total: 按 lineValue 分组，默认显示第一组，底部可切换
 * - lineValue 显示: originalIndex=0 → 负, originalIndex=1 → 正
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { ChevronRight, ChevronLeft, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { SportsEventDetail, SportsMarketItem, SportsMarketOutcome } from "@/types/sports";
import { useTranslation } from "@/lib/i18n";
import { formatAbbreviatedCurrency } from '@/utils/format';
import ProxyImage from "@/components/common/ProxyImage";
import GameButton from "@/components/sports/Live/GameButton";
import Tabs from "@/components/ui/Tabs";
import IconButton from "@/components/ui/IconButton";
import SpotOrderbook from "@/components/detail/SpotOrderbook";
import SportsOutcomeGraph from "./SportsOutcomeGraph";
import { buildSportsEventUrl } from "@/lib/utils/sportsNav";
import { sortOutcomesByOriginalIndex } from "@/lib/utils/outcomes";

interface SportsEventCardProps {
  event: SportsEventDetail;
  onOutcomeClick?: (marketItem: SportsMarketItem, outcomeIndex: number) => void;
  onGameView?: (eventSlug: string) => void;
  selectedMarketId?: string;
  /** 当前选中的 outcome 索引（0=yes, 1=no），用于同步 OrderBook */
  selectedOutcomeIdx?: number;
  isExpanded?: boolean;
  onToggle?: () => void;
}

// ============== 工具函数 ==============

/** 从 marketTitle 提取缩写 (前3-4个字母) */
function getAbbr(title: string): string {
  const clean = title.replace(/\s*\(.*\)/, "").trim();
  const words = clean.split(/\s+/);
  const word = words.find((w) => w.length > 2) || words[0] || "";
  return word.slice(0, 4).toUpperCase();
}

/** 格式化价格为 cents（精确到 1 位小数，与交易面板一致） */
function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (isNaN(num)) return "—";
  return `${(num * 100).toFixed(1)}¢`;
}

/** 获取 Yes outcome */
function getYesOutcome(item: SportsMarketItem): SportsMarketOutcome | undefined {
  return item.outcomes?.find((o) => o.outcome === "Yes") || item.outcomes?.[0];
}

/** 获取 Yes 价格 */
function getYesPrice(item?: SportsMarketItem): string {
  if (!item) return "—";
  const yes = getYesOutcome(item);
  return yes ? formatPrice(yes.price) : "—";
}

/**
 * 获取带符号的 lineValue
 * 忽略接口返回的正负，只取绝对值
 * originalIndex=0 → 负号, originalIndex=1 → 正号
 */
function getSignedLine(item: SportsMarketItem): string {
  const lv = item.lineValue;
  if (lv === null || lv === undefined) return "";
  const absLv = Math.abs(lv);
  const yes = getYesOutcome(item);
  if (!yes) return String(absLv);
  return yes.originalIndex === 0 ? `-${absLv}` : `+${absLv}`;
}

/** 按 lineValue 绝对值分组 markets，返回 [absLineValue, items[]] 有序数组 */
function groupByLineValue(
  markets: SportsMarketItem[]
): [number, SportsMarketItem[]][] {
  const map = new Map<number, SportsMarketItem[]>();
  markets.forEach((m) => {
    const lv = Math.abs(m.lineValue ?? 0);
    if (!map.has(lv)) map.set(lv, []);
    map.get(lv)!.push(m);
  });
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}

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
    const offset = btn.offsetLeft + btn.offsetWidth / 2 - container.offsetWidth / 2;
    setTx(-offset);
  }, [activeIdx, lines]);

  return (
    <div
      className="relative mt-2 border-t border-[var(--border)]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[1px] z-10 text-[var(--accent)] text-[10px] leading-none pointer-events-none">
        ▼
      </div>
      <div className="flex items-center justify-center pt-3">
        <button
          className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onSelect(Math.max(0, activeIdx - 1)); }}
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
                  onClick={(e) => { e.stopPropagation(); onSelect(lv.idx); }}
                  className={`relative flex items-center justify-center h-6 px-2 flex-shrink-0 transition-all duration-200 ${
                    isActive
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
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
          className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onSelect(Math.min(lines.length - 1, activeIdx + 1)); }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ============== 组件 ==============

const SportsEventCard: React.FC<SportsEventCardProps> = ({
  event,
  onOutcomeClick,
  onGameView,
  selectedMarketId,
  selectedOutcomeIdx,
  isExpanded = false,
  onToggle,
}) => {
  const { t } = useTranslation();
  const router = useRouter();

  // Spread 当前选中的 market 索引
  const [spreadLineIdx, setSpreadLineIdx] = useState(0);
  // Total 当前选中的 lineValue 索引
  const [totalLineIdx, setTotalLineIdx] = useState(0);
  // 展开面板当前显示的 market（跟随按钮点击和 lineValue 切换）
  const [activeExpandMarket, setActiveExpandMarket] = useState<SportsMarketItem | null>(null);

  // 当外部 selectedMarketId 变化时（交易面板切换），同步 activeExpandMarket
  useEffect(() => {
    if (!selectedMarketId) return;
    // 在当前 event 的所有 markets 中查找匹配的 market
    const allMarkets = [
      ...(event.market?.moneyline || []),
      ...(event.market?.spreads || []),
      ...(event.market?.totals || []),
    ];
    const found = allMarkets.find((m) => m.marketId === selectedMarketId);
    if (found) {
      setActiveExpandMarket(found);
    }
  }, [selectedMarketId, event.market]);

  // 解析时间（使用 endDate）
  const endTime = useMemo(() => {
    const date = new Date(Number(event.endDate));
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }, [event.endDate]);

  // 从 market map 获取数据
  const moneylineMarkets = event.market?.moneyline || [];
  const spreadsAll = event.market?.spreads || [];
  const totalsAll = event.market?.totals || [];

  // Spread: 每个 market 独立一组，不去重
  const currentSpreadMarket = spreadsAll[spreadLineIdx] || null;

  // Total 按 lineValue 分组
  const totalGroups = useMemo(() => groupByLineValue(totalsAll), [totalsAll]);

  // 当前选中的 total 组
  const currentTotalMarkets = totalGroups[totalLineIdx]?.[1] || [];
  const currentTotalLine = totalGroups[totalLineIdx]?.[0];
  // Total: 每组只有1个 market，Over/Under 是其 outcomes
  const currentTotalMarket = currentTotalMarkets[0] || null;

  // 从 title 中提取两支队伍
  const teams = useMemo(() => {
    const parts = event.title.split(/\s+vs\.?\s+/i);
    if (parts.length >= 2) {
      return { home: parts[0].trim(), away: parts[1].trim() };
    }
    return { home: event.title, away: "" };
  }, [event.title]);

  // Moneyline: draw = title 以 "draw" 开头; 其余按数组顺序第一个=home, 第二个=away
  const drawMarket = moneylineMarkets.find((m) =>
    m.marketTitle.toLowerCase().startsWith("draw")
  );
  const nonDrawMoneyline = moneylineMarkets.filter(
    (m) => !m.marketTitle.toLowerCase().startsWith("draw")
  );
  const homeMoneyline = nonDrawMoneyline[0] || null;
  const awayMoneyline = nonDrawMoneyline[1] || null;

  // Spread: 每个 market 独立渲染（不再只取第一个）

  // 是否只有 moneyline（无 spread 和 total）
  const onlyMoneyline = spreadsAll.length === 0 && totalsAll.length === 0;

  const homeAbbr = homeMoneyline
    ? getAbbr(homeMoneyline.marketTitle)
    : getAbbr(teams.home);
  const awayAbbr = awayMoneyline
    ? getAbbr(awayMoneyline.marketTitle)
    : getAbbr(teams.away);

  // 判断哪个列的按钮被选中
  const isSpreadSelected = selectedMarketId
    ? spreadsAll.some((m) => m.marketId === selectedMarketId)
    : false;
  const isTotalSelected = selectedMarketId
    ? totalsAll.some((m) => m.marketId === selectedMarketId)
    : false;

  // Spread 多组时显示切换器（每个 market 独立一组，不去重）
  const showSpreadSwitcher = isSpreadSelected && spreadsAll.length > 1;
  // Total 多组时显示切换器
  const showTotalSwitcher = isTotalSelected && totalGroups.length > 1;
  const showLineSwitcher = showSpreadSwitcher || showTotalSwitcher;

  const activeSwitcherLines = useMemo(() => {
    if (showSpreadSwitcher) {
      return spreadsAll.map((m, i) => ({ value: Math.abs(m.lineValue ?? 0), idx: i }));
    }
    if (showTotalSwitcher) {
      return totalGroups.map(([lv], i) => ({ value: Math.abs(lv), idx: i }));
    }
    return [];
  }, [showSpreadSwitcher, showTotalSwitcher, spreadsAll, totalGroups]);
  const activeSwitcherIdx = showSpreadSwitcher ? spreadLineIdx : totalLineIdx;
  const setActiveSwitcherIdx = showSpreadSwitcher ? setSpreadLineIdx : setTotalLineIdx;

  const handleCardClick = () => {
    onToggle?.();
  };

  const handleGameView = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onGameView) {
      onGameView(event.slug);
    } else {
      router.push(buildSportsEventUrl(event.slug, event.tagsSlug?.map(s => ({ slug: s }))));
    }
  };

  const handleOutcomeClick = (
    e: React.MouseEvent,
    item: SportsMarketItem | undefined,
    idx: number
  ) => {
    e.stopPropagation();
    if (item) {
      setActiveExpandMarket(item);
      if (onOutcomeClick) onOutcomeClick(item, idx);
    }
  };


  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden">
      {/* 可点击的卡片主体 */}
      <div
        className="p-2 px-3 cursor-pointer hover:bg-[var(--bg-secondary)]/30 transition-all"
        onClick={handleCardClick}
      >
        {/* 头部：时间 + 交易量 + Game View */}
        <div className="flex justify-between items-center">
          <div className="text-xs flex items-center gap-2 font-semibold">
            <div className="text-[var(--text-secondary)] bg-[var(--bg-secondary)] px-2 rounded-sm">
              {endTime}
            </div>
            <div className="text-[var(--text-secondary)]">
              {formatAbbreviatedCurrency(Number(event.volume ?? 0), '$')} {t.sports.game.vol}.
            </div>
          </div>
          <div
            className="flex items-center bg-[var(--bg-hover)] rounded-sm overflow-hidden text-xs pl-2 py-1 gap-2 hover:bg-[var(--bg-secondary)] transition-all"
            onClick={handleGameView}
          >
            <div className="bg-[var(--bg-primary)] px-1 py-[1px] rounded-sm text-xs border border-[var(--border)] text-[var(--text-secondary)]">
              {event.marketCount}
            </div>
            <div className="font-semibold">{t.sports.game.gameView}</div>
            <ChevronRight size={18} />
          </div>
        </div>

        {/* 主体：队伍 + Moneyline/Spread/Total 按钮 */}
        <div className="flex justify-between items-center mt-2 max-md:flex-col max-md:gap-2 max-md:items-stretch">
          {/* 左侧：队伍信息 */}
          <div className="space-y-1.5 min-w-0 flex-1">
            {/* 主队 */}
            <div className="flex items-center gap-2">
              <ProxyImage
                src={event.icon}
                alt=""
                className="h-5 w-5 object-contain flex-shrink-0"
                fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHJ4PSIxMiIgZmlsbD0iIzNhM2EzYSIvPjwvc3ZnPg=="
              />
              <div className="text-sm font-medium truncate min-w-0">{teams.home}</div>
            </div>
            {/* 客队 */}
            {teams.away && (
              <div className="flex items-center gap-2 min-w-0">
                <ProxyImage
                  src={event.image}
                  alt=""
                  className="h-5 w-5 object-contain flex-shrink-0"
                  fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHJ4PSIxMiIgZmlsbD0iIzNhM2EzYSIvPjwvc3ZnPg=="
                />
                <div className="text-sm font-medium truncate min-w-0">{teams.away}</div>
              </div>
            )}
          </div>

          {/* 右侧按钮区 */}
          <div className="flex gap-3 md:gap-3 max-md:gap-1.5 max-md:w-full flex-shrink-0">
            {/* Moneyline 列：横向排布（仅 moneyline 时居右） */}
            <div className={`gap-1.5 flex ${onlyMoneyline ? "flex-row items-center" : "flex-col max-md:flex-row max-md:flex-1"}`}>
              <GameButton
                className={onlyMoneyline ? "w-32 max-md:w-auto max-md:flex-1" : "w-28 h-[30px] max-md:w-auto max-md:flex-1"}
                color={
                  selectedMarketId === homeMoneyline?.marketId ? "#d4a017" : "rgba(200,200,200,0.2)"
                }
                textColor={selectedMarketId === homeMoneyline?.marketId ? "#fff" : "var(--text-primary)"}
                onClick={(e) => handleOutcomeClick(e, homeMoneyline, 0)}
              >
                {homeMoneyline ? (
                  <><span className="uppercase opacity-80">{homeAbbr}</span>
                  <span className="ml-1 font-bold">{getYesPrice(homeMoneyline)}</span></>
                ) : <span className="opacity-40">-</span>}
              </GameButton>
              <GameButton
                className={onlyMoneyline ? "w-32 max-md:w-auto max-md:flex-1" : "w-28 h-[30px] max-md:w-auto max-md:flex-1"}
                size="sm"
                variant="secondary"
                color={selectedMarketId === drawMarket?.marketId ? "#9b6dd8" : "rgba(200,200,200,0.2)"}
                textColor={selectedMarketId === drawMarket?.marketId ? "#fff" : "var(--text-primary)"}
                onClick={(e) => handleOutcomeClick(e, drawMarket, 0)}
              >
                {drawMarket ? (
                  <><span className="uppercase opacity-80">DRAW</span>
                  <span className="ml-1 font-bold">{getYesPrice(drawMarket)}</span></>
                ) : <span className="opacity-40">-</span>}
              </GameButton>
              <GameButton
                className={onlyMoneyline ? "w-32 max-md:w-auto max-md:flex-1" : "w-28 h-[30px] max-md:w-auto max-md:flex-1"}
                color={
                  selectedMarketId === awayMoneyline?.marketId ? "#5ba3a3" : "rgba(200,200,200,0.2)"
                }
                textColor={selectedMarketId === awayMoneyline?.marketId ? "#fff" : "var(--text-primary)"}
                onClick={(e) => handleOutcomeClick(e, awayMoneyline, 0)}
              >
                {awayMoneyline ? (
                  <><span className="uppercase opacity-80">{awayAbbr}</span>
                  <span className="ml-1 font-bold">{getYesPrice(awayMoneyline)}</span></>
                ) : <span className="opacity-40">-</span>}
              </GameButton>
            </div>

            {/* Spread 列：4 独立分组（不去重）；切换器切换；当前组显示 home/away 2 个按钮 */}
            {!onlyMoneyline && (
              <div className="gap-1.5 flex flex-col max-md:hidden">
                {currentSpreadMarket ? (() => {
                  const sorted = sortOutcomesByOriginalIndex(currentSpreadMarket.outcomes || []);
                  const homeOutcome = sorted.find(o => o.originalIndex === 0);
                  const awayOutcome = sorted.find(o => o.originalIndex === 1);
                  const rawLv = currentSpreadMarket.lineValue ?? 0;
                  const homeLvStr = rawLv > 0 ? `+${rawLv}` : String(rawLv);
                  const awayLv = -rawLv;
                  const awayLvStr = awayLv > 0 ? `+${awayLv}` : String(awayLv);
                  const homeAbbrFromOutcome = homeOutcome ? getAbbr(homeOutcome.outcome) : homeAbbr;
                  const awayAbbrFromOutcome = awayOutcome ? getAbbr(awayOutcome.outcome) : awayAbbr;
                  const isSpreadSelected = selectedMarketId === currentSpreadMarket.marketId;
                  return (
                    <>
                      <GameButton
                        key={`${currentSpreadMarket.marketId}-home`}
                        className="w-28 flex-1"
                        size="sm"
                        variant="secondary"
                        color={isSpreadSelected ? "#3bab68" : "rgba(200,200,200,0.2)"}
                        textColor={isSpreadSelected ? "#fff" : "var(--text-primary)"}
                        onClick={(e) => handleOutcomeClick(e, currentSpreadMarket, 0)}
                      >
                        <span className="uppercase opacity-80">{homeAbbrFromOutcome}</span>
                        <span className="ml-1">{homeLvStr}</span>
                        <span className="ml-1 font-bold">{homeOutcome ? formatPrice(homeOutcome.price) : "—"}</span>
                      </GameButton>
                      <GameButton
                        key={`${currentSpreadMarket.marketId}-away`}
                        className="w-28 flex-1"
                        size="sm"
                        variant="secondary"
                        color={isSpreadSelected ? "#e13737" : "rgba(200,200,200,0.2)"}
                        textColor={isSpreadSelected ? "#fff" : "var(--text-primary)"}
                        onClick={(e) => handleOutcomeClick(e, currentSpreadMarket, 1)}
                      >
                        <span className="uppercase opacity-80">{awayAbbrFromOutcome}</span>
                        <span className="ml-1">{awayLvStr}</span>
                        <span className="ml-1 font-bold">{awayOutcome ? formatPrice(awayOutcome.price) : "—"}</span>
                      </GameButton>
                    </>
                  );
                })() : spreadsAll.length > 0 ? null : <span className="opacity-40">-</span>}
              </div>
            )}

            {/* Total 列（1个 market，Over/Under 是 outcomes） */}
            {!onlyMoneyline && (
              <div className="gap-1.5 flex flex-col max-md:hidden">
                <GameButton
                  className="w-28 flex-1"
                  size="sm"
                  variant="secondary"
                  color={
                    selectedMarketId === currentTotalMarket?.marketId ? "#3bab68" : "rgba(200,200,200,0.2)"
                  }
                  textColor={selectedMarketId === currentTotalMarket?.marketId ? "#fff" : "var(--text-primary)"}
                  onClick={(e) => handleOutcomeClick(e, currentTotalMarket, 0)}
                >
                  {currentTotalMarket ? (
                    <><span className="opacity-80">O</span>
                    <span className="ml-1">{currentTotalLine != null ? Math.abs(currentTotalLine) : ""}</span>
                    <span className="ml-2 font-bold">{formatPrice(currentTotalMarket.outcomes?.find(o => o.originalIndex === 0)?.price || "0")}</span></>
                  ) : <span className="opacity-40">-</span>}
                </GameButton>
                <GameButton
                  className="w-28 flex-1"
                  size="sm"
                  variant="secondary"
                  color={
                    selectedMarketId === currentTotalMarket?.marketId ? "#e13737" : "rgba(200,200,200,0.2)"
                  }
                  textColor={selectedMarketId === currentTotalMarket?.marketId ? "#fff" : "var(--text-primary)"}
                  onClick={(e) => handleOutcomeClick(e, currentTotalMarket, 1)}
                >
                  {currentTotalMarket ? (
                    <><span className="opacity-80">U</span>
                    <span className="ml-1">{currentTotalLine != null ? Math.abs(currentTotalLine) : ""}</span>
                    <span className="ml-2 font-bold">{formatPrice(currentTotalMarket.outcomes?.find(o => o.originalIndex === 1)?.price || "0")}</span></>
                  ) : <span className="opacity-40">-</span>}
                </GameButton>
              </div>
            )}
          </div>
        </div>

        {/* 底部 lineValue 切换器：仅选中 Spread/Total 且多组时显示 */}
        {showLineSwitcher && (
          <LineValueSwitcher
            lines={activeSwitcherLines}
            activeIdx={activeSwitcherIdx}
            onSelect={(idx) => {
              setActiveSwitcherIdx(idx);
              if (showSpreadSwitcher) {
                const newMarket = spreadsAll[idx];
                if (newMarket) {
                  setActiveExpandMarket(newMarket);
                  if (onOutcomeClick) onOutcomeClick(newMarket, 0);
                }
              } else {
                const newGroup = totalGroups[idx]?.[1];
                if (newGroup?.[0]) {
                  setActiveExpandMarket(newGroup[0]);
                  if (onOutcomeClick) onOutcomeClick(newGroup[0], 0);
                }
              }
            }}
          />
        )}
      </div>

      {/* 展开面板：OrderBook / Graph（参考 GameCard 动画） */}
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
                  // 跟随按钮点击和 lineValue 切换，默认第一个 moneyline
                  const panelMarket = activeExpandMarket || moneylineMarkets[0];
                  if (!panelMarket) {
                    return (
                      <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">
                        {t.sports.game.noEvents}
                      </div>
                    );
                  }
                  return (
                    <SpotOrderbook
                      key={panelMarket.marketId}
                      ticker={getAbbr(panelMarket.marketTitle)}
                      marketId={panelMarket.marketId}
                      marketOutcomes={
                        panelMarket.outcomes?.map((o: any) => ({
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
                  const panelMarket = activeExpandMarket || moneylineMarkets[0];
                  if (!panelMarket) {
                    return (
                      <div className="p-4 text-center text-[var(--text-tertiary)] text-sm">
                        {t.sports.game.noEvents}
                      </div>
                    );
                  }
                  return (
                    <SportsOutcomeGraph
                      key={panelMarket.marketId}
                      marketId={panelMarket.marketId}
                      label={panelMarket.marketTitle.replace(/\s*\(.*?\)/, "").trim()}
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

export default SportsEventCard;
