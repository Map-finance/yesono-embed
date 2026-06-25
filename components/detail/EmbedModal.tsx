import React, { useState, useMemo } from "react";
import { X, ChevronDown, Copy, Code, ChevronLeft, Plus, Minus, Check } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { Market } from "@/types/types";
import { PolymarketMarketResp } from "@/types/home";
import { Switch } from "@/components/ui/Switch";
import { usePriceHistory } from "@/lib/hooks/usePriceHistory";
import {
  generateEmbedCode,
  renderHighlightedCodeLine,
} from "./EmbedModal.helpers";
import { buildSportsEventUrl } from "@/lib/utils/sportsNav";
import EmbedPreviewCard from "./EmbedPreviewCard";

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
  // 体育赛事详情在 /sports?event={slug}，不是 /market/{slug};否则分享链接定位不到本场比赛。
  const marketUrl = isSports
    ? `${siteOrigin}${buildSportsEventUrl(String(marketSlug))}`
    : `${siteOrigin}/market/${marketSlug}`;

  const embedSrc = `${siteOrigin}/embed/${marketSlug}?chart=${config.chart}&buy=${config.buyButtons}&vol=${config.volume}&theme=${config.darkMode ? 'dark' : 'light'}&border=${config.border}`;

  const yesPrice = lines[0]?.price ?? 0;
  const noPrice = lines.length <= 2 ? 100 - Number(yesPrice) : 0;

  const generatedCode = generateEmbedCode({
    marketUrl,
    marketSlug: String(marketSlug),
    embedSrc,
    title: previewMarket.title,
    yesPrice,
    noPrice,
    siteOrigin,
    width: actualWidth,
    height: actualHeight,
  });

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

  return (
    <div
      className="fixed inset-0 z-101 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-(--bg-card) rounded-2xl w-[900px] max-w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-(--text-primary)">Embed</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-(--bg-hover) text-(--text-secondary) transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel */}
          <div className="w-[260px] shrink-0 border-r border-(--border) px-6 pb-6 overflow-y-auto flex flex-col">
            {viewMode === "preview" ? (
              <>
                {!isSports && eventMarkets && eventMarkets.length > 1 && (
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-sm text-(--text-primary) font-medium">Market</span>
                    <div className="relative">
                      <select
                        className="appearance-none bg-transparent border border-(--border) rounded-lg pl-3 pr-7 py-1.5 text-xs font-medium focus:outline-hidden focus:border-(--text-primary) max-w-[120px]"
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
                      <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-(--text-secondary) pointer-events-none" />
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
                      <span className="text-sm text-(--text-primary) font-medium">{label}</span>
                      <Switch checked={config[key]} onCheckedChange={() => handleConfigChange(key)} />
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-4 border-t border-(--border)">
                  <button
                    onClick={() => setViewMode("code")}
                    className="w-full flex items-center justify-center gap-2 bg-(--accent) hover:opacity-90 text-(--text-inverse) py-3 rounded-xl font-semibold transition-opacity"
                  >
                    <Code size={18} />
                    View Code
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-(--text-primary) font-medium">Dimensions</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div>
                    <label className="text-xs text-(--text-tertiary) mb-1 block">Width</label>
                    <div className="flex items-center border border-(--border) rounded-lg overflow-hidden">
                      <button onClick={() => handleDimensionChange("width", -10)} className="px-2 py-1.5 text-(--text-secondary) hover:bg-(--bg-hover)"><Minus size={12}/></button>
                      <input
                        type="number"
                        value={dimensions.width}
                        onChange={(e) => handleInputChange("width", e.target.value)}
                        className="w-full bg-transparent text-center text-sm py-1.5 focus:outline-hidden appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button onClick={() => handleDimensionChange("width", 10)} className="px-2 py-1.5 text-(--text-secondary) hover:bg-(--bg-hover)"><Plus size={12}/></button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-(--text-tertiary) mb-1 block">Height</label>
                    <div className="flex items-center border border-(--border) rounded-lg overflow-hidden">
                      <button onClick={() => handleDimensionChange("height", -10)} className="px-2 py-1.5 text-(--text-secondary) hover:bg-(--bg-hover)"><Minus size={12}/></button>
                      <input
                        type="number"
                        value={dimensions.height}
                        onChange={(e) => handleInputChange("height", e.target.value)}
                        className="w-full bg-transparent text-center text-sm py-1.5 focus:outline-hidden appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button onClick={() => handleDimensionChange("height", 10)} className="px-2 py-1.5 text-(--text-secondary) hover:bg-(--bg-hover)"><Plus size={12}/></button>
                    </div>
                  </div>
                </div>

                <div className="flex-1" />

                <div className="mt-6 pt-4 border-t border-(--border) flex gap-3">
                  <button
                    onClick={() => setViewMode("preview")}
                    className="shrink-0 flex items-center justify-center bg-transparent border border-(--border) hover:bg-(--bg-hover) text-(--text-primary) px-4 py-3 rounded-xl font-semibold transition-colors"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    onClick={handleCopy}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all ${
                      copied
                        ? "bg-green-600 text-white"
                        : "bg-(--accent) hover:opacity-90 text-(--text-inverse)"
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
          <div className="flex-1 bg-(--bg-secondary) flex items-center justify-center p-10 relative overflow-auto">
            {viewMode === "preview" ? (
              <EmbedPreviewCard
                market={market}
                previewMarket={previewMarket}
                isSports={isSports}
                config={config}
                lines={lines}
                formattedChartData={formattedChartData}
                dimensions={dimensions}
                actualWidth={actualWidth}
                actualHeight={actualHeight}
                onDimensionStep={handleDimensionChange}
                onDimensionInput={handleInputChange}
              />
            ) : (
              <div className="w-full max-w-2xl text-left">
                <p className="text-sm text-(--text-secondary) font-medium mb-3">
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
                <p className="text-xs text-(--text-tertiary) mt-3">
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
