/**
 * TradingPanel Skeleton — dynamic 加载期间的占位。
 * 高度 / 内边距与真实 TradingPanel 接近,避免布局抖动。
 * 真实组件加载完成后(~100-300ms)无缝替换。
 */

import React from "react";

interface TradingPanelSkeletonProps {
  hideHeader?: boolean;
}

const Bar: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div
    className={`bg-[var(--bg-secondary)] rounded animate-pulse ${className}`}
  />
);

const TradingPanelSkeleton: React.FC<TradingPanelSkeletonProps> = ({
  hideHeader = false,
}) => {
  return (
    <div className="font-semibold relative p-4">
      {/* Market 头部:icon + 标题 + 价格 */}
      {!hideHeader && (
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Bar className="w-10 h-10 rounded-full" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <Bar className="h-4 w-3/4" />
              <Bar className="h-3 w-1/2" />
            </div>
          </div>
        </div>
      )}

      {/* Buy / Sell tabs */}
      <div className="flex gap-2 mb-3">
        <Bar className="h-8 flex-1" />
        <Bar className="h-8 flex-1" />
      </div>

      {/* Yes / No 切换 */}
      <div className="flex gap-2 mb-3">
        <Bar className="h-10 flex-1" />
        <Bar className="h-10 flex-1" />
      </div>

      {/* 金额输入 */}
      <Bar className="h-12 mb-3" />

      {/* 快捷金额按钮 */}
      <div className="flex gap-2 mb-4">
        <Bar className="h-7 flex-1" />
        <Bar className="h-7 flex-1" />
        <Bar className="h-7 flex-1" />
        <Bar className="h-7 flex-1" />
      </div>

      {/* 主操作按钮 */}
      <div className="h-11 bg-[var(--accent)]/30 rounded animate-pulse" />

      {/* To win 提示行 */}
      <div className="mt-4">
        <Bar className="h-4 w-2/3" />
      </div>
    </div>
  );
};

export default TradingPanelSkeleton;
