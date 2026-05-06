"use client";

/**
 * MarketChartOptionsModal - MarketChart 的"显示哪些选项"弹窗。
 * 从 MarketChart.tsx 拆出，机械搬运无修改。
 */

import React from "react";
import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { colors } from "./MarketChart.helpers";

interface OptionItem {
  label: string;
}

interface MarketChartOptionsModalProps {
  open: boolean;
  onClose: () => void;
  options: OptionItem[];
  selectedOptions: number[];
  onSelectedOptionsChange: (next: number[]) => void;
}

const MarketChartOptionsModal: React.FC<MarketChartOptionsModalProps> = ({
  open,
  onClose,
  options,
  selectedOptions,
  onSelectedOptionsChange,
}) => {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-(--bg-card) border border-(--border) rounded-xl p-4 w-[300px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-medium text-(--text-primary) mb-3">
          {t.market.common.options}
        </div>
        {options.map((opt, i) => {
          const isSelected = selectedOptions.includes(i);
          return (
            <div
              key={i}
              onClick={() => {
                if (isSelected) {
                  onSelectedOptionsChange(
                    selectedOptions.filter((x) => x !== i)
                  );
                } else if (selectedOptions.length < 4) {
                  onSelectedOptionsChange([...selectedOptions, i]);
                }
              }}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg mb-1 cursor-pointer transition-colors ${
                isSelected
                  ? "bg-(--bg-hover) border border-(--accent)"
                  : "border border-transparent hover:bg-(--bg-hover)"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors[i % colors.length] }}
                />
                <span className="text-sm text-(--text-primary)">
                  {opt.label}
                </span>
              </div>
              {isSelected && (
                <X size={14} className="text-(--text-secondary)" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MarketChartOptionsModal;
