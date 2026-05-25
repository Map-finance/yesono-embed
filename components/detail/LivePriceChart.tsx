import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  Time,
  CrosshairMode,
  AreaSeries,
  LineType,
} from "lightweight-charts";
import { Loader2 } from "lucide-react";
import { getAssetColor } from "@/utils/format";
import { useLivePriceFeed } from "@/lib/hooks/use-live-price-feed";
import { useTradeTapeFeed } from "@/lib/hooks/use-trade-tape-feed";
import type { PricePoint } from "@/lib/services/live-price-ws";
import { useEventSettlementPrices } from "@/lib/hooks/useEventSettlementPrices";
import { getMarketClosePrice } from "@/lib/api";
import LivePriceHeader from "./LivePriceHeader";

type Point = PricePoint;

/**
 * 市场结束后，把折线图序列"冻结"到结算时刻：
 * - 数据若跨越 endDate：丢弃 endDate 之后的点，末点锚定到收盘价 closePrice，
 *   让图收尾正好停在 Final price。
 * - 数据若整段在 endDate 之后（WS 对老市场返回近端滚动价、给不出市场时间窗）：
 *   不截断、不锚定，原样返回——避免清空图表（调用方仍会停掉实时更新）。
 */
function buildFrozenSeries(
  data: Point[],
  endDateMs: number | undefined,
  closePrice: number | null
): Point[] {
  if (data.length === 0) return data;
  const endSec = endDateMs ? Math.floor(endDateMs / 1000) : null;
  if (endSec === null) return data;
  const truncated = data.filter((p) => (p.time as number) <= endSec);
  if (truncated.length === 0) return data;
  if (closePrice === null) return truncated;
  const copy = truncated.slice();
  const lastTime = copy[copy.length - 1].time as number;
  if (lastTime >= endSec) {
    copy[copy.length - 1] = { time: lastTime as Time, value: closePrice };
  } else {
    copy.push({ time: endSec as Time, value: closePrice });
  }
  return copy;
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
  /** 事件 ID：WS 实时价订阅键 + 传给 LivePriceHeader 拉取开盘价 / 收盘价 */
  eventId?: string | number;
  /** 金融（objective）事件：WS 用 objectivePrice 订阅，否则 cryptoPrice */
  isFinance?: boolean;
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

const ET_TIME_ZONE = "America/New_York";

/**
 * 将 Date 按美东时区拆为各时间字段（数值字段无前导零，与原 getHours/getMonth 行为一致）。
 * 用于图表轴/十字线统一显示美东时间，避免使用浏览器本地时区造成与 TimeCapsule 错位。
 */
function getEtTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";
  return {
    year: get("year"),
    month: String(Number(get("month"))),
    day: String(Number(get("day"))),
    hour: String(Number(get("hour"))),
    minute: get("minute"),
    second: get("second"),
  };
}

export const LivePriceChart: React.FC<LivePriceChartProps> = ({
  symbol = "eth/usd",
  eventSlug,
  eventId,
  isFinance = false,
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
  const updatePulseDotRef = useRef<() => void>(() => {});
  const tradeFlushTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mockTradeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mockTradeAutoStopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tradeEnterTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const tradeExitTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const tradeRemoveTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pendingTradeItemsRef = useRef<TradeTapeItem[]>([]);
  const tradeSeqRef = useRef(0);
  const basePriceRef = useRef<number | null>(null);
  const onPriceUpdateRef = useRef(onPriceUpdate);
  const onUnsupportedRef = useRef(onUnsupported);

  // —— 结束后冻结相关：供 feed 回调闭包读取最新值 ——
  const isLiveRef = useRef(isLive);
  const openPriceRef = useRef<number | null>(null);
  const closePriceRef = useRef<number | null>(null);
  const endDateRef = useRef<number | undefined>(endDate);
  // 已结算事件的结算时间窗价格序列（来自 /market/close-price），结束后折线图的权威数据源
  const closeSeriesRef = useRef<Point[] | null>(null);

  // 结算价（开盘/收盘）：结束后用于折线图末点锚定 + 头部冻结涨跌幅，与 LivePriceHeader 同源
  const { openPrice, closePrice } = useEventSettlementPrices(eventId, !isLive);

  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);
  useEffect(() => {
    openPriceRef.current = openPrice;
  }, [openPrice]);
  useEffect(() => {
    closePriceRef.current = closePrice;
  }, [closePrice]);
  useEffect(() => {
    endDateRef.current = endDate;
  }, [endDate]);

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
        // 纵轴上下留边距，出现新高/新低时不会整条线猛跳
        scaleMargins: { top: 0.15, bottom: 0.2 },
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: true,
        // 右侧留白，最新点/光点浮在离右边缘有段距离的位置，不贴边
        rightOffset: 6,
        tickMarkFormatter: (time: number) => {
          const p = getEtTimeParts(new Date(time * 1000));
          return `${p.hour}:${p.minute}:${p.second}`;
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
          const p = getEtTimeParts(new Date(time * 1000));
          return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}:${p.second}`;
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
      lineType: LineType.Curved, // 平滑曲线，避免稀疏数据的硬折线/锯齿
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

    // 让外层 hooks 可以触发 pulse dot 重绘
    updatePulseDotRef.current = updatePulseDot;

    // 2. Responsive Resize（WebSocket 已迁出到 §6.1 manager + hooks）
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
        updatePulseDot();
      }
    };
    window.addEventListener("resize", handleResize);

    // 3. Cleanup
    return () => {
      window.removeEventListener("resize", handleResize);
      updatePulseDotRef.current = () => {};
      seriesRef.current = null;
      chartRef.current = null;
      chart.remove();
    };
  }, [symbol, height, themeColor]);

  // ============== Live price feed（替换原组件内 new WebSocket） ==============
  // 按 eventId 订阅：finance 用 objectivePrice，其余用 cryptoPrice
  useLivePriceFeed(eventId, isFinance ? "finance" : "crypto", {
    onSnapshot: (points) => {
      const series = seriesRef.current;
      if (!series || points.length === 0) return;
      basePriceRef.current = points[0].value;

      // 已结束：只认 close-price（/market/close-price）权威序列。WS 对老市场返回的是
      // "近端滚动数据"（时间窗随 now 漂移），渲染它会导致刷新后时间轴乱跳、与接口数据不符。
      // close-price 尚未就绪时先不画（finalData=null），交给下方 close-price effect 渲染。
      const ended = !isLiveRef.current;
      const finalData: Point[] | null = ended
        ? closeSeriesRef.current?.length
          ? closeSeriesRef.current
          : null
        : points;

      if (ended) {
        // 冻结涨跌幅 = 收盘价 − 开盘价（口径对齐 Price to beat / Final price）
        const base = openPriceRef.current ?? basePriceRef.current;
        const last =
          closePriceRef.current ??
          finalData?.[finalData.length - 1]?.value ??
          base;
        setLivePrice(last);
        setLivePriceChange(last - base);
        onPriceUpdateRef.current?.(last, last - base);
      } else {
        const last = points[points.length - 1];
        const change = last.value - basePriceRef.current;
        setLivePrice(last.value);
        setLivePriceChange(change);
        onPriceUpdateRef.current?.(last.value, change);
      }

      // finalData 为 null（已结束但 close-price 尚未就绪）时不渲染，避免画出 WS 近端
      // 漂移数据；close-price effect 就绪后会补上权威序列
      if (finalData) {
        series.setData(finalData);
        chartRef.current?.timeScale().fitContent();
      }
      setLoading(false);
      updatePulseDotRef.current();
    },
    onUpdate: (point) => {
      // 市场已结束：忽略实时更新，折线图冻结在结算时刻
      if (!isLiveRef.current) return;
      const series = seriesRef.current;
      if (!series) return;
      series.update(point);
      if (basePriceRef.current !== null) {
        const change = point.value - basePriceRef.current;
        setLivePrice(point.value);
        setLivePriceChange(change);
        onPriceUpdateRef.current?.(point.value, change);
      }
      updatePulseDotRef.current();
    },
    onUnsupported: () => {
      onUnsupportedRef.current?.();
    },
  });

  // 已结算事件：拉结算时间窗价格序列（/market/close-price）作为折线图权威数据源，
  // 刷新后也能精确显示该市场时段走势。WS 对老市场返回近端滚动数据不可靠，故结束后优先用它。
  useEffect(() => {
    if (isLive || !eventId) {
      closeSeriesRef.current = null;
      return;
    }
    let cancelled = false;
    getMarketClosePrice(eventId)
      .then((resp) => {
        if (cancelled) return;
        // 后端返回 data 是对象，价格序列在 data.prices；兼容老形态（data 直接是数组）
        const d: any = resp?.data;
        const raw: { timestamp: number; value: number }[] = Array.isArray(
          d?.prices
        )
          ? d.prices
          : Array.isArray(d)
            ? d
            : [];
        if (raw.length === 0) return;
        const pts: Point[] = raw
          .map((p) => {
            const ts = Number(p.timestamp);
            const sec = ts >= 1e12 ? Math.floor(ts / 1000) : ts; // 兼容 ms / s
            return { time: sec as Time, value: Number(p.value) };
          })
          .filter(
            (p) => Number.isFinite(p.time as number) && Number.isFinite(p.value)
          )
          .sort((a, b) => (a.time as number) - (b.time as number))
          .filter((p, i, self) => i === 0 || p.time !== self[i - 1].time);
        if (pts.length === 0) return;
        closeSeriesRef.current = pts;
        if (seriesRef.current) {
          seriesRef.current.setData(pts);
          chartRef.current?.timeScale().fitContent();
          updatePulseDotRef.current();
        }
      })
      .catch((e) => console.warn("[LivePriceChart] close-price 拉取失败", e));
    return () => {
      cancelled = true;
    };
  }, [isLive, eventId]);

  // 收盘价/结算价（数字）迟到：刷新 Final price 与冻结涨跌幅。折线若已有 close-price
  // 权威序列则不动它；否则把已渲染的 WS 数据冻结（截断+锚定）到结算时刻作兜底。
  useEffect(() => {
    if (isLive || closePrice === null) return;
    const base = openPrice ?? basePriceRef.current ?? closePrice;
    setLivePrice(closePrice);
    setLivePriceChange(closePrice - base);
    onPriceUpdateRef.current?.(closePrice, closePrice - base);
    const series = seriesRef.current;
    if (!series) return;
    if (closeSeriesRef.current?.length) {
      updatePulseDotRef.current();
      return;
    }
    const data = series.data() as Point[];
    if (!data || data.length === 0) return;
    series.setData(buildFrozenSeries(data, endDate, closePrice));
    chartRef.current?.timeScale().fitContent();
    updatePulseDotRef.current();
  }, [isLive, closePrice, openPrice, endDate]);

  // 共享 trade pushTrade，给 mock 模式 + 真实流复用
  const pushTrade = useCallback(
    (side: "BUY" | "SELL", price: number, size: number) => {
      if (!Number.isFinite(price) || !Number.isFinite(size)) return;
      const amount = price * size;
      if (!Number.isFinite(amount) || amount <= 0) return;
      enqueueTradeItem(side, amount);
    },
    [enqueueTradeItem]
  );

  // mock 模式开关：在客户端 mount 后才能从 location/localStorage 读
  const [mockEnabled, setMockEnabled] = useState(false);
  useEffect(() => {
    setMockEnabled(isMockTradeStreamEnabled());
  }, []);

  // symbol/eventSlug 切换或卸载时清空 trade tape 显示与定时器
  useEffect(() => {
    setTradeTapeItems([]);
    pendingTradeItemsRef.current = [];
    clearAllTradeItemTimers();
    if (tradeFlushTimerRef.current) {
      clearTimeout(tradeFlushTimerRef.current);
      tradeFlushTimerRef.current = null;
    }
    return () => {
      pendingTradeItemsRef.current = [];
      if (tradeFlushTimerRef.current) {
        clearTimeout(tradeFlushTimerRef.current);
        tradeFlushTimerRef.current = null;
      }
      clearAllTradeItemTimers();
    };
  }, [eventSlug, clearAllTradeItemTimers]);

  // mock 模式：定时推假 trade（不走 WS）
  useEffect(() => {
    if (!mockEnabled || !eventSlug) return;

    const pushMockTrade = () => {
      const side: "BUY" | "SELL" = Math.random() > 0.5 ? "BUY" : "SELL";
      const mockPrice = 0.35 + Math.random() * 0.3;
      const mockSize = 2 + Math.random() * 80;
      pushTrade(side, mockPrice, mockSize);
    };

    pushMockTrade();
    mockTradeTimerRef.current = setInterval(pushMockTrade, MOCK_TRADE_INTERVAL_MS);

    const autoStopMs = getMockTradeAutoStopMs();
    if (autoStopMs > 0) {
      mockTradeAutoStopTimerRef.current = setTimeout(() => {
        mockTradeAutoStopTimerRef.current = null;
        if (mockTradeTimerRef.current) {
          clearInterval(mockTradeTimerRef.current);
          mockTradeTimerRef.current = null;
        }
      }, autoStopMs);
    }

    return () => {
      if (mockTradeTimerRef.current) {
        clearInterval(mockTradeTimerRef.current);
        mockTradeTimerRef.current = null;
      }
      if (mockTradeAutoStopTimerRef.current) {
        clearTimeout(mockTradeAutoStopTimerRef.current);
        mockTradeAutoStopTimerRef.current = null;
      }
    };
  }, [mockEnabled, eventSlug, pushTrade]);

  // 真实 trade 流：mock 关闭时才订阅
  useTradeTapeFeed(
    eventSlug,
    useMemo(() => ({ onTrade: pushTrade }), [pushTrade]),
    !mockEnabled
  );

  return (
    <>
      <LivePriceHeader
        isLive={isLive}
        currentPrice={livePrice}
        priceChange={livePriceChange}
        priceToBeat={openPrice}
        finalPrice={closePrice}
        endDate={endDate}
        symbol={symbol}
        frequencySlug={frequencySlug}
        liveMarketSlug={liveMarketSlug}
      />
      <div
        className="relative w-full rounded-xl bg-(--bg-primary) overflow-hidden"
        style={{ height: `${height}px` }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-(--bg-primary)/50 backdrop-blur-xs">
            <Loader2 className="w-8 h-8 animate-spin text-(--text-secondary)" />
          </div>
        )}
        <div
          ref={chartContainerRef}
          style={{ width: "100%", height: "100%" }}
        />
        {tradeTapeItems.length > 0 && (
          <div
            className="absolute left-2 bottom-12 sm:left-3 sm:bottom-3 z-6 pointer-events-none w-[74px] sm:w-[92px]"
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
          {/* 进行中才脉冲；已结束为静态点（收尾停在结算价） */}
          {isLive && (
            <div
              className="absolute inset-0 rounded-full animate-ping opacity-75"
              style={{ backgroundColor: themeColor }}
            ></div>
          )}
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
