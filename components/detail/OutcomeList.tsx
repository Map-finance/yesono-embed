"use client";

/**
 * OutcomeList - 选项结果列表（可展开显示详情）。
 * 大块逻辑已拆出：
 *   - OutcomeRow.tsx     单个 outcome 行（桌面 + 移动 + 展开 tabs）
 *   - OutcomeGraph.tsx   展开后的子图表
 *   - BuyButton.tsx      Yes/No 买卖按钮
 *   - OutcomeList.helpers.ts  共享类型 / 常量 / 纯工具函数
 */

import React, { useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Market } from "@/types/types";
import { PolymarketMarketResp } from "@/types/home";
import { useTranslation } from "@/lib/i18n";
import { getOutcomesByMarket } from "@/lib/utils/outcomes";
import { useTradingStore } from "@/lib/store/tradingStore";
import {
  clampOutcomeProbabilityPercent,
  fillEvenSplitWhenAllZero,
} from "@/utils/format";
import { useSettlementResults } from "@/lib/hooks/useSettlementResults";
import { useEventVolume } from "@/lib/hooks/useEventVolume";
import OutcomeRow from "./OutcomeRow";
import type { DisplayOption } from "./OutcomeList.helpers";

interface OutcomeListProps {
  market: Market;
  onMobileTrade?: (outcomeIndex: number, side: "yes" | "no") => void;
  /** Event markets from API - each market becomes an outcome row */
  eventMarkets?: PolymarketMarketResp[];
  /** 事件 slug,用于订单簿头部"会话级交易量"展示(对齐 Polymarket) */
  eventSlug?: string;
  /** 事件频率 slug(5m/15m/1h/4h),用于短期市场切换 trade-by-trade 概率图 */
  frequencySlug?: string;
  /** 事件级"已截止"（客户端到达 endDate）；为真时各行禁止下单、显示"等待结算" */
  eventEnded?: boolean;
  /** Callback when market selection changes, passes market info */
  onMarketSelect?: (marketInfo: {
    isResolved: boolean;
    resolvedOutcome?: string;
    title: string;
    percentage?: number;
    icon?: string;
    marketId: string;
    questionID: string;
    eventId?: string;
  }) => void;
}

const OutcomeList: React.FC<OutcomeListProps> = ({
  market,
  onMobileTrade,
  eventMarkets,
  eventSlug,
  frequencySlug,
  eventEnded,
  onMarketSelect,
}) => {
  // 精准 selector，避免 orderBookRaw 高频更新时重渲染整个列表容器
  const selectOutcomeId = useTradingStore((s) => s.selectOutcomeId);
  const setSelectOutcomeId = useTradingStore((s) => s.setSelectOutcomeId);
  const setMarket = useTradingStore((s) => s.setMarket);
  // 记录已初始化过默认选中的 marketId，避免重复设置覆盖用户点击
  const defaultSelectedMarketIdRef = useRef<string | null>(null);

  // 子市场实时交易量:按 eventId 拉一次(SWR 轮询,详情页 page 已同 key 调用,
  // 两边共享同一份请求/数据,dedupe 10s)。按 marketId 构 Map,渲染时按 m.id override。
  const eventIdForVolume = eventMarkets?.[0]?.eventId;
  const { data: eventVolumeData } = useEventVolume(eventIdForVolume);
  const volumeByMarketId = useMemo(() => {
    const m = new Map<string, number>();
    eventVolumeData?.markets?.forEach((mv) => {
      if (mv?.marketId != null && typeof mv.volume === "number") {
        m.set(String(mv.marketId), mv.volume);
      }
    });
    return m;
  }, [eventVolumeData]);
  // 如果有 eventMarkets，将其转换为 options 格式显示
  const displayOptions = useMemo(() => {
    if (eventMarkets && eventMarkets.length > 0) {
      return eventMarkets.map((m) => {
        // PolymarketMarketResp 的 outcomes 和 outcomePrices 是 JSON 字符串
        let yesPercentage = 50; // 用于百分比显示
        let yesPriceRaw = 0; // 用于 buy yes 按钮价格 (来自 outcomePrices)
        let noPriceRaw = 0; // 用于 buy no 按钮价格 (来自 outcomePrices)
        let tokenIds: string[] = [];
        try {
          const outcomes = getOutcomesByMarket(m);
          const prices = JSON.parse(m.outcomePrices || "[]") as number[];
          const yesIndex = outcomes.findIndex((o) => o.toLowerCase() === "yes");
          const noIndex = outcomes.findIndex((o) => o.toLowerCase() === "no");

          // outcomePrices 用于 buy yes/buy no 按钮价格。
          // outcomePrices 顺序与 outcomes 一致(index 0 = 第一个 outcome)。按 "yes"/"no"
          // 文案匹配在 Up/Down 这类非 yes/no 命名的市场会取不到(findIndex 返回 -1),
          // 导致 yesPriceRaw 落回默认 0、按钮显示成误导性的 0.1¢,且与右侧 TradingPanel
          // (用 prices[0]/prices[1])对不上。这里 findIndex 取不到时回退到位置 0/1。
          const yIdx = yesIndex >= 0 ? yesIndex : 0;
          const nIdx = noIndex >= 0 ? noIndex : 1;
          if (prices[yIdx] !== undefined) {
            yesPriceRaw = prices[yIdx];
          }
          if (prices[nIdx] !== undefined) {
            noPriceRaw = prices[nIdx];
          }

          // 无盘口/价格全 0 时按 50/50 均分展示（与 TradingPanel 一致），
          // 否则按钮会被 clamp 成误导性的 0.1¢
          const [yesPriceFilled, noPriceFilled] = fillEvenSplitWhenAllZero([
            yesPriceRaw,
            noPriceRaw,
          ]);
          yesPriceRaw = yesPriceFilled ?? yesPriceRaw;
          noPriceRaw = noPriceFilled ?? noPriceRaw;

          // rowOutcomePrice 用于百分比显示（优先）
          const rowPrices = (m as any).rowOutcomePrice
            ? JSON.parse((m as any).rowOutcomePrice)
            : null;
          if (rowPrices && rowPrices.length > 0) {
            // 同样对全 0 行情做均分，避免百分比显示成 1%
            const [rowYesFilled] = fillEvenSplitWhenAllZero(rowPrices);
            yesPercentage = clampOutcomeProbabilityPercent(
              rowYesFilled ?? rowPrices[0],
            );
          } else {
            // fallback 到 outcomePrices（已做均分处理）
            yesPercentage = clampOutcomeProbabilityPercent(yesPriceRaw);
          }

          // 解析 clobTokenIds
          tokenIds = JSON.parse(m.clobTokenIds || "[]") as string[];
        } catch (err) {
          console.error("Error parsing clobTokenIds:", err);
        }
        // 判断解决结果
        const resolved =
          m.umaResolutionStatus === "RESOLVED" ||
          (m as any).status === "RESOLVED";
        // 已截止但未结算：后端已 closed / 停止接单，用于"等待结算"中间态（禁止下单）
        const ended =
          !resolved &&
          ((m as any).closed === true || (m as any).acceptingOrders === false);
        let resolvedOutcome: string | undefined;
        if (resolved) {
          // 找出获胜的 outcome（价格为 1 的那个，或价格最高的那个作为 fallback）
          try {
            // 注：prices 实际可能是 string[]，比较前显式 Number() 包装，否则
            // ">" 会按字典序比较挑错 "Resolved: {outcome}" 标签
            const outcomes = getOutcomesByMarket(m);
            const prices = JSON.parse(m.outcomePrices || "[]") as (
              | number
              | string
            )[];
            const winnerIndex = prices.findIndex((p) => Number(p) >= 0.99);
            if (winnerIndex >= 0) {
              resolvedOutcome = outcomes[winnerIndex];
            } else if (outcomes.length > 0) {
              // 价格未更新为 1/0 时，取价格最高的 outcome 作为 fallback
              let maxIdx = 0;
              for (let i = 1; i < prices.length; i++) {
                if (Number(prices[i]) > Number(prices[maxIdx])) maxIdx = i;
              }
              resolvedOutcome = outcomes[maxIdx];
            }
          } catch (e) {
            console.error("[OutcomeList] Failed to determine resolved outcome", e);
          }
        }
        return {
          label: m.groupItemTitle || m.question || "Market",
          percentage: yesPercentage,
          yesPriceRaw, // outcomePrices[0] 原始值
          noPriceRaw, // outcomePrices[1] 原始值
          change: m.oneDayPriceChange
            ? Math.round(m.oneDayPriceChange * 100)
            : undefined,
          marketId: m.id,
          questionID: m.conditionId,
          clobTokenIds: tokenIds,
          isResolved: resolved,
          isEnded: ended,
          resolvedOutcome,
          icon: m.icon || m.image,
          eventId: m.eventId,
          // 优先用 SWR 拉到的实时分市场交易量,缺失时回退 m.volume
          volume: volumeByMarketId.get(String(m.id)) ?? m.volume ?? 0,
          marketData: m,
        };
      });
    }
    // fallback 到原有的 market.options
    return market.options.map((opt, idx) => ({
      ...opt,
      yesPriceRaw: opt.percentage / 100,
      noPriceRaw: (100 - opt.percentage) / 100,
      marketId: idx.toString(),
      questionID: "",
      clobTokenIds: [] as string[],
      isResolved: false,
      isEnded: false,
      resolvedOutcome: undefined,
      icon: market.icon,
      eventId: undefined as string | undefined,
      volume: 0,
      marketData: null,
    }));
  }, [eventMarkets, market.options, market.icon, volumeByMarketId]);

  const router = useRouter();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const { t } = useTranslation();

  // 分离 active 和 resolved markets
  const { activeOptions, resolvedOptions } = useMemo(() => {
    const active = displayOptions.filter((opt) => !opt.isResolved);
    const resolved = displayOptions.filter((opt) => opt.isResolved);
    return { activeOptions: active, resolvedOptions: resolved };
  }, [displayOptions]);

  // 仅在展开"查看已结算"后才为已结算 market 拉取结算结果（YES 侧赔付比例），
  // 避免折叠状态下白白并发 N 个请求。
  const resolvedMarketIds = useMemo(
    () =>
      showResolved ? resolvedOptions.map((opt) => String(opt.marketId)) : [],
    [showResolved, resolvedOptions]
  );
  const settlementResults = useSettlementResults(resolvedMarketIds);

  // 记录上次已通知父组件/store 的 marketId，防止 activeOptions 引用变化时重复调用 setMarket
  // setMarket 内部会关闭旧 WS 并打开新 WS，频繁调用会造成不必要的 WS 重连
  const lastNotifiedMarketIdRef = useRef<string | null>(null);

  const handleToggleExpand = (index: number, e: React.MouseEvent, option: any) => {
    e.stopPropagation();

    // 已结算的 outcome 不允许跳转到移动端详情页
    if (option.isResolved) return;

    // 移动端跳转到新页面 - 使用原始 displayOptions 中的真实索引
    if (window.innerWidth < 1024) {
      const realIndex = displayOptions.findIndex(
        (opt) => String(opt.marketId) === String(option.marketId)
      );
      const navIndex = realIndex >= 0 ? realIndex : index;
      router.push(`/market/${market.slug || market.id}/outcome/${navIndex}`);
      return;
    }
    // 桌面端展开/收起
    setExpandedIndex(expandedIndex === index ? null : index);
    if (option.marketData) setMarket(option.marketData);
    // 通知父组件当前选中的 market 信息
    if (onMarketSelect) {
      onMarketSelect({
        isResolved: option.isResolved,
        resolvedOutcome: option.resolvedOutcome,
        title: option.label,
        percentage: option.percentage,
        icon: option.icon,
        marketId: option.marketId,
        questionID: option.questionID,
        eventId: option.eventId,
      });
    }
  };

  // 点击 Yes/No 按钮时，如果点击的行不是当前选中的市场，先切换市场再设置 outcome
  const handleSelectOutcome = React.useCallback(
    (option: DisplayOption, tokenId: string) => {
      const currentMarketId = market?.id;
      const targetMarketId = String(option.marketId);
      if (currentMarketId !== targetMarketId && option.marketData) {
        setMarket(option.marketData);
        lastNotifiedMarketIdRef.current = targetMarketId;
        if (onMarketSelect) {
          onMarketSelect({
            isResolved: option.isResolved,
            resolvedOutcome: option.resolvedOutcome,
            title: option.label,
            percentage: option.percentage,
            icon: option.icon,
            marketId: String(option.marketId),
            questionID: option.questionID || "",
            eventId: option.eventId,
          });
        }
        // setMarket 会默认选第一个 clobTokenId，需要覆盖为用户点击的 tokenId
        // 使用 setTimeout 确保在 setMarket 完成后再设置
        setTimeout(() => setSelectOutcomeId(tokenId), 0);
      } else {
        setSelectOutcomeId(tokenId);
      }
    },
    [market?.id, setMarket, setSelectOutcomeId, onMarketSelect]
  );

  // 默认选中第一个非 resolved 的 market 的 buy yes
  React.useEffect(() => {
    // 优先选中第一个 active market，如果没有则选中第一个 resolved market
    const firstOpt = activeOptions.length > 0 ? activeOptions[0] : resolvedOptions[0];
    if (!firstOpt) return;

    const marketId = String(firstOpt.marketId);

    // 仅在 market 真正切换时才调用 setMarket
    // 防止 activeOptions 引用变化（但内容相同）时触发不必要的 WS 重连
    if (marketId !== lastNotifiedMarketIdRef.current) {
      lastNotifiedMarketIdRef.current = marketId;

      if (firstOpt.marketData) {
        setMarket(firstOpt.marketData);
      }
      if (onMarketSelect) {
        onMarketSelect({
          isResolved: firstOpt.isResolved,
          resolvedOutcome: firstOpt.resolvedOutcome,
          title: firstOpt.label,
          percentage: firstOpt.percentage,
          icon: firstOpt.icon,
          marketId: firstOpt.marketId,
          questionID: firstOpt.questionID,
          eventId: firstOpt.eventId,
        });
      }

      // 默认选中第一个非已结算 outcome 的 buy yes（clobTokenIds[0] 为 YES token）
      // 仅在尚未初始化默认选中时执行，避免覆盖用户的点击选择
      if (!firstOpt.isResolved && defaultSelectedMarketIdRef.current !== marketId) {
        defaultSelectedMarketIdRef.current = marketId;
        const yesTokenId = firstOpt.clobTokenIds[0] || "";
        if (yesTokenId) {
          // setMarket 内部会设置 selectOutcomeId = clobTokenIds[0]，此处再次确保一致
          setTimeout(() => setSelectOutcomeId(yesTokenId), 0);
        }
      }
    }
  }, [activeOptions, resolvedOptions, setMarket, setSelectOutcomeId, onMarketSelect]);

  // 单选项市场:表头(OUTCOME / % CHANCE)只有列名作用,只有一行时无从排序、无视觉收益,
  // 一律隐藏(对齐 h2 OutcomeList:1202-1211)。快速市场(常单选项)同时被这一支命中。
  const isSingleMarket =
    activeOptions.length + resolvedOptions.length <= 1;

  return (
    <div className="mt-4">
      {/* 表头(结果 / % 概率):仅多选项市场才有意义。单一市场(含快速市场 / 单个日周市场 /
          已结算只剩一个)一律隐藏。原来的 ⇅ 是写死字符、没有排序功能(误导),去掉。 */}
      {!isSingleMarket && (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-(--text-secondary) uppercase">
          <span className="flex-1">{t.market.outcome}</span>
          <span className="w-24 text-center">{`% ${t.common.chance}`}</span>
          <span className="w-48"></span>
        </div>
      )}

      <div className="space-y-2 max-h-[800px] overflow-y-auto scrollbar-hide">
        {/* Active markets */}
        {activeOptions.map((option, index) => (
          <OutcomeRow
            key={index}
            option={option}
            index={index}
            isExpanded={expandedIndex === index}
            selectOutcomeId={selectOutcomeId}
            marketId={market.id}
            settlementValue={settlementResults[String(option.marketId)]}
            eventEnded={eventEnded}
            eventSlug={eventSlug}
            frequencySlug={frequencySlug}
            onToggleExpand={(idx, e) => handleToggleExpand(idx, e, option)}
            onSelectOutcomeId={setSelectOutcomeId}
            onSelectOutcome={handleSelectOutcome}
            onMobileTrade={onMobileTrade}
          />
        ))}

        {/* Show Resolved 按钮 */}
        {resolvedOptions.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => setShowResolved(!showResolved)}
              className="w-full py-3 px-4 rounded-lg border border-(--border) bg-(--bg-secondary) hover:bg-(--bg-hover) text-sm text-(--text-primary) font-medium transition-colors flex items-center justify-center gap-2"
            >
              {showResolved ? (
                <>
                  <ChevronUp size={16} />
                  {t.market.hideResolved || "Hide Resolved"} ({resolvedOptions.length})
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  {t.market.viewResolved || "View Resolved"} ({resolvedOptions.length})
                </>
              )}
            </button>
          </div>
        )}

        {/* Resolved markets */}
        {showResolved &&
          resolvedOptions.map((option, index) => {
            const actualIndex = activeOptions.length + index;
            return (
              <OutcomeRow
                key={actualIndex}
                option={option}
                index={actualIndex}
                isExpanded={expandedIndex === actualIndex}
                selectOutcomeId={selectOutcomeId}
                marketId={market.id}
                settlementValue={settlementResults[String(option.marketId)]}
                eventEnded={eventEnded}
                eventSlug={eventSlug}
                frequencySlug={frequencySlug}
                onToggleExpand={(idx, e) => handleToggleExpand(idx, e, option)}
                onSelectOutcomeId={setSelectOutcomeId}
                onSelectOutcome={handleSelectOutcome}
                onMobileTrade={onMobileTrade}
              />
            );
          })}
      </div>
    </div>
  );
};

export default OutcomeList;
