import React, { useState, useMemo } from "react";
import { X, ChevronDown, Copy, Code, ChevronLeft, Plus, Minus, Check } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Market } from "@/types/types";
import { PolymarketMarketResp } from "@/types/home";
import { Switch } from "@/components/ui/Switch";
import ProxyImage from "@/components/common/ProxyImage";
import { usePriceHistory } from "@/lib/hooks/usePriceHistory";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";

interface EmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  market: Market;
  eventMarkets?: PolymarketMarketResp[];
  isSports?: boolean;
}

const colors = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6"];

export default function EmbedModal({
  isOpen,
  onClose,
  market,
  eventMarkets,
  isSports,
}: EmbedModalProps) {
  const { t } = useTranslation();

  const [viewMode, setViewMode] = useState<"preview" | "code">("preview");
  const [copied, setCopied] = useState(false);

  const [selectedMarketId, setSelectedMarketId] = useState<string>(
    eventMarkets && eventMarkets.length > 0 ? String(eventMarkets[0].id) : String(market.id)
  );
  const [config, setConfig] = useState({
    chart: true,
    buyButtons: true,
    volume: true,
    yAxis: true,
    gridRows: true,
    border: false,
    darkMode: false,
  });

  const [dimensions, setDimensions] = useState<{ width: number | string, height: number | string }>({ width: 400, height: 300 });

  // 动态获取当前预览的 Market
  const previewMarket = useMemo(() => {
    const selected = eventMarkets?.find(m => String(m.id) === String(selectedMarketId));
    if (selected) {
      return {
        ...market,
        id: selected.id,
        title: selected.groupItemTitle || selected.question || market.title,
        volume: selected.volume || market.volume,
        options: selected.marketOutcomes?.map((o: any) => ({
          label: o.outcome || o.title || o.groupItemTitle || "Yes",
          percentage: o.price || 0
        })) || market.options,
      };
    }
    return market;
  }, [selectedMarketId, market, eventMarkets]);

  // 根据当前预览的 Market 获取数据
  const targetMarketIds = useMemo(() => {
    if (isSports && eventMarkets) {
      return eventMarkets.map(m => String(m.id));
    }
    return [String(previewMarket.id)];
  }, [previewMarket.id, isSports, eventMarkets]);

  const { data: chartData, currentPrices } = usePriceHistory(targetMarketIds, "ALL", isOpen);

  // 整理展示的图表线和最新值
  const lines = useMemo(() => {
    if (isSports && eventMarkets) {
      return eventMarkets.map((m, i) => {
        const val = currentPrices[m.id] !== undefined ? currentPrices[m.id].toFixed(0) : (m.marketOutcomes?.[0]?.price || 0);
        return {
          id: m.id,
          color: colors[i % colors.length],
          label: m.marketOutcomes?.[0]?.outcome || m.groupItemTitle || "Team",
          price: val
        }
      });
    }

    const val = currentPrices[previewMarket.id] !== undefined ? currentPrices[previewMarket.id] : (previewMarket.options[0]?.percentage || 0);
    return [{
      id: previewMarket.id,
      color: colors[0],
      label: previewMarket.options[0]?.label || "Yes",
      price: Math.round(Number(val))
    }];
  }, [isSports, eventMarkets, previewMarket, currentPrices]);

  // 处理 M1 下 No 线的 mock 数据
  const formattedChartData = useMemo(() => {
    if (!chartData) return [];
    if (isSports) return chartData;

    return chartData.map(point => {
      const newPoint = { ...point };
      const yesVal = point[previewMarket.id];
      if (typeof yesVal === 'number') {
        newPoint[`no_${previewMarket.id}`] = 100 - yesVal;
      }
      return newPoint;
    });
  }, [chartData, isSports, previewMarket.id]);

  if (!isOpen) return null;

  const handleConfigChange = (key: keyof typeof config) => {
    setConfig((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDimensionChange = (key: "width" | "height", delta: number) => {
    setDimensions((prev) => ({ ...prev, [key]: Math.max(200, Number(prev[key]) + delta) }));
  };

  const handleInputChange = (key: "width" | "height", val: string) => {
    setDimensions(prev => ({ ...prev, [key]: val === "" ? "" : Number(val) }));
  };

  const actualWidth = Number(dimensions.width) || 400;
  const actualHeight = Number(dimensions.height) || 300;

  // 使用当前站点域名
  const siteOrigin = typeof window !== "undefined" ? window.location.origin : "https://yesono.com";
  const marketSlug = market.slug || market.id;
  const marketUrl = `${siteOrigin}/market/${marketSlug}`;

  const embedSrc = `${siteOrigin}/embed/${marketSlug}?chart=${config.chart}&buy=${config.buyButtons}&vol=${config.volume}&theme=${config.darkMode ? 'dark' : 'light'}&border=${config.border}`;

  const yesPrice = lines[0]?.price ?? 0;
  const noPrice = lines.length <= 2 ? 100 - Number(yesPrice) : 0;

  const generatedCode = `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "${previewMarket.title.replace(/"/g, '\\"')}",
  "description": "Prediction market: Yes ${yesPrice}%${noPrice ? ` · No ${noPrice}%` : ''} on YesONo.",
  "url": "${marketUrl}",
  "publisher": {
    "@type": "Organization",
    "name": "YesONo",
    "url": "${siteOrigin}"
  }
}
</script>
<figure
    class="yesono-embed"
    id="yesono-${marketSlug}"
    aria-label="YesONo prediction market: ${previewMarket.title.replace(/"/g, '\\"')}"
    itemscope
    itemtype="https://schema.org/WebPage"
    style="position:relative;display:inline-block;margin:0">
    <iframe
        title="${previewMarket.title.replace(/"/g, '\\"')} — YesONo Prediction Market"
        src="${embedSrc}"
        width="${actualWidth}"
        height="${actualHeight}"
        frameborder="0"
        style="border-radius:16px;overflow:hidden"
        allowtransparency="true">
    </iframe>
    <a href="${marketUrl}"
        aria-label="View on YesONo"
        target="_blank"
        rel="noopener noreferrer"
        style="position:absolute;top:16px;right:20px;width:120px;height:24px;z-index:10">
    </a>
    <figcaption style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">
        <strong>${previewMarket.title}</strong><br>
        Yes ${yesPrice}%${noPrice ? ` · No ${noPrice}%` : ''}<br>
        <a href="${marketUrl}">
            View full market &amp; trade on YesONo
        </a>
    </figcaption>
</figure>`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('[EmbedModal] Clipboard copy failed, falling back to textarea copy', e);
      const textarea = document.createElement("textarea");
      textarea.value = generatedCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const renderHighlightedCodeLine = (line: string, lineIndex: number) => {
    const nodes: React.ReactNode[] = [];
    const tokenRegex = /(<\/?\w+|[\w-]+=|"[^"]*"|'[^']*')/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        nodes.push(
          <span key={`${lineIndex}-text-${lastIndex}`}>{line.slice(lastIndex, match.index)}</span>
        );
      }

      const token = match[0];
      let className = "text-[#c9d1d9]";

      if (/^<\/?\w+$/.test(token)) {
        className = "text-[#ff7b72]";
      } else if (/^[\w-]+=$/.test(token)) {
        className = "text-[#79c0ff]";
      } else if (/^["'].*["']$/.test(token)) {
        className = "text-[#a5d6ff]";
      }

      nodes.push(
        <span key={`${lineIndex}-token-${match.index}`} className={className}>
          {token}
        </span>
      );

      lastIndex = match.index + token.length;
    }

    if (lastIndex < line.length) {
      nodes.push(
        <span key={`${lineIndex}-text-${lastIndex}`}>{line.slice(lastIndex)}</span>
      );
    }

    return nodes;
  };

  // 自定义 Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dateStr = label ? new Date(label).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
      }) : '';

      return (
        <div className={`p-2 border rounded-lg shadow-lg text-xs min-w-[120px] ${
          config.darkMode
            ? 'bg-[#1a1f2e] border-gray-700 text-gray-200'
            : 'bg-white border-gray-200 text-gray-800'
        }`}>
          {dateStr && <div className="mb-2 pb-1 border-b border-gray-500/30 text-gray-500">{dateStr}</div>}
          {payload.map((entry: any, index: number) => {
            const lineConfig = lines.find(l => l.id === entry.dataKey);
            const title = lineConfig?.label || entry.dataKey;
            const color = lineConfig?.color || entry.color;
            const val = entry.value !== undefined && entry.value !== null ? Math.round(Number(entry.value)) : '-';
            return (
              <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-medium truncate max-w-[80px]">{title}</span>
                </div>
                <span className="font-bold">{val}%</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className="fixed inset-0 z-[101] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-card)] rounded-2xl w-[900px] max-w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Embed</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel */}
          <div className="w-[260px] flex-shrink-0 border-r border-[var(--border)] px-6 pb-6 overflow-y-auto flex flex-col">
            {viewMode === "preview" ? (
              <>
                {!isSports && eventMarkets && eventMarkets.length > 1 && (
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm text-[var(--text-primary)] font-medium">Market</span>
                    <div className="relative">
                      <select
                        className="appearance-none bg-transparent border border-[var(--border)] rounded-lg pl-3 pr-7 py-1.5 text-xs font-medium focus:outline-none focus:border-[var(--text-primary)] max-w-[120px]"
                        value={selectedMarketId}
                        onChange={(e) => setSelectedMarketId(e.target.value)}
                      >
                        <option value={market.id}>Current</option>
                        {eventMarkets?.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.groupItemTitle || m.question || m.id}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] pointer-events-none" />
                    </div>
                  </div>
                )}

                <div className="space-y-4 flex-1">
                  {[
                    { key: "chart" as const, label: "Chart" },
                    { key: "buyButtons" as const, label: "Buy buttons" },
                    { key: "volume" as const, label: "Volume" },
                    { key: "yAxis" as const, label: "Y Axis" },
                    { key: "gridRows" as const, label: "Grid rows" },
                    { key: "border" as const, label: "Border" },
                    { key: "darkMode" as const, label: "Dark mode" },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-[var(--text-primary)] font-medium">{label}</span>
                      <Switch checked={config[key]} onCheckedChange={() => handleConfigChange(key)} />
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--border)]">
                  <button
                    onClick={() => setViewMode("code")}
                    className="w-full flex items-center justify-center gap-2 bg-[var(--accent)] hover:opacity-90 text-[var(--text-inverse)] py-3 rounded-xl font-semibold transition-opacity"
                  >
                    <Code size={18} />
                    View Code
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-[var(--text-primary)] font-medium">Dimensions</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div>
                    <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Width</label>
                    <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden">
                      <button onClick={() => handleDimensionChange("width", -10)} className="px-2 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"><Minus size={12}/></button>
                      <input
                        type="number"
                        value={dimensions.width}
                        onChange={(e) => handleInputChange("width", e.target.value)}
                        className="w-full bg-transparent text-center text-sm py-1.5 focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button onClick={() => handleDimensionChange("width", 10)} className="px-2 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"><Plus size={12}/></button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-tertiary)] mb-1 block">Height</label>
                    <div className="flex items-center border border-[var(--border)] rounded-lg overflow-hidden">
                      <button onClick={() => handleDimensionChange("height", -10)} className="px-2 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"><Minus size={12}/></button>
                      <input
                        type="number"
                        value={dimensions.height}
                        onChange={(e) => handleInputChange("height", e.target.value)}
                        className="w-full bg-transparent text-center text-sm py-1.5 focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button onClick={() => handleDimensionChange("height", 10)} className="px-2 py-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"><Plus size={12}/></button>
                    </div>
                  </div>
                </div>

                <div className="flex-1" />

                <div className="mt-6 pt-4 border-t border-[var(--border)] flex gap-3">
                  <button
                    onClick={() => setViewMode("preview")}
                    className="flex-shrink-0 flex items-center justify-center bg-transparent border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] px-4 py-3 rounded-xl font-semibold transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={handleCopy}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${
                      copied
                        ? "bg-green-600 text-white"
                        : "bg-[var(--accent)] hover:opacity-90 text-[var(--text-inverse)]"
                    }`}
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? "Copied!" : "Copy Code"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Right Panel */}
          <div className="flex-1 bg-[var(--bg-secondary)] flex items-center justify-center p-10 relative overflow-auto">
            {viewMode === "preview" ? (
              <div className="relative flex flex-col items-center justify-center">
                {/* 包含了高度控制线和卡片的水平容器 */}
                <div className="relative flex items-center">
                  {/* 调节器：高度（左侧） */}
                  <div className="absolute right-[100%] top-0 bottom-0 mr-6 flex items-center">
                    <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-[var(--border)] opacity-50" />
                    <div className="absolute right-[-14px] top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <span className="text-[10px] text-[var(--text-tertiary)] font-mono font-bold">H</span>
                      <div className="group relative bg-[var(--bg-card)] border border-[var(--border)] rounded-md shadow-sm z-10 hover:border-[var(--text-tertiary)] transition-colors">
                        <button onClick={() => handleDimensionChange("height", 10)} className="absolute -top-5 left-0 right-0 h-5 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={12}/></button>
                        <input
                          type="number"
                          value={dimensions.height}
                          onChange={(e) => handleInputChange("height", e.target.value)}
                          className="w-10 h-7 bg-transparent text-center text-xs focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button onClick={() => handleDimensionChange("height", -10)} className="absolute -bottom-5 left-0 right-0 h-5 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity"><Minus size={12}/></button>
                      </div>
                    </div>
                  </div>

                  {/* 预览容器 */}
                  <div
                    className="relative transition-all duration-300 flex-shrink-0"
                    style={{ width: actualWidth, height: actualHeight }}
                  >
                    <div
                      className={`w-full h-full flex flex-col p-4 transition-colors overflow-hidden
                        ${config.darkMode ? 'bg-[#151B24] text-white' : 'bg-white text-gray-900'}
                        ${config.border ? 'rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl' : 'rounded-2xl shadow-md'}
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
                          View Market <ChevronLeft size={12} className="rotate-180 ml-0.5" />
                        </span>
                      </div>

                      <div className="flex gap-3 flex-1 min-h-0">
                        {!isSports && (
                          <ProxyImage
                            src={previewMarket.icon || ""}
                            alt=""
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 flex flex-col min-w-0">
                          <h3 className={`font-bold leading-tight ${isSports ? 'text-base mb-1' : 'text-lg mb-2'} line-clamp-2`}>
                            {previewMarket.title}
                          </h3>

                          {/* Chart 区域 */}
                          {config.chart && (
                            <div className="flex-1 relative mt-2 min-h-[60px]">
                              {formattedChartData && formattedChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={formattedChartData} margin={{ top: 15, right: config.yAxis ? 40 : 30, left: 0, bottom: 5 }}>
                                    {config.gridRows && (
                                      <CartesianGrid vertical={false} stroke={config.darkMode ? "#333" : "#e5e7eb"} strokeDasharray="3 3" />
                                    )}
                                    <XAxis
                                      dataKey="timestamp"
                                      type="number"
                                      domain={['dataMin', 'dataMax']}
                                      hide
                                    />
                                    {config.yAxis && (
                                      <YAxis
                                        domain={[0, 100]}
                                        orientation="right"
                                        tick={{ fontSize: 10, fill: config.darkMode ? "#6b7280" : "#9ca3af" }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(v) => `${v}%`}
                                        width={30}
                                      />
                                    )}
                                    <Tooltip
                                      content={<CustomTooltip />}
                                      cursor={{ stroke: config.darkMode ? '#4b5563' : '#9ca3af', strokeDasharray: '3 3' }}
                                      isAnimationActive={false}
                                      wrapperStyle={{ zIndex: 100, pointerEvents: 'none' }}
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
                                                <circle cx={cx} cy={cy} r={4} fill={line.color} />
                                                <text x={cx + 8} y={cy + 4} fill={line.color} fontSize={14} fontWeight="bold">
                                                  {line.price}%
                                                </text>
                                              </g>
                                            );
                                          }
                                          return <circle key={`dot-${line.id}-${index}`} cx={cx} cy={cy} r={0} fill="none" pointerEvents="none" />;
                                        }}
                                      />
                                    ))}
                                  </LineChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className="flex items-center justify-center h-full text-xs text-[var(--text-tertiary)]">
                                  Loading chart...
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Sports 特有的右侧胜率显示 */}
                        {isSports && config.chart && (
                          <div className="flex flex-col gap-2 items-end justify-start font-bold pt-1">
                            {lines.map(line => (
                              <span key={line.id} style={{ color: line.color }}>{line.price}%</span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Volume 区域 */}
                      {config.volume && (
                        <div className="flex items-center justify-between text-[10px] opacity-60 mt-3 font-medium flex-shrink-0">
                          <span>${Number(previewMarket.volume || 0).toLocaleString()} Vol.</span>
                          <span className="flex items-center cursor-pointer hover:opacity-100">
                            All time <ChevronDown size={12} className="ml-0.5" />
                          </span>
                        </div>
                      )}

                      {/* Buy Buttons */}
                      {config.buyButtons && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-current border-opacity-10 flex-shrink-0">
                          {isSports ? (
                            lines.map((line) => (
                              <button key={line.id} className="flex-1 py-2 rounded-lg font-semibold text-sm transition-colors flex justify-center gap-2 text-white" style={{ backgroundColor: line.color }}>
                                <span className="truncate max-w-[80px]">{line.label}</span>
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
                <div className="relative mt-6 flex justify-center w-full max-w-full" style={{ width: actualWidth }}>
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-[var(--border)] opacity-50" />
                  <div className="absolute top-[-14px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                    <div className="group relative bg-[var(--bg-card)] border border-[var(--border)] rounded-md shadow-sm z-10 hover:border-[var(--text-tertiary)] transition-colors">
                      <button onClick={() => handleDimensionChange("width", -10)} className="absolute top-0 bottom-0 -left-5 w-5 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity"><Minus size={12}/></button>
                      <input
                        type="number"
                        value={dimensions.width}
                        onChange={(e) => handleInputChange("width", e.target.value)}
                        className="w-12 h-7 bg-transparent text-center text-xs focus:outline-none appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button onClick={() => handleDimensionChange("width", 10)} className="absolute top-0 bottom-0 -right-5 w-5 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={12}/></button>
                    </div>
                    <span className="text-[10px] text-[var(--text-tertiary)] font-mono font-bold">W</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-2xl text-left">
                <p className="text-sm text-[var(--text-secondary)] font-medium mb-3">
                  Copy and paste this code into your website
                </p>
                <div className="bg-[#0d1117] text-[#c9d1d9] p-5 rounded-xl font-mono text-[13px] leading-relaxed overflow-x-auto relative border border-[#30363d]">
                  <button
                    className={`absolute top-3 right-3 p-1.5 rounded-md transition-colors ${
                      copied ? 'bg-green-600/20 text-green-400' : 'hover:bg-white/10 text-[#8b949e]'
                    }`}
                    onClick={handleCopy}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                  <pre className="whitespace-pre-wrap break-all pr-8">
                    {generatedCode.split('\n').map((line, i) => (
                      <div key={i} className="whitespace-pre-wrap break-all">
                        {renderHighlightedCodeLine(line, i)}
                      </div>
                    ))}
                  </pre>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-3">
                  The widget will display a live preview of market data with interactive chart and trading buttons.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
