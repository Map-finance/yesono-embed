import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  Time,
  CrosshairMode,
  AreaSeries,
} from "lightweight-charts";
import { Loader2 } from "lucide-react";
import { getAssetColor } from "@/utils/format";
import LivePriceHeader from "./LivePriceHeader";

interface Point {
  time: Time;
  value: number;
}

interface TradeTapeItem {
  id: string;
  side: "BUY" | "SELL";
  amount: number;
  entered: boolean;
  exiting: boolean;
}

interface LivePriceChartProps {
  symbol?: string;
  eventSlug?: string;
  height?: number;
  /** 由父组件传入：市场是否仍在进行（false 则显示 Final price） */
  isLive: boolean;
  /** 市场结束时间戳（毫秒），传给内部倒计时 */
  endDate?: number;
  /** 市场频率标签，如 "5m" / "15m" / "1h" / "4h" / "daily" / "weekly" */
  frequencySlug?: string;
  /** 当前处于 LIVE 状态的市场 slug，用于"Go to live market"跳转 */
  liveMarketSlug?: string;
  /** 可选：外部观察价格变化（内部已自行管理，一般无需传） */
  onPriceUpdate?: (currentPrice: number, priceChange: number) => void;
  /** WS 服务端不支持该 symbol 时回调（返回空消息即视为不支持） */
  onUnsupported?: () => void;
}

const TRADE_TAPE_MAX_ITEMS = 6;
const TRADE_TAPE_ROW_HEIGHT = 24;
const TRADE_TAPE_FLUSH_MS = 240;
const TRADE_TAPE_BUY_COLOR = "#FF453A";
const TRADE_TAPE_SELL_COLOR = "#00C213";
const TRADE_TAPE_LIFETIME_MS = 2000;
const TRADE_TAPE_ENTER_DELAY_MS = 16;
const TRADE_TAPE_ENTER_DURATION_MS = 260;
const TRADE_TAPE_MOVE_DURATION_MS = 420;
const TRADE_TAPE_EXIT_DURATION_MS = 500;
const MOCK_TRADE_INTERVAL_MS = 650;
const DEFAULT_MOCK_TRADE_AUTO_STOP_MS = 8000;

function formatTradeTapeAmount(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return Math.round(abs).toLocaleString();
  return abs.toLocaleString(undefined, {
    minimumFractionDigits: abs < 10 && abs % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function isMockTradeStreamEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get("mockTrades");
  if (queryValue === "1") return true;
  if (queryValue === "0") return false;
  return window.localStorage.getItem("mockTrades") === "1";
}

function getMockTradeAutoStopMs(): number {
  if (typeof window === "undefined") return DEFAULT_MOCK_TRADE_AUTO_STOP_MS;
  const params = new URLSearchParams(window.location.search);
  const queryValue = params.get("mockTradesStopMs");
  const storageValue = window.localStorage.getItem("mockTradesStopMs");
  const raw = queryValue ?? storageValue;
  const parsed = raw ? Number(raw) : NaN;

  if (Number.isFinite(parsed) && parsed >= 0) {
    return parsed;
  }

  return DEFAULT_MOCK_TRADE_AUTO_STOP_MS;
}

export const LivePriceChart: React.FC<LivePriceChartProps> = ({
  symbol = "eth/usd",
  eventSlug,
  height = 320,
  isLive,
  endDate,
  frequencySlug,
  liveMarketSlug,
  onPriceUpdate,
  onUnsupported,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const pulseDotRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area", Time> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tradeWsRef = useRef<WebSocket | null>(null);
  const tradeReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tradeFlushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mockTradeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mockTradeAutoStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tradeEnterTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const tradeExitTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const tradeRemoveTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pendingTradeItemsRef = useRef<TradeTapeItem[]>([]);
  const tradeSeqRef = useRef(0);
  const unsupportedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const basePriceRef = useRef<number | null>(null);
  const onPriceUpdateRef = useRef(onPriceUpdate);
  const onUnsupportedRef = useRef(onUnsupported);
  // 标记是否已收到过真实 payload 数据（用于超时判断和 onclose 兜底）
  const hasReceivedDataRef = useRef(false);

  const themeColor = getAssetColor(symbol);

  const [loading, setLoading] = useState(true);
  const [livePrice, setLivePrice] = useState(0);
  const [livePriceChange, setLivePriceChange] = useState(0);
  const [tradeTapeItems, setTradeTapeItems] = useState<TradeTapeItem[]>([]);

  const clearTradeItemTimers = useCallback((id: string) => {
    const enterTimer = tradeEnterTimersRef.current.get(id);
    if (enterTimer) {
      clearTimeout(enterTimer);
      tradeEnterTimersRef.current.delete(id);
    }
    const exitTimer = tradeExitTimersRef.current.get(id);
    if (exitTimer) {
      clearTimeout(exitTimer);
      tradeExitTimersRef.current.delete(id);
    }
    const removeTimer = tradeRemoveTimersRef.current.get(id);
    if (removeTimer) {
      clearTimeout(removeTimer);
      tradeRemoveTimersRef.current.delete(id);
    }
  }, []);

  const clearAllTradeItemTimers = useCallback(() => {
    tradeEnterTimersRef.current.forEach((timer) => clearTimeout(timer));
    tradeExitTimersRef.current.forEach((timer) => clearTimeout(timer));
    tradeRemoveTimersRef.current.forEach((timer) => clearTimeout(timer));
    tradeEnterTimersRef.current.clear();
    tradeExitTimersRef.current.clear();
    tradeRemoveTimersRef.current.clear();
  }, []);

  const scheduleTradeItemLifecycle = useCallback(
    (id: string) => {
      clearTradeItemTimers(id);

      const enterTimer = setTimeout(() => {
        tradeEnterTimersRef.current.delete(id);
        setTradeTapeItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, entered: true } : item
          )
        );
      }, TRADE_TAPE_ENTER_DELAY_MS);
      tradeEnterTimersRef.current.set(id, enterTimer);

      const exitTimer = setTimeout(() => {
        tradeExitTimersRef.current.delete(id);
        setTradeTapeItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, exiting: true } : item
          )
        );
      }, TRADE_TAPE_LIFETIME_MS);
      tradeExitTimersRef.current.set(id, exitTimer);

      const removeTimer = setTimeout(() => {
        tradeRemoveTimersRef.current.delete(id);
        setTradeTapeItems((prev) => prev.filter((item) => item.id !== id));
      }, TRADE_TAPE_LIFETIME_MS + TRADE_TAPE_EXIT_DURATION_MS);
      tradeRemoveTimersRef.current.set(id, removeTimer);
    },
    [clearTradeItemTimers]
  );

  const flushPendingTradeItems = useCallback(() => {
    const pending = pendingTradeItemsRef.current;
    if (pending.length === 0) return;
    pendingTradeItemsRef.current = [];

    const pendingIds = pending.map((item) => item.id);

    setTradeTapeItems((prev) => {
      const next = [...pending, ...prev].slice(0, TRADE_TAPE_MAX_ITEMS);
      const nextIds = new Set(next.map((item) => item.id));

      prev.forEach((item) => {
        if (!nextIds.has(item.id)) clearTradeItemTimers(item.id);
      });
      pending.forEach((item) => {
        if (!nextIds.has(item.id)) clearTradeItemTimers(item.id);
      });

      return next;
    });

    pendingIds.forEach((id) => scheduleTradeItemLifecycle(id));
  }, [clearTradeItemTimers, scheduleTradeItemLifecycle]);

  const enqueueTradeItem = useCallback(
    (side: "BUY" | "SELL", amount: number) => {
      const item: TradeTapeItem = {
        id: `${Date.now()}-${tradeSeqRef.current++}`,
        side,
        amount,
        entered: false,
        exiting: false,
      };

      pendingTradeItemsRef.current.unshift(item);
      if (tradeFlushTimerRef.current) return;
      tradeFlushTimerRef.current = setTimeout(() => {
        tradeFlushTimerRef.current = null;
        flushPendingTradeItems();
      }, TRADE_TAPE_FLUSH_MS);
    },
    [flushPendingTradeItems]
  );

  useEffect(() => {
    onPriceUpdateRef.current = onPriceUpdate;
  }, [onPriceUpdate]);

  useEffect(() => {
    onUnsupportedRef.current = onUnsupported;
  }, [onUnsupported]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 1. Initialize Chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#A0AEC0",
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(255, 255, 255, 0.05)" },
      },
      rightPriceScale: {
        borderVisible: false,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
        tickMarkFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return `${date.getHours()}:${String(date.getMinutes()).padStart(
            2,
            "0"
          )}:${String(date.getSeconds()).padStart(2, "0")}`;
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(255, 255, 255, 0.2)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#2b2b43",
        },
        horzLine: {
          color: "rgba(255, 255, 255, 0.2)",
          width: 1,
          style: 3,
          labelBackgroundColor: "#2b2b43",
        },
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
      handleScroll: false, // 禁止滚动
      handleScale: false, // 禁止缩放
      localization: {
        timeFormatter: (time: number) => {
          const date = new Date(time * 1000);
          return (
            `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ` +
            `${date.getHours()}:${String(date.getMinutes()).padStart(
              2,
              "0"
            )}:${String(date.getSeconds()).padStart(2, "0")}`
          );
        },
      },
    });

    chartRef.current = chart;

    // The theme color can be matched with Polymarket (e.g. green or blue)

    const newSeries = chart.addSeries(AreaSeries, {
      lineColor: themeColor,
      topColor: `${themeColor}33`, // roughly 20% opacity
      bottomColor: `${themeColor}00`, // 0% opacity
      lineWidth: 2,
      priceLineVisible: true,
      priceLineColor: themeColor,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: `${themeColor}4D`, // roughly 30% opacity
      crosshairMarkerBackgroundColor: themeColor,
    });

    seriesRef.current = newSeries;

    // Custom CSS Pulse Dot logic
    const updatePulseDot = () => {
      if (!chart || !newSeries || !pulseDotRef.current) return;

      const data = newSeries.data() as Point[];
      if (!data || data.length === 0) return;

      const lastPoint = data[data.length - 1];
      const x = chart.timeScale().timeToCoordinate(lastPoint.time);
      const y = newSeries.priceToCoordinate(lastPoint.value);

      if (x !== null && y !== null) {
        pulseDotRef.current.style.left = `${x}px`;
        pulseDotRef.current.style.top = `${y}px`;
        pulseDotRef.current.style.display = "block";
      }
    };

    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      updatePulseDot();
    });

    // 2. WebSocket Connection
    const connectWs = () => {
      const ws = new WebSocket(process.env.NEXT_PUBLIC_ORDERBOOK_WS_URL!);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[LivePriceChart] WS Connected. Subscribing to", symbol);
        const subscribeMsg = {
          type: "subscribe",
          operation: "cryptoPrice",
          symbol: symbol,
        };
        ws.send(JSON.stringify(subscribeMsg));

        // 订阅后若 5 秒内未收到真实数据，主动判定为服务端不支持该 symbol
        // 定时器存于 ref，不触发任何 React 渲染
        if (unsupportedTimerRef.current)
          clearTimeout(unsupportedTimerRef.current);
        unsupportedTimerRef.current = setTimeout(() => {
          if (!hasReceivedDataRef.current) {
            console.warn(
              "[LivePriceChart] No data in 5s, symbol unsupported:",
              symbol
            );
            ws.onclose = null; // 阻止 onclose 重复触发 onUnsupported
            ws.close();
            onUnsupportedRef.current?.();
          }
        }, 3000);
      };

      ws.onmessage = (event) => {
        // 0 字节是正常的 ACK 消息，支持和不支持的 symbol 都会收到，直接忽略
        if (!event.data || event.data.length === 0) return;
        try {
          const data = JSON.parse(event.data);
          if (!seriesRef.current) return;

          if (data.type === "subscribe" && data.topic === "crypto_prices") {
            const rawData = data.payload.data;
            // 服务端返回空数组表示当前 symbol 暂无历史数据，视为“未收到真实数据”
            // 不清除 unsupported 超时计时器，等待 5 秒兜底逻辑触发 onUnsupported
            if (!rawData || rawData.length === 0) {
              return;
            }
            const historicalData: Point[] = rawData.map((item: any) => ({
              time: (item.timestamp / 1000) as Time,
              value: item.value,
            }));

            historicalData.sort(
              (a, b) => (a.time as number) - (b.time as number)
            );

            const uniqueData = historicalData.filter(
              (item, index, self) =>
                index === 0 || item.time !== self[index - 1].time
            );

            if (uniqueData.length > 0) {
              basePriceRef.current = uniqueData[0].value;
              const lastPoint = uniqueData[uniqueData.length - 1];
              const change = lastPoint.value - basePriceRef.current;
              setLivePrice(lastPoint.value);
              setLivePriceChange(change);
              onPriceUpdateRef.current?.(lastPoint.value, change);
            }

            seriesRef.current.setData(uniqueData);
            chartRef.current?.timeScale().fitContent();
            // 收到非空的真实历史数据：标记支持，并清除"不支持超时计时器"
            hasReceivedDataRef.current = true;
            if (unsupportedTimerRef.current) {
              clearTimeout(unsupportedTimerRef.current);
              unsupportedTimerRef.current = null;
            }
            setLoading(false);
            updatePulseDot();
          }

          if (
            data.type === "update" &&
            data.topic === "crypto_prices_chainlink"
          ) {
            const time = (data.payload.timestamp / 1000) as Time;
            const newValue = data.payload.value;
            seriesRef.current.update({
              time: time,
              value: newValue,
            });
            if (basePriceRef.current !== null) {
              const change = newValue - basePriceRef.current;
              setLivePrice(newValue);
              setLivePriceChange(change);
              onPriceUpdateRef.current?.(newValue, change);
            }
            updatePulseDot();
          }
        } catch (e) {
          console.error("[LivePriceChart] WS Parse Error:", e);
        }
      };

      ws.onclose = () => {
        // WS 关闭时若从未收到过真实数据，说明该 symbol 不在服务端支持列表中
        if (!hasReceivedDataRef.current) {
          onUnsupportedRef.current?.();
          return; // 不重连
        }
        console.log("[LivePriceChart] WS Closed. Reconnecting in 3s...");
        reconnectTimeoutRef.current = setTimeout(connectWs, 3000);
      };

      ws.onerror = (err) => {
        console.error("[LivePriceChart] WS Error:", err);
        ws.close();
      };
    };

    connectWs();

    // 3. Responsive Resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
        updatePulseDot();
      }
    };
    window.addEventListener("resize", handleResize);

    // 4. Cleanup
    return () => {
      hasReceivedDataRef.current = false; // symbol 切换时重置，允许新 symbol 重新尝试
      window.removeEventListener("resize", handleResize);
      if (unsupportedTimerRef.current) {
        clearTimeout(unsupportedTimerRef.current);
        unsupportedTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      chart.remove();
    };
  }, [symbol, height, themeColor]);

  useEffect(() => {
    setTradeTapeItems([]);
    pendingTradeItemsRef.current = [];
    clearAllTradeItemTimers();

    if (tradeFlushTimerRef.current) {
      clearTimeout(tradeFlushTimerRef.current);
      tradeFlushTimerRef.current = null;
    }
    if (mockTradeTimerRef.current) {
      clearInterval(mockTradeTimerRef.current);
      mockTradeTimerRef.current = null;
    }
    if (mockTradeAutoStopTimerRef.current) {
      clearTimeout(mockTradeAutoStopTimerRef.current);
      mockTradeAutoStopTimerRef.current = null;
    }
    if (tradeReconnectTimeoutRef.current) {
      clearTimeout(tradeReconnectTimeoutRef.current);
      tradeReconnectTimeoutRef.current = null;
    }
    if (tradeWsRef.current) {
      tradeWsRef.current.onclose = null;
      tradeWsRef.current.close();
      tradeWsRef.current = null;
    }

    if (!eventSlug) return;

    let closedByCleanup = false;

    const pushTrade = (side: "BUY" | "SELL", price: number, size: number) => {
      if (!Number.isFinite(price) || !Number.isFinite(size)) return;
      const amount = price * size;
      if (!Number.isFinite(amount) || amount <= 0) return;
      enqueueTradeItem(side, amount);
    };

    if (isMockTradeStreamEnabled()) {
      const stopMockPush = () => {
        if (mockTradeTimerRef.current) {
          clearInterval(mockTradeTimerRef.current);
          mockTradeTimerRef.current = null;
        }
      };

      const pushMockTrade = () => {
        const side: "BUY" | "SELL" = Math.random() > 0.5 ? "BUY" : "SELL";
        const mockPrice = 0.35 + Math.random() * 0.3;
        const mockSize = 2 + Math.random() * 80;
        pushTrade(side, mockPrice, mockSize);
      };

      pushMockTrade();
      mockTradeTimerRef.current = setInterval(
        pushMockTrade,
        MOCK_TRADE_INTERVAL_MS
      );
      const autoStopMs = getMockTradeAutoStopMs();
      if (autoStopMs > 0) {
        mockTradeAutoStopTimerRef.current = setTimeout(() => {
          mockTradeAutoStopTimerRef.current = null;
          stopMockPush();
        }, autoStopMs);
      }

      return () => {
        closedByCleanup = true;
        pendingTradeItemsRef.current = [];
        stopMockPush();
        if (mockTradeAutoStopTimerRef.current) {
          clearTimeout(mockTradeAutoStopTimerRef.current);
          mockTradeAutoStopTimerRef.current = null;
        }
        if (tradeFlushTimerRef.current) {
          clearTimeout(tradeFlushTimerRef.current);
          tradeFlushTimerRef.current = null;
        }
        clearAllTradeItemTimers();
      };
    }

    const connectTradeWs = () => {
      const ws = new WebSocket(process.env.NEXT_PUBLIC_ORDERBOOK_WS_URL!);
      tradeWsRef.current = ws;

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            operation: "subscribe",
            type: "trade_message",
            event_slug: eventSlug,
          })
        );
      };

      ws.onmessage = (event) => {
        if (!event.data || event.data.length === 0) return;

        try {
          const data = JSON.parse(event.data);
          if (data?.type !== "trade_message") return;
          if (data?.side !== "BUY" && data?.side !== "SELL") return;

          pushTrade(data.side, Number(data?.price), Number(data?.size));
        } catch (err) {
          console.error("[LivePriceChart] Trade WS parse error:", err);
        }
      };

      ws.onclose = () => {
        if (closedByCleanup) return;
        tradeReconnectTimeoutRef.current = setTimeout(connectTradeWs, 3000);
      };

      ws.onerror = (err) => {
        console.error("[LivePriceChart] Trade WS error:", err);
        ws.close();
      };
    };

    connectTradeWs();

    return () => {
      closedByCleanup = true;
      pendingTradeItemsRef.current = [];
      if (mockTradeTimerRef.current) {
        clearInterval(mockTradeTimerRef.current);
        mockTradeTimerRef.current = null;
      }
      if (mockTradeAutoStopTimerRef.current) {
        clearTimeout(mockTradeAutoStopTimerRef.current);
        mockTradeAutoStopTimerRef.current = null;
      }
      if (tradeFlushTimerRef.current) {
        clearTimeout(tradeFlushTimerRef.current);
        tradeFlushTimerRef.current = null;
      }
      clearAllTradeItemTimers();
      if (tradeReconnectTimeoutRef.current) {
        clearTimeout(tradeReconnectTimeoutRef.current);
        tradeReconnectTimeoutRef.current = null;
      }
      if (tradeWsRef.current) {
        tradeWsRef.current.onclose = null;
        tradeWsRef.current.close();
        tradeWsRef.current = null;
      }
    };
  }, [clearAllTradeItemTimers, enqueueTradeItem, eventSlug]);

  return (
    <>
      <LivePriceHeader
        isLive={isLive}
        currentPrice={livePrice}
        priceChange={livePriceChange}
        endDate={endDate}
        symbol={symbol}
        frequencySlug={frequencySlug}
        liveMarketSlug={liveMarketSlug}
      />
      <div
        className="relative w-full rounded-xl bg-[var(--bg-primary)] overflow-hidden"
        style={{ height: `${height}px` }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[var(--bg-primary)]/50 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--text-secondary)]" />
          </div>
        )}
        <div
          ref={chartContainerRef}
          style={{ width: "100%", height: "100%" }}
        />
        {tradeTapeItems.length > 0 && (
          <div
            className="absolute left-2 bottom-12 sm:left-3 sm:bottom-3 z-[6] pointer-events-none w-[74px] sm:w-[92px]"
            style={{
              height: `${TRADE_TAPE_ROW_HEIGHT * TRADE_TAPE_MAX_ITEMS}px`,
            }}
          >
            {tradeTapeItems.map((item, index) => {
              const color =
                item.side === "BUY"
                  ? TRADE_TAPE_BUY_COLOR
                  : TRADE_TAPE_SELL_COLOR;
              const baseOpacity = Math.max(0.3, 1 - index * 0.16);
              const opacity = item.exiting ? 0 : item.entered ? baseOpacity : 0;
              const translateY = item.exiting ? -12 : item.entered ? 0 : 10;
              const blur = item.exiting ? "blur(1px)" : "none";
              const motionDuration = item.exiting
                ? TRADE_TAPE_EXIT_DURATION_MS
                : TRADE_TAPE_ENTER_DURATION_MS;

              return (
                <div
                  key={item.id}
                  className="absolute left-0 text-xs sm:text-sm font-semibold leading-none whitespace-nowrap"
                  style={{
                    bottom: `${index * TRADE_TAPE_ROW_HEIGHT}px`,
                    color,
                    opacity,
                    transform: `translateY(${translateY}px)`,
                    filter: blur,
                    textShadow: `0 0 8px ${color}33`,
                    transition: `bottom ${TRADE_TAPE_MOVE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${motionDuration}ms ease, transform ${motionDuration}ms ease, filter ${motionDuration}ms ease`,
                    willChange: "bottom, opacity, transform, filter",
                  }}
                >
                  + ${formatTradeTapeAmount(item.amount)}
                </div>
              );
            })}
          </div>
        )}
        {/* Custom Pulse Dot for End Highlight */}
        <div
          ref={pulseDotRef}
          className="absolute pointer-events-none rounded-full"
          style={{
            width: "12px",
            height: "12px",
            backgroundColor: `${themeColor}66`,
            transform: "translate(-50%, -50%)",
            display: "none",
            zIndex: 5,
          }}
        >
          <div
            className="absolute inset-0 rounded-full animate-ping opacity-75"
            style={{ backgroundColor: themeColor }}
          ></div>
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[6px] h-[6px] rounded-full"
            style={{ backgroundColor: themeColor }}
          ></div>
        </div>
      </div>
    </>
  );
};

export default LivePriceChart;
