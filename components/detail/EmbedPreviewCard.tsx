"use client";

/**
 * EmbedModal 右侧预览面板：嵌入卡片 + 上下左右尺寸调节器。
 * 从 EmbedModal.tsx 拆出，机械搬运无修改。
 */

import React from "react";
import { ChevronDown, ChevronLeft, Plus, Minus } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import ProxyImage from "@/components/common/ProxyImage";
import { CustomTooltip } from "./EmbedModal.helpers";

interface PreviewMarketLike {
  id: string | number;
  title: string;
  icon?: string;
  volume?: string | number;
}

interface MarketLike {
  icon?: string;
}

interface ConfigShape {
  chart: boolean;
  buyButtons: boolean;
  volume: boolean;
  yAxis: boolean;
  gridRows: boolean;
  border: boolean;
  darkMode: boolean;
}

interface EmbedPreviewCardProps {
  market: MarketLike;
  previewMarket: PreviewMarketLike;
  isSports?: boolean;
  config: ConfigShape;
  lines: { id: string | number; color: string; label: string; price: number | string }[];
  formattedChartData: any[];
  dimensions: { width: number | string; height: number | string };
  actualWidth: number;
  actualHeight: number;
  onDimensionStep: (key: "width" | "height", delta: number) => void;
  onDimensionInput: (key: "width" | "height", val: string) => void;
}

const EmbedPreviewCard: React.FC<EmbedPreviewCardProps> = ({
  market,
  previewMarket,
  isSports,
  config,
  lines,
  formattedChartData,
  dimensions,
  actualWidth,
  actualHeight,
  onDimensionStep,
  onDimensionInput,
}) => {
  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* 包含了高度控制线和卡片的水平容器 */}
      <div className="relative flex items-center">
        {/* 调节器：高度（左侧） */}
        <div className="absolute right-full top-0 bottom-0 mr-6 flex items-center">
          <div className="absolute right-0 top-0 bottom-0 w-px bg-(--border) opacity-50" />
          <div className="absolute right-[-14px] top-1/2 -translate-y-1/2 flex items-center gap-2">
            <span className="text-[10px] text-(--text-tertiary) font-mono font-bold">
              H
            </span>
            <div className="group relative bg-(--bg-card) border border-(--border) rounded-md shadow-sm z-10 hover:border-(--text-tertiary) transition-colors">
              <button
                onClick={() => onDimensionStep("height", 10)}
                className="absolute -top-5 left-0 right-0 h-5 flex items-center justify-center text-(--text-tertiary) hover:text-(--text-primary) opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Plus size={12} />
              </button>
              <input
                type="number"
                value={dimensions.height}
                onChange={(e) => onDimensionInput("height", e.target.value)}
                className="w-10 h-7 bg-transparent text-center text-xs focus:outline-hidden appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => onDimensionStep("height", -10)}
                className="absolute -bottom-5 left-0 right-0 h-5 flex items-center justify-center text-(--text-tertiary) hover:text-(--text-primary) opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Minus size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* 预览容器 */}
        <div
          className="relative transition-all duration-300 shrink-0"
          style={{ width: actualWidth, height: actualHeight }}
        >
          <div
            className={`w-full h-full flex flex-col p-4 transition-colors overflow-hidden
              ${
                config.darkMode
                  ? "bg-[#151B24] text-white"
                  : "bg-white text-gray-900"
              }
              ${
                config.border
                  ? "rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl"
                  : "rounded-2xl shadow-md"
              }
            `}
          >
            {/* 卡片 Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ProxyImage
                  src={market.icon || ""}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span className="text-xs font-semibold opacity-70">YesONo</span>
              </div>
              <span className="text-xs font-medium opacity-70 flex items-center hover:opacity-100 cursor-pointer">
                View Market{" "}
                <ChevronLeft size={12} className="rotate-180 ml-0.5" />
              </span>
            </div>

            <div className="flex gap-3 flex-1 min-h-0">
              {!isSports && (
                <ProxyImage
                  src={previewMarket.icon || ""}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="flex-1 flex flex-col min-w-0">
                <h3
                  className={`font-bold leading-tight ${
                    isSports ? "text-base mb-1" : "text-lg mb-2"
                  } line-clamp-2`}
                >
                  {previewMarket.title}
                </h3>

                {/* Chart 区域 */}
                {config.chart && (
                  <div className="flex-1 relative mt-2 min-h-[60px]">
                    {formattedChartData && formattedChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={formattedChartData}
                          margin={{
                            top: 15,
                            right: config.yAxis ? 40 : 30,
                            left: 0,
                            bottom: 5,
                          }}
                        >
                          {config.gridRows && (
                            <CartesianGrid
                              vertical={false}
                              stroke={config.darkMode ? "#333" : "#e5e7eb"}
                              strokeDasharray="3 3"
                            />
                          )}
                          <XAxis
                            dataKey="timestamp"
                            type="number"
                            domain={["dataMin", "dataMax"]}
                            hide
                          />
                          {config.yAxis && (
                            <YAxis
                              domain={[0, 100]}
                              orientation="right"
                              tick={{
                                fontSize: 10,
                                fill: config.darkMode ? "#6b7280" : "#9ca3af",
                              }}
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(v) => `${v}%`}
                              width={30}
                            />
                          )}
                          <Tooltip
                            content={
                              <CustomTooltip
                                lines={lines}
                                darkMode={config.darkMode}
                              />
                            }
                            cursor={{
                              stroke: config.darkMode ? "#4b5563" : "#9ca3af",
                              strokeDasharray: "3 3",
                            }}
                            isAnimationActive={false}
                            wrapperStyle={{
                              zIndex: 100,
                              pointerEvents: "none",
                            }}
                          />
                          {lines.map((line) => (
                            <Line
                              key={line.id}
                              type="stepAfter"
                              dataKey={line.id}
                              stroke={line.color}
                              strokeWidth={2}
                              isAnimationActive={false}
                              activeDot={{ r: 4, strokeWidth: 0 }}
                              dot={(props: any) => {
                                const { cx, cy, index } = props;
                                if (index === formattedChartData.length - 1) {
                                  return (
                                    <g key={`dot-${line.id}-${index}`}>
                                      <circle
                                        cx={cx}
                                        cy={cy}
                                        r={4}
                                        fill={line.color}
                                      />
                                      <text
                                        x={cx + 8}
                                        y={cy + 4}
                                        fill={line.color}
                                        fontSize={14}
                                        fontWeight="bold"
                                      >
                                        {line.price}%
                                      </text>
                                    </g>
                                  );
                                }
                                return (
                                  <circle
                                    key={`dot-${line.id}-${index}`}
                                    cx={cx}
                                    cy={cy}
                                    r={0}
                                    fill="none"
                                    pointerEvents="none"
                                  />
                                );
                              }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-(--text-tertiary)">
                        Loading chart...
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Sports 特有的右侧胜率显示 */}
              {isSports && config.chart && (
                <div className="flex flex-col gap-2 items-end justify-start font-bold pt-1">
                  {lines.map((line) => (
                    <span key={line.id} style={{ color: line.color }}>
                      {line.price}%
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Volume 区域 */}
            {config.volume && (
              <div className="flex items-center justify-between text-[10px] opacity-60 mt-3 font-medium shrink-0">
                <span>
                  ${Number(previewMarket.volume || 0).toLocaleString()} Vol.
                </span>
                <span className="flex items-center cursor-pointer hover:opacity-100">
                  All time <ChevronDown size={12} className="ml-0.5" />
                </span>
              </div>
            )}

            {/* Buy Buttons */}
            {config.buyButtons && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-current border-opacity-10 shrink-0">
                {isSports ? (
                  lines.map((line) => (
                    <button
                      key={line.id}
                      className="flex-1 py-2 rounded-lg font-semibold text-sm transition-colors flex justify-center gap-2 text-white"
                      style={{ backgroundColor: line.color }}
                    >
                      <span className="truncate max-w-[80px]">
                        {line.label}
                      </span>
                      <span>{line.price}¢</span>
                    </button>
                  ))
                ) : (
                  <>
                    <button className="flex-1 py-2 rounded-lg bg-[#22c55e]/10 hover:bg-[#22c55e]/20 text-[#22c55e] font-semibold text-sm transition-colors flex justify-center gap-2">
                      <span>Yes</span>
                      <span>{lines[0]?.price}¢</span>
                    </button>
                    <button className="flex-1 py-2 rounded-lg bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] font-semibold text-sm transition-colors flex justify-center gap-2">
                      <span>No</span>
                      <span>{100 - Number(lines[0]?.price)}¢</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 调节器：宽度（底部） */}
      <div
        className="relative mt-6 flex justify-center w-full max-w-full"
        style={{ width: actualWidth }}
      >
        <div className="absolute top-0 left-0 right-0 h-px bg-(--border) opacity-50" />
        <div className="absolute top-[-14px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          <div className="group relative bg-(--bg-card) border border-(--border) rounded-md shadow-sm z-10 hover:border-(--text-tertiary) transition-colors">
            <button
              onClick={() => onDimensionStep("width", -10)}
              className="absolute top-0 bottom-0 -left-5 w-5 flex items-center justify-center text-(--text-tertiary) hover:text-(--text-primary) opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Minus size={12} />
            </button>
            <input
              type="number"
              value={dimensions.width}
              onChange={(e) => onDimensionInput("width", e.target.value)}
              className="w-12 h-7 bg-transparent text-center text-xs focus:outline-hidden appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => onDimensionStep("width", 10)}
              className="absolute top-0 bottom-0 -right-5 w-5 flex items-center justify-center text-(--text-tertiary) hover:text-(--text-primary) opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Plus size={12} />
            </button>
          </div>
          <span className="text-[10px] text-(--text-tertiary) font-mono font-bold">
            W
          </span>
        </div>
      </div>
    </div>
  );
};

export default EmbedPreviewCard;
