"use client";

/**
 * MarketChartSettingsModal - MarketChart 的图表显示设置弹窗。
 * 从 MarketChart.tsx 拆出，机械搬运无修改。
 */

import React from "react";
import { useTranslation } from "@/lib/i18n";

export interface MarketChartSettings {
  autoscale: boolean;
  xAxis: boolean;
  yAxis: boolean;
  horizontalGrid: boolean;
  verticalGrid: boolean;
  annotations: boolean;
}

interface MarketChartSettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: MarketChartSettings;
  onSettingsChange: (
    updater: (prev: MarketChartSettings) => MarketChartSettings
  ) => void;
}

const MarketChartSettingsModal: React.FC<MarketChartSettingsModalProps> = ({
  open,
  onClose,
  settings,
  onSettingsChange,
}) => {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-(--bg-card) border border-(--border) rounded-xl p-4 w-[260px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-medium text-(--text-primary) mb-3">
          {t.market.common.settings}
        </div>
        {[
          { key: "autoscale", label: t.market.chart.autoscale },
          { key: "xAxis", label: t.market.chart.xAxis },
          { key: "yAxis", label: t.market.chart.yAxis },
          { key: "horizontalGrid", label: t.market.chart.horizontalGrid },
          { key: "verticalGrid", label: t.market.chart.verticalGrid },
          { key: "annotations", label: t.market.chart.annotations },
        ].map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between py-2"
          >
            <span className="text-sm text-(--text-secondary)">
              {item.label}
            </span>
            <button
              onClick={() =>
                onSettingsChange((prev) => ({
                  ...prev,
                  [item.key]: !prev[item.key as keyof MarketChartSettings],
                }))
              }
              className={`w-10 h-5 rounded-full transition-colors relative ${
                settings[item.key as keyof MarketChartSettings]
                  ? "bg-[#3b82f6]"
                  : "bg-(--bg-secondary)"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                  settings[item.key as keyof MarketChartSettings]
                    ? "left-5"
                    : "left-0.5"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarketChartSettingsModal;
