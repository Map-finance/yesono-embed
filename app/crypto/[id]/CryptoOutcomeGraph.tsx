"use client";

/**
 * CryptoOutcomeGraph - Crypto 详情页单个 outcome 展开后的价格走势图 + 设置弹窗。
 * 从 app/crypto/[id]/page.tsx 拆出，机械搬运无修改。
 */

import React, { useState, useMemo } from "react";
import { Settings } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslation, useLocale } from "@/lib/i18n";
import { formatDate } from "@/utils/format";

// ========== Graph 相关 ==========
// 使用种子生成伪随机数
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

type TimeRange = "1D" | "1W" | "1M" | "ALL";
const timeRanges: TimeRange[] = ["1D", "1W", "1M", "ALL"];

// 生成图表数据
const generateGraphData = (
  percentage: number,
  range: TimeRange,
  locale: string = "en-US"
) => {
  const data: { date: string; value: number }[] = [];
  const now = new Date();

  let points: number;
  let getDate: (i: number) => Date;
  let fmtOpts: Intl.DateTimeFormatOptions = {};

  switch (range) {
    case "1D":
      points = 48;
      getDate = (i) => new Date(now.getTime() - (points - i) * 30 * 60 * 1000);
      fmtOpts = { hour: "numeric", minute: "2-digit", hour12: true };
      break;
    case "1W":
      points = 84;
      getDate = (i) =>
        new Date(now.getTime() - (points - i) * 2 * 60 * 60 * 1000);
      fmtOpts = { month: "short", day: "numeric" };
      break;
    case "1M":
      points = 60;
      getDate = (i) =>
        new Date(now.getTime() - (points - i) * 12 * 60 * 60 * 1000);
      fmtOpts = { month: "short", day: "numeric" };
      break;
    case "ALL":
      points = 90;
      getDate = (i) =>
        new Date(now.getTime() - (points - i) * 24 * 60 * 60 * 1000);
      fmtOpts = { month: "short", year: "numeric" };
      break;
  }

  for (let i = 0; i < points; i++) {
    const date = getDate(i);
    const seed = percentage * 100 + i + range.charCodeAt(0);
    const trend = Math.sin(i * 0.08) * 8;
    const noise = seededRandom(seed) * 6 - 3;
    data.push({
      date: formatDate(date, locale === "zh" ? "zh-CN" : "en-US", fmtOpts),
      value: Math.max(1, Math.min(99, percentage + trend + noise)),
    });
  }

  return data;
};

// Outcome Graph 组件
interface OutcomeGraphProps {
  percentage: number;
  change?: number;
  label?: string;
}

const OutcomeGraph: React.FC<OutcomeGraphProps> = ({
  percentage,
  change,
  label,
}) => {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const [selectedRange, setSelectedRange] = useState<TimeRange>("1W");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState({
    autoscale: true,
    xAxis: true,
    yAxis: true,
    horizontalGrid: true,
    verticalGrid: false,
    annotations: true,
  });

  // 生成图表数据
  const chartData = useMemo(
    () =>
      generateGraphData(
        percentage,
        selectedRange,
        locale === "zh-CN" || locale === "zh-TW" ? "zh-CN" : "en-US"
      ),
    [percentage, selectedRange, locale]
  );

  // 计算当前百分比
  const currentValue = useMemo(() => {
    if (!chartData || chartData.length === 0) return percentage;
    return chartData[chartData.length - 1].value;
  }, [chartData, percentage]);

  // 自定义工具提示
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ED6432]" />
            <span className="text-white text-sm">
              {label || t.market.chart.valueLabel}:{" "}
              {payload[0].value.toFixed(1)}%
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  // 创建最后一个数据点的 dot 渲染函数
  const createLastDot = (props: any) => {
    const { cx, cy, index } = props;
    if (chartData && chartData.length > 0 && index === chartData.length - 1) {
      return <circle cx={cx} cy={cy} r={5} fill="#ED6432" />;
    }
    return null;
  };

  // 发光效果 CSS
  const glowStyles = `
    path[stroke="#ED6432"] { filter: drop-shadow(rgb(237, 100, 50) 0px 0px 8px) drop-shadow(rgb(237, 100, 50) 0px 0px 4px) !important; }
    circle[fill="#ED6432"] { filter: drop-shadow(rgb(237, 100, 50) 0px 0px 8px) drop-shadow(rgb(237, 100, 50) 0px 0px 4px) !important; }
  `;

  return (
    <div className="relative bg-[#111111] rounded-lg p-4">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full bg-[#ED6432]" />
        <span className="text-white text-sm">{label || t.market.outcome}</span>
        <span className="text-[#b0b0b0] text-sm">
          {currentValue.toFixed(1)}%
        </span>
        {change !== undefined && (
          <span
            className={`text-sm ${
              change >= 0 ? "text-(--green)" : "text-(--red)"
            }`}
          >
            {change >= 0 ? "▲" : "▼"}
            {Math.abs(change)}%
          </span>
        )}
      </div>

      {/* 时间范围选择器 */}
      <div className="flex gap-1 mb-4">
        {timeRanges.map((range) => (
          <button
            key={range}
            onClick={() => setSelectedRange(range)}
            className={`h-7 px-3 rounded-full text-sm font-normal transition-all ${
              selectedRange === range
                ? "bg-[#ED6432] text-[#030303]"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {range}
          </button>
        ))}
      </div>

      {/* 图表 */}
      <div className="relative" style={{ height: "180px" }}>
        <style dangerouslySetInnerHTML={{ __html: glowStyles }} />

        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
          >
            <CartesianGrid
              stroke="rgba(255, 255, 255, 0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke="transparent"
              tick={{ fill: "rgb(167, 167, 167)", fontSize: 12 }}
              axisLine={{ stroke: "transparent" }}
              interval="preserveStartEnd"
              minTickGap={50}
            />
            <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="stepAfter"
              dataKey="value"
              stroke="#ED6432"
              strokeWidth={1.5}
              dot={createLastDot}
              activeDot={{ r: 6, fill: "#ED6432" }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 底部工具栏 */}
      <div className="flex items-center justify-end mt-2 pt-2 border-t border-[rgba(255,255,255,0.1)]">
        <div className="flex gap-1">
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 rounded hover:bg-white/10 text-[#b0b0b0]"
            title={t.market.common.settings}
          >
            <Settings size={14} />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSettingsOpen(false)}
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
                    setSettings((prev) => ({
                      ...prev,
                      [item.key]: !prev[item.key as keyof typeof prev],
                    }))
                  }
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    settings[item.key as keyof typeof settings]
                      ? "bg-[#3b82f6]"
                      : "bg-(--bg-secondary)"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                      settings[item.key as keyof typeof settings]
                        ? "left-5"
                        : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OutcomeGraph;
