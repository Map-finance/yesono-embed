"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  BarData,
  ColorType,
  CrosshairMode,
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  LastPriceAnimationMode,
  LineData,
  LineSeries,
  LineStyleOptions,
  MismatchDirection,
  SeriesAttachedParameter,
  SeriesType,
  Time,
  WhitespaceData,
  createChart,
} from "lightweight-charts";
import { getAssetColor } from "@/utils/format";

interface PartialPriceLineExampleChartProps {
  symbol?: string;
  height?: number;
}

interface Point {
  time: Time;
  value: number;
}

type ExamplePoint = LineData<Time>;

type BitmapPositionLength = {
  position: number;
  length: number;
};

const DEFAULT_MOCK_STOP_MS = 8000;
const OFFICIAL_RTDS_WS_URL = "wss://ws-live-data.polymarket.com/";
const OFFICIAL_WS_PING_MS = 5000;

type RealtimeSource = "official" | "current";

function centerOffset(lineBitmapWidth: number): number {
  return Math.floor(lineBitmapWidth * 0.5);
}

function positionsLine(
  positionMedia: number,
  pixelRatio: number,
  desiredWidthMedia = 1,
  widthIsBitmap?: boolean
): BitmapPositionLength {
  const scaledPosition = Math.round(pixelRatio * positionMedia);
  const lineBitmapWidth = widthIsBitmap
    ? desiredWidthMedia
    : Math.round(desiredWidthMedia * pixelRatio);
  const offset = centerOffset(lineBitmapWidth);

  return {
    position: scaledPosition - offset,
    length: lineBitmapWidth,
  };
}

function getValue(data: LineData<Time> | BarData<Time> | WhitespaceData<Time>) {
  if ("value" in data && typeof data.value === "number") return data.value;
  if ("close" in data && typeof data.close === "number") return data.close;
  return null;
}

let randomFactor = 25 + Math.random() * 25;

function samplePoint(index: number): number {
  return (
    index *
      (0.5 +
        Math.sin(index / 10) * 0.2 +
        Math.sin(index / 20) * 0.4 +
        Math.sin(index / randomFactor) * 0.8 +
        Math.sin(index / 500) * 0.5) +
    200
  );
}

function generateLineData(numberOfPoints = 240): ExamplePoint[] {
  randomFactor = 25 + Math.random() * 25;
  const result: ExamplePoint[] = [];
  const date = new Date(Date.UTC(2018, 0, 1, 12, 0, 0, 0));

  for (let index = 0; index < numberOfPoints; index += 1) {
    result.push({
      time: (date.getTime() / 1000) as Time,
      value: samplePoint(index),
    });
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return result;
}

function isMockModeEnabled(rawValue: string | null): boolean {
  return rawValue === "1";
}

function getRealtimeSourcePreference(
  rawValue: string | null
): RealtimeSource | "auto" {
  if (rawValue === "official" || rawValue === "current") return rawValue;
  return "auto";
}

function getMockAutoStopMs(rawValue: string | null): number {
  const parsed = rawValue ? Number(rawValue) : NaN;

  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }

  return DEFAULT_MOCK_STOP_MS;
}

function normalizeHistoryPoints(data: any[]): Point[] {
  return data
    .map((item) => ({
      time: (item.timestamp / 1000) as Time,
      value: Number(item.value),
    }))
    .filter(
      (item) =>
        typeof item.time === "number" &&
        Number.isFinite(item.time) &&
        Number.isFinite(item.value)
    )
    .sort((a, b) => (a.time as number) - (b.time as number))
    .filter(
      (item, index, all) => index === 0 || item.time !== all[index - 1].time
    );
}

function normalizeRealtimePoint(payload: any): Point | null {
  const timestamp = Number(payload?.timestamp);
  const value = Number(payload?.value);

  if (!Number.isFinite(timestamp) || !Number.isFinite(value)) {
    return null;
  }

  return {
    time: (timestamp / 1000) as Time,
    value,
  };
}

function buildOfficialSubscribeMessage(symbol: string) {
  return {
    action: "subscribe",
    subscriptions: [
      {
        topic: "crypto_prices_chainlink",
        type: "*",
        filters: JSON.stringify({ symbol }),
      },
    ],
  };
}

function getRealtimeProviders(
  symbol: string,
  currentWsUrl?: string
): Array<{
  source: RealtimeSource;
  url: string;
  subscribeMessage: unknown;
  pingMessage?: string;
}> {
  const providers: Array<{
    source: RealtimeSource;
    url: string;
    subscribeMessage: unknown;
    pingMessage?: string;
  }> = [
    {
      source: "official",
      url: OFFICIAL_RTDS_WS_URL,
      subscribeMessage: buildOfficialSubscribeMessage(symbol),
      pingMessage: "PING",
    },
  ];

  if (currentWsUrl) {
    providers.push({
      source: "current",
      url: currentWsUrl,
      subscribeMessage: {
        type: "subscribe",
        operation: "cryptoPrice",
        symbol,
      },
    });
  }

  return providers;
}

class PartialPriceLineRenderer implements IPrimitivePaneRenderer {
  private price: number | null = null;
  private x: number | null = null;
  private color = "#000000";

  update(priceY: number | null, color: string, x: number | null) {
    this.price = priceY;
    this.color = color;
    this.x = x;
  }

  draw(target: Parameters<IPrimitivePaneRenderer["draw"]>[0]) {
    target.useBitmapCoordinateSpace((scope) => {
      if (this.price === null || this.x === null) return;

      const xPosition = Math.round(this.x * scope.horizontalPixelRatio);
      const yPosition = positionsLine(
        this.price,
        scope.verticalPixelRatio,
        scope.verticalPixelRatio
      );
      const yCenter = yPosition.position + yPosition.length / 2;
      const ctx = scope.context;

      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([
        4 * scope.verticalPixelRatio,
        2 * scope.verticalPixelRatio,
      ]);
      ctx.moveTo(xPosition, yCenter);
      ctx.lineTo(scope.bitmapSize.width, yCenter);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = scope.verticalPixelRatio;
      ctx.stroke();
      ctx.restore();
    });
  }
}

class PartialPriceLineView implements IPrimitivePaneView {
  private readonly rendererInstance = new PartialPriceLineRenderer();

  renderer(): IPrimitivePaneRenderer {
    return this.rendererInstance;
  }

  update(priceY: number | null, color: string, x: number | null) {
    this.rendererInstance.update(priceY, color, x);
  }
}

class PartialPriceLinePrimitive implements ISeriesPrimitive<Time> {
  private readonly paneViewInstances = [new PartialPriceLineView()];
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType, Time> | null = null;

  attached({ chart, series }: SeriesAttachedParameter<Time>) {
    this.chart = chart;
    this.series = series;
    this.series.applyOptions({
      priceLineVisible: false,
    });
  }

  detached() {
    this.chart = null;
    this.series = null;
  }

  updateAllViews() {
    if (!this.chart || !this.series) return;

    const seriesOptions = this.series.options();
    let color =
      seriesOptions.priceLineColor ||
      (seriesOptions as LineStyleOptions).color ||
      "#000000";

    const lastValue = this.series.dataByIndex(
      Number.MAX_SAFE_INTEGER,
      MismatchDirection.NearestLeft
    );

    let price: number | null = null;
    let x: number | null = null;

    if (lastValue) {
      if ("color" in lastValue && typeof lastValue.color === "string") {
        color = lastValue.color;
      }
      price = getValue(lastValue);
      x = this.chart.timeScale().timeToCoordinate(lastValue.time);
    }

    const priceY =
      price !== null ? (this.series.priceToCoordinate(price) as number) : null;

    this.paneViewInstances.forEach((paneView) =>
      paneView.update(priceY, color, x)
    );
  }

  paneViews() {
    return this.paneViewInstances;
  }
}

export default function PartialPriceLineExampleChart({
  symbol = "eth/usd",
  height = 240,
}: PartialPriceLineExampleChartProps) {
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line", Time> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const unsupportedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const mockAutoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasReceivedDataRef = useRef(false);
  const themeColor = getAssetColor(symbol);
  const mockMode = isMockModeEnabled(searchParams.get("partialPriceLineMock"));
  const sourcePreference = getRealtimeSourcePreference(
    searchParams.get("partialPriceLineSource")
  );
  const mockStopMs = getMockAutoStopMs(
    searchParams.get("partialPriceLineMockStopMs")
  );

  const [loading, setLoading] = useState(true);
  const [unsupported, setUnsupported] = useState(false);
  const [connectedSource, setConnectedSource] = useState<
    RealtimeSource | "mock" | null
  >(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#A0AEC0",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255, 255, 255, 0.06)" },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        rightOffset: 6,
        fixRightEdge: true,
        timeVisible: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(LineSeries, {
      color: themeColor,
      lineWidth: 2,
      lastPriceAnimation: LastPriceAnimationMode.OnDataUpdate,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBackgroundColor: themeColor,
      crosshairMarkerBorderColor: `${themeColor}66`,
      priceLineColor: themeColor,
    });

    series.attachPrimitive(new PartialPriceLinePrimitive());

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [height, themeColor]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const currentWsUrl = process.env.NEXT_PUBLIC_ORDERBOOK_WS_URL;
    setLoading(true);
    setUnsupported(false);
    setConnectedSource(null);
    hasReceivedDataRef.current = false;

    if (mockMode) {
      const data = generateLineData();
      const initialData = data.slice(0, -48);
      const realtimeUpdates = data.slice(-48);

      series.setData(initialData);
      chart.timeScale().fitContent();
      setConnectedSource("mock");

      const scrollPosition = chart.timeScale().scrollPosition();
      chart.timeScale().scrollToPosition(scrollPosition + 12, false);

      let nextUpdateIndex = 0;
      const intervalId = window.setInterval(() => {
        const nextPoint = realtimeUpdates[nextUpdateIndex];
        if (!nextPoint) {
          window.clearInterval(intervalId);
          return;
        }

        series.update(nextPoint);
        nextUpdateIndex += 1;
      }, 220);

      if (mockStopMs > 0) {
        mockAutoStopTimerRef.current = setTimeout(() => {
          mockAutoStopTimerRef.current = null;
          window.clearInterval(intervalId);
        }, mockStopMs);
      }

      setLoading(false);

      return () => {
        window.clearInterval(intervalId);
        if (mockAutoStopTimerRef.current) {
          clearTimeout(mockAutoStopTimerRef.current);
          mockAutoStopTimerRef.current = null;
        }
      };
    }

    const allProviders = getRealtimeProviders(symbol, currentWsUrl);
    const providers =
      sourcePreference === "auto"
        ? allProviders
        : allProviders.filter(
            (provider) => provider.source === sourcePreference
          );

    if (providers.length === 0) {
      setLoading(false);
      setUnsupported(true);
      return;
    }

    let disposed = false;
    let activeProviderIndex = 0;

    const clearSocketSideEffects = () => {
      if (unsupportedTimerRef.current) {
        clearTimeout(unsupportedTimerRef.current);
        unsupportedTimerRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (pingTimerRef.current) {
        clearInterval(pingTimerRef.current);
        pingTimerRef.current = null;
      }
    };

    const closeSocket = () => {
      clearSocketSideEffects();

      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };

    const tryProvider = (providerIndex: number, reconnect = false) => {
      if (disposed) return;

      const provider = providers[providerIndex];
      if (!provider) {
        setLoading(false);
        setUnsupported(true);
        setConnectedSource(null);
        return;
      }

      activeProviderIndex = providerIndex;
      hasReceivedDataRef.current = false;
      closeSocket();

      const ws = new WebSocket(provider.url);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify(provider.subscribeMessage));

        if (provider.pingMessage) {
          pingTimerRef.current = setInterval(() => {
            try {
              ws.send(provider.pingMessage!);
            } catch (e) {
              console.debug('[PartialPriceLineExampleChart] Transient websocket ping failure', e);
              // ignore transient socket failures here; onerror/onclose handles retry
            }
          }, OFFICIAL_WS_PING_MS);
        }

        unsupportedTimerRef.current = setTimeout(() => {
          if (hasReceivedDataRef.current || disposed) return;

          ws.onclose = null;
          ws.close();
          tryProvider(providerIndex + 1);
        }, 3000);
      };

      ws.onmessage = (event) => {
        if (!event.data || event.data.length === 0) return;

        try {
          const message = JSON.parse(event.data);
          const nextSeries = seriesRef.current;
          const nextChart = chartRef.current;
          if (!nextSeries || !nextChart) return;

          if (
            message?.type === "subscribe" &&
            Array.isArray(message?.payload?.data)
          ) {
            const history = normalizeHistoryPoints(message.payload.data);
            if (history.length === 0) return;

            nextSeries.setData(history);
            nextChart.timeScale().fitContent();
            hasReceivedDataRef.current = true;
            setLoading(false);
            setUnsupported(false);
            setConnectedSource(provider.source);

            if (unsupportedTimerRef.current) {
              clearTimeout(unsupportedTimerRef.current);
              unsupportedTimerRef.current = null;
            }
            return;
          }

          if (message?.type === "update") {
            const payloadSymbol = String(
              message?.payload?.symbol ?? ""
            ).toLowerCase();
            const expectedSymbol = symbol.toLowerCase();
            if (payloadSymbol && payloadSymbol !== expectedSymbol) return;

            const nextPoint = normalizeRealtimePoint(message.payload);
            if (!nextPoint) return;

            nextSeries.update(nextPoint);
            hasReceivedDataRef.current = true;
            setLoading(false);
            setUnsupported(false);
            setConnectedSource(provider.source);
          }
        } catch (error) {
          console.error(
            "[PartialPriceLineExampleChart] WS Parse Error:",
            error
          );
        }
      };

      ws.onclose = () => {
        clearSocketSideEffects();
        if (disposed) return;

        if (hasReceivedDataRef.current) {
          reconnectTimeoutRef.current = setTimeout(
            () => {
              tryProvider(activeProviderIndex, true);
            },
            reconnect ? 1500 : 3000
          );
          return;
        }

        tryProvider(providerIndex + 1);
      };

      ws.onerror = (error) => {
        console.error("[PartialPriceLineExampleChart] WS Error:", error);
        ws.close();
      };
    };

    tryProvider(0);

    return () => {
      disposed = true;
      hasReceivedDataRef.current = false;
      if (mockAutoStopTimerRef.current) {
        clearTimeout(mockAutoStopTimerRef.current);
        mockAutoStopTimerRef.current = null;
      }
      closeSocket();
    };
  }, [mockMode, mockStopMs, sourcePreference, symbol]);

  return (
    <section className="mt-3 lg:mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-3 lg:p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm lg:text-base font-medium text-[var(--text-primary)]">
            Partial Price Line
          </h3>
        </div>
        <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--text-secondary)]">
          {mockMode
            ? "Mock"
            : connectedSource === "official"
            ? "Official"
            : connectedSource === "current"
            ? "Current"
            : "Connecting"}
        </span>
      </div>

      <div
        className="relative overflow-hidden rounded-lg bg-[var(--bg-primary)]"
        style={{ height }}
      >
        {loading && !unsupported && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-primary)]/50 backdrop-blur-sm">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--text-secondary)]" />
          </div>
        )}

        {unsupported && (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-[var(--text-secondary)]">
            Live price data unavailable
          </div>
        )}

        <div ref={containerRef} className="h-full w-full" />
      </div>
    </section>
  );
}
