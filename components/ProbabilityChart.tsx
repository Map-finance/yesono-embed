'use client';

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

/**
 * 数据点类型
 * 每个数据点包含日期和各个系列的值
 */
export interface DataPoint {
  date: string;
  spain: number;
  england: number;
  france: number;
  argentina: number;
}

/**
 * 时间范围类型
 */
export type TimeRange = '1D' | '1W' | '1M' | 'ALL';

/**
 * 颜色配置
 * 可以根据需要修改各个系列的颜色
 */
const colors = {
  spain: '#ED6432',      // 橙色 (rgb(237, 100, 50))
  england: '#BBE124',    // 黄绿色 (rgb(187, 225, 36))
  france: '#7134F7',     // 紫色 (rgb(113, 52, 247))
  argentina: '#FFEC20',  // 黄色 (rgb(255, 236, 32))
};

/**
 * 系列配置
 * 定义图表中显示的各个系列及其对应的数据键和颜色
 */
const seriesConfig = [
  { key: 'spain', label: 'Spain', color: colors.spain },
  { key: 'england', label: 'England', color: colors.england },
  { key: 'france', label: 'France', color: colors.france },
  { key: 'argentina', label: 'Argentina', color: colors.argentina },
] as const;

/**
 * 图表配置接口
 */
export interface ProbabilityChartProps {
  /** 图表数据数组 */
  data: DataPoint[];
  /** 当前选中的时间范围 */
  timeRange: TimeRange;
  /** 时间范围改变时的回调函数 */
  onTimeRangeChange?: (range: TimeRange) => void;
  /** 自定义类名 */
  className?: string;
  /** 是否显示加载状态 */
  loading?: boolean;
  /** 错误信息 */
  error?: string | null;
  /** 图表高度（像素） */
  height?: number;
  /** Y轴显示范围，可以是固定值 [min, max] 或动态范围 ['dataMin - offset', 'dataMax + offset'] */
  yAxisDomain?: [number, number] | [string, string];
  /** 图表边距配置 { top, right, bottom, left } */
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
}

/**
 * 概率图表组件
 * 
 * 一个可复用的多系列折线图组件，用于显示概率预测数据
 * 
 * @example
 * ```tsx
 * <ProbabilityChart
 *   data={chartData}
 *   timeRange="1W"
 *   onTimeRangeChange={(range) => setTimeRange(range)}
 *   loading={isLoading}
 *   error={errorMessage}
 * />
 * ```
 */
const ProbabilityChart: React.FC<ProbabilityChartProps> = ({
  data,
  timeRange,
  onTimeRangeChange,
  className,
  loading = false,
  error = null,
  height = 312,
  yAxisDomain = ['dataMin - 3', 'dataMax + 3'],
  margin = { top: 10, right: 20, left: 0, bottom: 20 },
}) => {
  // 计算当前百分比（使用最后一个数据点）
  const currentPercentages = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        spain: '0.0',
        england: '0.0',
        france: '0.0',
        argentina: '0.0',
      };
    }

    const last = data[data.length - 1];
    if (!last) {
      return {
        spain: '0.0',
        england: '0.0',
        france: '0.0',
        argentina: '0.0',
      };
    }

    return {
      spain: (last.spain || 0).toFixed(1),
      england: (last.england || 0).toFixed(1),
      france: (last.france || 0).toFixed(1),
      argentina: (last.argentina || 0).toFixed(1),
    };
  }, [data]);

  // 自定义工具提示组件
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 shadow-lg">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-white text-sm">
                {entry.name}: {entry.value.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // 自定义图例组件
  const CustomLegend = () => (
    <div className="flex flex-wrap items-center gap-4 mb-4" style={{ fontFamily: 'Manrope, sans-serif' }}>
      {seriesConfig.map((series) => (
        <div key={series.key} className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: series.color }} />
          <span className="text-white text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {series.label}
          </span>
          <span className="text-[#b0b0b0] text-sm" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {currentPercentages[series.key as keyof typeof currentPercentages]}%
          </span>
        </div>
      ))}
      <a
        href="#"
        className="flex items-center gap-1 text-[#b0b0b0] text-sm hover:text-white transition-colors ml-auto"
        onClick={(e) => e.preventDefault()}
        style={{ fontFamily: 'Manrope, sans-serif' }}
      >
        View NO
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-normal [--icon-color:var(--color-gray-3)] group-hover:[--icon-color:var(--color-white)]" data-sentry-element="Icon" data-sentry-source-file="SwitchSymbol.tsx" ><path d="M14 10.6667V14M14 14H10.6667M14 14L10 10M2 2L6 6M10.6667 2H14M14 2V5.33333M14 2L2 14" stroke="var(--icon-color, #f1edeb)" stroke-linecap="round" stroke-linejoin="round"></path></svg>      </a>
    </div>
  );

  // 创建最后一个数据点的 dot 渲染函数
  const createLastDot = (color: string) => {
    const LastDot = (props: any) => {
      const { cx, cy, index } = props;
      // 只显示最后一个数据点
      if (data && data.length > 0 && index === data.length - 1) {
        return (
          <circle
            cx={cx}
            cy={cy}
            r={5}
            fill={color}
          />
        );
      }
      return null;
    };
    LastDot.displayName = `LastDot(${color})`;
    return LastDot;
  };

  return (
    <div className={`bg-[#111111] rounded-lg p-6 ${className || ''}`}>
      {/* 图例 */}
      <CustomLegend />

      {/* 时间范围选择按钮 */}
      {onTimeRangeChange && (
        <div className="flex gap-1 mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {(['1D', '1W', '1M', 'ALL'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => onTimeRangeChange(range)}
              className={`h-7 px-3 rounded-full text-sm font-normal transition-all ${
                timeRange === range
                  ? 'bg-[#ED6432] text-[#030303]'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              style={{
                transition: '0.15s cubic-bezier(0, 0, 0.2, 1)',
                fontFamily: 'Manrope, sans-serif',
              }}
            >
              {range}
            </button>
          ))}
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
          <div className="text-white/60 text-sm">Loading chart data...</div>
        </div>
      )}

      {/* 错误状态 */}
      {error && !loading && (
        <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
          <div className="text-red-400 text-sm">Error: {error}</div>
        </div>
      )}

      {/* 空数据状态 */}
      {!loading && !error && (!data || data.length === 0) && (
        <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
          <div className="text-white/60 text-sm">No data available</div>
        </div>
      )}

      {/* 图表容器 */}
      {!loading && !error && data && data.length > 0 && (
        <div className="relative" style={{ height: `${height}px` }}>
          {/* 
            CSS 样式：为折线和数据点添加发光阴影效果
            可以通过修改 drop-shadow 的参数来调整阴影大小和强度
            drop-shadow(rgb(r, g, b) x-offset y-offset blur-radius)
          */}
          <style dangerouslySetInnerHTML={{
            __html: `
              /* Spain - 橙色线条阴影 */
              path[stroke="#ED6432"],
              .recharts-curve[stroke="#ED6432"],
              .recharts-line[stroke="#ED6432"] {
                filter: drop-shadow(rgb(237, 100, 50) 0px 0px 8px) drop-shadow(rgb(237, 100, 50) 0px 0px 4px) !important;
              }
              /* England - 黄绿色线条阴影 */
              path[stroke="#BBE124"],
              .recharts-curve[stroke="#BBE124"],
              .recharts-line[stroke="#BBE124"] {
                filter: drop-shadow(rgb(187, 225, 36) 0px 0px 8px) drop-shadow(rgb(187, 225, 36) 0px 0px 4px) !important;
              }
              /* France - 紫色线条阴影 */
              path[stroke="#7134F7"],
              .recharts-curve[stroke="#7134F7"],
              .recharts-line[stroke="#7134F7"] {
                filter: drop-shadow(rgb(113, 52, 247) 0px 0px 8px) drop-shadow(rgb(113, 52, 247) 0px 0px 4px) !important;
              }
              /* Argentina - 黄色线条阴影 */
              path[stroke="#FFEC20"],
              .recharts-curve[stroke="#FFEC20"],
              .recharts-line[stroke="#FFEC20"] {
                filter: drop-shadow(rgb(255, 236, 32) 0px 0px 8px) drop-shadow(rgb(255, 236, 32) 0px 0px 4px) !important;
              }
              /* 数据点阴影效果 */
              circle[fill="#ED6432"] {
                filter: drop-shadow(rgb(237, 100, 50) 0px 0px 8px) drop-shadow(rgb(237, 100, 50) 0px 0px 4px) !important;
              }
              circle[fill="#BBE124"] {
                filter: drop-shadow(rgb(187, 225, 36) 0px 0px 8px) drop-shadow(rgb(187, 225, 36) 0px 0px 4px) !important;
              }
              circle[fill="#7134F7"] {
                filter: drop-shadow(rgb(113, 52, 247) 0px 0px 8px) drop-shadow(rgb(113, 52, 247) 0px 0px 4px) !important;
              }
              circle[fill="#FFEC20"] {
                filter: drop-shadow(rgb(255, 236, 32) 0px 0px 8px) drop-shadow(rgb(255, 236, 32) 0px 0px 4px) !important;
              }
            `
          }} />
          
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              // 图表边距配置
              // top: 顶部边距，用于显示图例或标题
              // right: 右侧边距，用于显示最后一个数据点
              // bottom: 底部边距，用于显示 X 轴标签
              // left: 左侧边距，用于显示 Y 轴（当前隐藏）
              margin={margin}
            >
              {/* 网格线配置 */}
              <CartesianGrid
                stroke="rgba(255, 255, 255, 0.06)"  // 网格线颜色和透明度
                vertical={false}                     // 不显示垂直网格线
              />

              {/* X 轴配置 */}
              <XAxis
                dataKey="date"                      // 使用 date 字段作为 X 轴数据
                stroke="transparent"                 // 隐藏轴线
                tick={{ 
                  fill: 'rgb(167, 167, 167)',       // 刻度标签颜色
                  fontSize: 12,                     // 字体大小
                  fontFamily: 'Manrope, sans-serif', // 字体族
                }}
                axisLine={{ stroke: 'transparent' }} // 隐藏轴线
                interval="preserveStartEnd"          // 保留首尾刻度
                minTickGap={30}                      // 最小刻度间距（像素）
              />

              {/* Y 轴配置 */}
              <YAxis
                hide                                 // 隐藏 Y 轴（不显示轴线和标签）
                // Y 轴显示范围
                // 可以使用固定值：[min, max]
                // 或动态值：['dataMin - offset', 'dataMax + offset']
                // 例如：[0, 25] 或 ['dataMin - 3', 'dataMax + 3']
                domain={yAxisDomain}
              />

              {/* 工具提示配置 */}
              <Tooltip content={<CustomTooltip />} />

              {/* 折线系列配置 */}
              {/* type="stepAfter" 表示阶梯线，水平段后垂直跳转 */}
              {/* 可选值：'basis' | 'basisClosed' | 'basisOpen' | 'linear' | 'linearClosed' | 'natural' | 'monotoneX' | 'monotoneY' | 'monotone' | 'step' | 'stepBefore' | 'stepAfter' */}
              {seriesConfig.map((series) => (
                <Line
                  key={series.key}
                  type="stepAfter"                  // 折线类型：阶梯线（水平后垂直）
                  dataKey={series.key}               // 数据键名
                  stroke={series.color}             // 线条颜色
                  strokeWidth={1}                    // 线条宽度（像素）
                  dot={createLastDot(series.color)}  // 自定义数据点：只显示最后一个
                  activeDot={{                      // 激活状态的数据点样式
                    r: 6,                            // 半径
                    fill: series.color,              // 填充颜色
                  }}
                  connectNulls                       // 连接空值点
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          {/* OPINION 水印 */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 opacity-30 pointer-events-none">
            <div className="w-4 h-4 border border-white/30 grid grid-cols-2 gap-0.5 p-0.5">
              <div className="bg-white/30" />
              <div className="bg-transparent" />
              <div className="bg-transparent" />
              <div className="bg-white/30" />
            </div>
            <span className="text-white/30 text-xs font-medium">OPINION</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProbabilityChart;
