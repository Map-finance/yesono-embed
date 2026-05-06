"use client";

/**
 * MarketChart - 市场价格走势图表（使用 recharts）。
 * 使用 /api/price-history 接口获取真实数据。
 *
 * 大块逻辑已拆出：
 *   - MarketChartView.tsx            图例 / 时间范围选择器 / 图表本体 / tooltip / chance
 *   - MarketChartOptionsModal.tsx    "选项" 弹窗
 *   - MarketChartSettingsModal.tsx   "设置" 弹窗
 *   - MarketChart.helpers.ts         UITimeRange / mapToApiRange / colors / 常量
 */

import React, { useState, useMemo, useEffect } from "react";
import { Market } from "@/types/types";
import { PolymarketMarketResp } from "@/types/home";
import { Settings, Share2, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { usePriceHistory } from "@/lib/hooks/usePriceHistory";
import EmbedModal from "./EmbedModal";
import MarketChartView from "./MarketChartView";
import MarketChartOptionsModal from "./MarketChartOptionsModal";
import MarketChartSettingsModal, {
  type MarketChartSettings,
} from "./MarketChartSettingsModal";
import { mapToApiRange, type UITimeRange } from "./MarketChart.helpers";

interface MarketChartProps {
  market: Market;
  /** Event markets from API - each market becomes a line on the chart */
  eventMarkets?: PolymarketMarketResp[];
  /**
   * 历史遗留 props：原本用于内嵌 TimeCapsule，但 JSX 中早已不再渲染该组件。
   * 此处保留接收，避免破坏现有调用方（如 app/market/[id]/page.tsx）。
   */
  tags?: unknown;
  eventEndDate?: number;
  /** 区分是否是体育赛事视图（M2），影响 Embed 模块样式 */
  isSports?: boolean;
}

const MarketChart: React.FC<MarketChartProps> = ({
  market,
  eventMarkets,
  isSports,
}) => {
  const { t } = useTranslation();
  const [selectedRange, setSelectedRange] = useState<UITimeRange>("1D");
  const [settingsOpen, setSettingsOpen] = useState(false);
  type ActiveModal = "export" | "embed" | "options" | null;
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);

  // 过滤已结算市场，优先显示未结算的前4条
  const activeEventMarkets = useMemo(() => {
    if (!eventMarkets || eventMarkets.length === 0) return undefined;
    const unsettled = eventMarkets.filter(
      (m) =>
        m.umaResolutionStatus !== "RESOLVED" &&
        (m as any).status !== "RESOLVED"
    );
    // 优先用未结算的前4条；如果未结算不足则补充已结算的
    if (unsettled.length >= 4) return unsettled.slice(0, 4);
    if (unsettled.length > 0) return unsettled.slice(0, 4);
    // 全部已结算时用原始前4条
    return eventMarkets.slice(0, 4);
  }, [eventMarkets]);

  const [selectedOptions, setSelectedOptions] = useState<number[]>(() =>
    (activeEventMarkets || market.options).slice(0, 4).map((_, i) => i)
  );

  useEffect(() => {
    // 当 market 或 eventMarkets 切换时，重置默认选中（避免旧状态指向不存在的 option）
    setSelectedOptions(
      (activeEventMarkets || market.options).slice(0, 4).map((_, i) => i)
    );
    setActiveModal(null);
  }, [market.id, activeEventMarkets, market.options]);

  const [settings, setSettings] = useState<MarketChartSettings>({
    autoscale: true,
    xAxis: true,
    yAxis: true,
    horizontalGrid: true,
    verticalGrid: false,
    annotations: true,
  });

  // Get market IDs from eventMarkets
  const marketIds = useMemo(() => {
    if (activeEventMarkets && activeEventMarkets.length > 0) {
      return activeEventMarkets.map((m) => String(m.id));
    }
    return [];
  }, [activeEventMarkets]);

  // Get display options (market labels)
  const displayOptions = useMemo(() => {
    if (activeEventMarkets && activeEventMarkets.length > 0) {
      return activeEventMarkets.map((m) => ({
        label: m.groupItemTitle || m.question || "Market",
        marketId: String(m.id),
      }));
    }
    return market.options.slice(0, 4).map((opt) => ({
      label: opt.label,
      marketId: "",
    }));
  }, [activeEventMarkets, market.options]);

  // Fetch price history data
  const {
    data: chartData,
    loading,
    currentPrices,
    error,
  } = usePriceHistory(
    marketIds,
    mapToApiRange(selectedRange),
    true // enabled
  );

  // Calculate current percentages from API data
  const currentPercentages = useMemo(() => {
    const result: Record<number, string> = {};
    displayOptions.forEach((opt, idx) => {
      const price = currentPrices[opt.marketId];
      if (price !== undefined && !isNaN(price)) {
        result[idx] = price.toFixed(1);
      } else if (
        market.options[idx] &&
        !isNaN(market.options[idx].percentage)
      ) {
        result[idx] = market.options[idx].percentage.toFixed(1);
      }
    });
    return result;
  }, [currentPrices, displayOptions, market.options]);

  return (
    <div className="rounded-xl p-4">
      <MarketChartView
        displayOptions={displayOptions}
        selectedOptions={selectedOptions}
        chartData={chartData}
        loading={loading}
        error={error}
        currentPercentages={currentPercentages}
        selectedRange={selectedRange}
        onRangeChange={setSelectedRange}
        settings={settings}
      />

      {/* 底部工具栏 */}
      <div className="flex items-center justify-end mt-2 pt-2 border-t border-(--border) relative z-0">
        <div className="flex gap-1 relative z-10 bg-(--bg-primary) shadow-[-10px_0_10px_var(--bg-primary)]">
          <button
            onClick={() => setActiveModal("embed")}
            className="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-secondary)"
            title={"Embed"}
          >
            <Share2 size={14} />
          </button>
          <button
            onClick={() => setActiveModal("options")}
            className="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-secondary)"
            title={t.market.common.options}
          >
            <SlidersHorizontal size={14} />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded hover:bg-(--bg-hover) text-(--text-secondary)"
            title={t.market.common.settings}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Embed Modal - 新版实现 */}
      <EmbedModal
        isOpen={activeModal === "embed"}
        onClose={() => setActiveModal(null)}
        market={market}
        eventMarkets={eventMarkets}
        isSports={isSports}
      />

      {/* Options Modal */}
      <MarketChartOptionsModal
        open={activeModal === "options"}
        onClose={() => setActiveModal(null)}
        options={market.options}
        selectedOptions={selectedOptions}
        onSelectedOptionsChange={setSelectedOptions}
      />

      {/* Settings Modal */}
      <MarketChartSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />
    </div>
  );
};

export default MarketChart;
