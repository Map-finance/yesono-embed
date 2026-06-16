"use client";

/**
 * ShortTermOutcomeGraph - 短期市场(\d+m / \d+h)的 outcome 概率图(对齐 Polymarket 短周期图)
 *
 * 与普通 OutcomeGraph(走 /price-history 聚合曲线)不同:
 * - 数据点是 *每笔实际成交*(/trades1/all 拉历史 + activityWS 接实时),阶梯折线 stepAfter
 * - 一次拉 TRADES_PAGE_LIMIT 条不翻页,X 轴自适应数据范围(显示"最近一段",不强制铺满整窗)
 *
 * 关键口径:
 * - BUY / SELL 两侧 trade.price 都是同一时刻的成交概率,二者都画(不过滤 side)
 * - 过滤 YES 侧优先用 trade.outcome 名(后端 assetId 多为 null),assetId 命中也接受;调用方"不用切"
 * - 窗口 [endDate − 频率长度, endDate] 仅用于过滤(防同 eventId 跨轮 trade 污染),不决定 X 轴显示范围
 * - 时间统一美东时区(与 TimeCapsule / LivePriceChart 一致);结算后(isLive=false)冻结,不接 WS
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import {
  activityWS,
  getAllTrades,
  type TradeMessage,
  type TradeRecord,
} from "@/lib/services/orderBookService";
import { parseShortTermFrequencyMs } from "@/lib/utils/eventFrequency";

const DEFAULT_WINDOW_MS = 60 * 60_000;
// /trades1/all 一次拉 60 条,不翻页(方向 A:显示"最近一段"而非强制铺满整窗)。
// 60 条(up/down 混合)≈ 30 条 up ≈ 最近 ~35 秒活跃成交;X 轴自适应数据范围。
const TRADES_PAGE_LIMIT = 60;
// 对齐 Polymarket 短期市场图配色(蓝色细线 + 末端 dot 光晕)
const CHART_COLOR = "#3b82f6";
const CHART_COLOR_RGB = "59, 130, 246";
// 时间统一用美东时区,与 TimeCapsule / LivePriceChart 对齐(避免本地时区导致刻度错位)
const ET_TIME_ZONE = "America/New_York";

interface ShortTermOutcomeGraphProps {
  /** event 数字 id,/trades1/all 用 */
  eventId: string | number | undefined;
  /** event slug,activityWS.subscribeTradeMessage 用 */
  eventSlug?: string;
  /**
   * 当前 outcome 行 YES 侧的 asset key 候选 — [tokenId, tradingPair]
   * (WS 推送的 trade.assetId 在不同后端实现里可能是其中任一,都收;
   *  注意:/trades1/all 后端目前 assetId 经常返回 null,此时退化到 outcome 名匹配)
   */
  yesAssetCandidates: string[];
  /**
   * 当前 outcome 行 YES 侧的 outcome 名候选(大小写不敏感)
   * — 用于 trade.outcome 字段过滤(如 ["up", "Up", "yes"])
   * 适用于 assetId 为 null 的场景(目前 /trades1/all 接口就是这样)
   */
  yesOutcomeNames?: string[];
  /** 频率 slug(5m / 15m / 1h / 4h),决定窗口长度 */
  frequencySlug?: string;
  /** 市场截止时间(ms) */
  endDateMs?: number;
  /** outcome 名,标题显示 */
  label?: string;
  /** Graph tab 是否可见 — 控制是否拉数据 / 订阅 WS */
  isVisible?: boolean;
  /** 市场是否仍在进行;结算后(false)只用 /trades1/all 接口数据,不再接 WS 实时成交 */
  isLive?: boolean;
}

const ShortTermOutcomeGraph: React.FC<ShortTermOutcomeGraphProps> = ({
  eventId,
  eventSlug,
  yesAssetCandidates,
  yesOutcomeNames,
  frequencySlug,
  endDateMs,
  label,
  isVisible = true,
  isLive = true,
}) => {
  const { t } = useTranslation();
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // 窗口 [start, end] — start 由 endDate 反推频率长度(slug 不识别时默认 1h)
  const windowStartMs = useMemo(() => {
    if (!endDateMs) return null;
    const span = parseShortTermFrequencyMs(frequencySlug) ?? DEFAULT_WINDOW_MS;
    return endDateMs - span;
  }, [endDateMs, frequencySlug]);

  // 用 ref 锁住数组,避免引用变化触发 effect 重跑(同 SpotOrderbook 套路)
  const assetCandidatesRef = useRef<string[]>([]);
  assetCandidatesRef.current = yesAssetCandidates;
  // outcome 名候选(小写化一次,过滤时直接比对)
  const outcomeNamesLowerRef = useRef<string[]>([]);
  outcomeNamesLowerRef.current = (yesOutcomeNames ?? [])
    .filter(Boolean)
    .map((n) => String(n).toLowerCase());

  /**
   * 判断一条 trade 是否属于"YES 侧"且落在窗口内。
   * - 优先用 outcome 名匹配(后端 /trades1/all 当前 assetId 多为 null,assetId 不可靠)
   * - assetId 命中也接受(WS 推送的 trade 在某些后端实现里有 assetId)
   * - 两组候选都为空时不过滤(全收;一般是 props 还没就位)
   */
  const matchYesSide = (
    outcome: string | undefined | null,
    assetId: string | undefined | null
  ): boolean => {
    const names = outcomeNamesLowerRef.current;
    const cands = assetCandidatesRef.current;
    if (names.length === 0 && cands.length === 0) return true;
    if (
      names.length > 0 &&
      outcome &&
      names.includes(String(outcome).toLowerCase())
    )
      return true;
    if (cands.length > 0 && assetId && cands.includes(String(assetId)))
      return true;
    return false;
  };

  // 拉历史:单次拉 TRADES_PAGE_LIMIT 条,不翻页(首屏快;X 轴自适应数据范围)
  useEffect(() => {
    if (!isVisible || !eventId || windowStartMs == null) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      const resp = await getAllTrades(
        String(eventId),
        TRADES_PAGE_LIMIT,
        0,
        1
      );
      if (cancelled) return;
      if (!resp.success || !Array.isArray(resp.data)) {
        setTrades([]);
        setLoading(false);
        return;
      }
      // 后端 timestamp 是字符串("1779934102783"),显式转 number 防比较 / 图表 axis 出错
      const filtered = resp.data
        .map((r) => ({ ...r, timestamp: Number(r.timestamp) || 0 }))
        .filter((tr) => {
          if (!matchYesSide(tr.outcome, tr.assetId)) return false;
          if (tr.timestamp < windowStartMs) return false;
          if (endDateMs != null && tr.timestamp > endDateMs) return false;
          return true;
        });
      setTrades(filtered);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [eventId, windowStartMs, endDateMs, isVisible]);

  // 实时:activityWS trade_message append(过滤同 assetId + 落窗口内)
  // 结算后(isLive=false)不订阅 —— 图冻结在历史接口数据上
  useEffect(() => {
    if (!isVisible || !eventSlug || !isLive) return;

    const handler = (msg: TradeMessage) => {
      if (!matchYesSide(msg.outcome, msg.assetId)) return;
      const ts = Number(msg.timestamp) || 0;
      if (windowStartMs != null && ts < windowStartMs) return;
      if (endDateMs != null && ts > endDateMs) return;
      setTrades((prev) => [
        ...prev,
        {
          userId: msg.userId,
          name: msg.name,
          profileImage: msg.profileImage,
          outcome: msg.outcome,
          price: msg.price,
          side: msg.side,
          size: msg.size,
          timestamp: ts,
          assetId: msg.assetId,
          hash: msg.hash,
        },
      ]);
    };

    activityWS.addHandler("trade_message", handler);
    // refCount 自管,与 useActivity / useSessionTradeVolume 共用同一条 WS 订阅
    activityWS.subscribeTradeMessage(eventSlug).catch(() => {});

    return () => {
      activityWS.removeHandler("trade_message", handler);
      activityWS.unsubscribeTradeMessage(eventSlug);
    };
  }, [eventSlug, isVisible, isLive, windowStartMs, endDateMs]);

  // 排序 + 去重 + 映射成 chart 点
  const chartData = useMemo(() => {
    const sorted = [...trades].sort((a, b) => a.timestamp - b.timestamp);
    const seen = new Set<string>();
    return sorted
      .filter((tr) => {
        // 优先 hash 去重(链上唯一);无 hash 则用 timestamp+price+userId 组合兜底
        const key =
          tr.hash || `${tr.timestamp}-${tr.price}-${tr.userId}-${tr.size}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((tr) => ({
        timestamp: tr.timestamp,
        value: tr.price * 100, // ratio 0-1 → 概率 0-100
      }));
  }, [trades]);

  // ============== 标题 chance 显示(hover 时跟随更新,DOM 级,不触发 React 重渲染) ==============
  const chanceRef = useRef<HTMLDivElement>(null);
  const prevChanceValRef = useRef<{ current: number; change: number }>({
    current: -1,
    change: 0,
  });

  // 默认 chance = 末尾值 + 相对图起点的变化
  const defaultChance = useMemo(() => {
    if (chartData.length === 0) return null;
    const last = chartData[chartData.length - 1].value;
    const first = chartData[0].value;
    return { current: Math.round(last), change: Math.round(last - first) };
  }, [chartData]);

  const updateChanceDOM = useCallback(
    (current: number, change: number) => {
      const el = chanceRef.current;
      if (!el) return;
      const changeColor =
        change > 0 ? "var(--green)" : change < 0 ? "var(--red)" : "transparent";
      const arrow = change > 0 ? "▲" : change < 0 ? "▼" : "";
      const changeText =
        change !== 0 ? `${arrow} ${Math.abs(change)}%` : "";
      const prev = prevChanceValRef.current;
      const valAnim =
        prev.current !== current ? "animation:chanceSlideIn .25s ease-out" : "";
      const chgAnim =
        prev.change !== change ? "animation:chanceSlideIn .25s ease-out" : "";
      prevChanceValRef.current = { current, change };
      const fs = "font-size:clamp(20px,2.4vw,28px)";

      el.replaceChildren();

      const wrapVal = document.createElement("span");
      wrapVal.style.cssText =
        "display:inline-block;overflow:hidden;vertical-align:bottom;height:2.4em";
      const valSpan = document.createElement("span");
      valSpan.style.cssText = `display:inline-block;${fs};font-weight:700;color:${CHART_COLOR};${valAnim}`;
      valSpan.textContent = `${current}%`;
      wrapVal.appendChild(valSpan);

      const chanceLabel = document.createElement("span");
      chanceLabel.style.cssText = `${fs};font-weight:700;color:${CHART_COLOR};margin:0 6px`;
      chanceLabel.textContent = t.market.chance;

      const wrapChg = document.createElement("span");
      wrapChg.style.cssText =
        "display:inline-block;overflow:hidden;vertical-align:bottom;height:1.4em;min-width:55px";
      const chgSpan = document.createElement("span");
      chgSpan.style.cssText = `display:inline-block;font-size:13px;font-weight:600;color:${changeColor};${chgAnim}`;
      chgSpan.textContent = changeText;
      wrapChg.appendChild(chgSpan);

      el.appendChild(wrapVal);
      el.appendChild(chanceLabel);
      el.appendChild(wrapChg);
    },
    [t.market.chance]
  );

  // 数据变化时把标题重置到默认 chance(末尾值)
  useEffect(() => {
    if (defaultChance) updateChanceDOM(defaultChance.current, defaultChance.change);
  }, [defaultChance, updateChanceDOM]);

  // ============== hover: cursor 垂直虚线 + tooltip + 标题跟随 ==============
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const activeIdxRef = useRef<number>(-1);

  // 图表内容区水平 padding(与 LineChart margin 对齐:left=5, right=35 留给右 YAxis)
  const CHART_LEFT = 5;
  const CHART_RIGHT_PAD = 35;

  const handleChartMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = chartContainerRef.current;
      const tooltip = tooltipRef.current;
      const cursor = cursorRef.current;
      if (
        !container ||
        !tooltip ||
        !cursor ||
        !chartData ||
        chartData.length === 0
      )
        return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const chartRight = rect.width - CHART_RIGHT_PAD;
      const chartWidth = chartRight - CHART_LEFT;

      if (mouseX < CHART_LEFT || mouseX > chartRight || chartWidth <= 0) {
        tooltip.style.display = "none";
        cursor.style.display = "none";
        activeIdxRef.current = -1;
        if (defaultChance)
          updateChanceDOM(defaultChance.current, defaultChance.change);
        return;
      }

      const ratio = (mouseX - CHART_LEFT) / chartWidth;
      const idx = Math.max(
        0,
        Math.min(
          chartData.length - 1,
          Math.round(ratio * (chartData.length - 1))
        )
      );
      if (idx === activeIdxRef.current) return;
      activeIdxRef.current = idx;

      const point = chartData[idx];
      const pointX =
        CHART_LEFT + (idx / Math.max(chartData.length - 1, 1)) * chartWidth;

      cursor.style.display = "block";
      cursor.style.left = `${pointX}px`;

      // tooltip:时间 + label + 概率(ET 时区,带秒)
      tooltip.replaceChildren();
      const timeStr = new Date(point.timestamp).toLocaleString("en-GB", {
        timeZone: ET_TIME_ZONE,
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const timeRow = document.createElement("div");
      timeRow.style.cssText =
        "font-size:11px;color:var(--text-tertiary);margin-bottom:6px;padding-bottom:5px;border-bottom:1px solid var(--border)";
      timeRow.textContent = timeStr;
      tooltip.appendChild(timeRow);

      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px";
      const bar = document.createElement("span");
      bar.style.cssText = `width:3px;height:12px;background:${CHART_COLOR};border-radius:1px`;
      const text = document.createElement("span");
      text.style.cssText =
        "font-size:13px;font-weight:600;color:var(--text-primary)";
      text.textContent = `${label || "Up"} ${Math.round(point.value)}%`;
      row.appendChild(bar);
      row.appendChild(text);
      tooltip.appendChild(row);
      tooltip.style.display = "block";

      const tw = tooltip.offsetWidth || 140;
      let tx = pointX + 12;
      if (tx + tw > rect.width) tx = pointX - tw - 12;
      tooltip.style.left = `${tx}px`;
      tooltip.style.top = `${Math.max(10, mouseY - 30)}px`;

      // 标题概率跟随 hover 点
      const curRounded = Math.round(point.value);
      const baseFirst =
        chartData.length > 0 ? Math.round(chartData[0].value) : curRounded;
      updateChanceDOM(curRounded, curRounded - baseFirst);
    },
    [chartData, label, defaultChance, updateChanceDOM]
  );

  const handleChartMouseLeave = useCallback(() => {
    if (tooltipRef.current) tooltipRef.current.style.display = "none";
    if (cursorRef.current) cursorRef.current.style.display = "none";
    activeIdxRef.current = -1;
    if (defaultChance) updateChanceDOM(defaultChance.current, defaultChance.change);
  }, [defaultChance, updateChanceDOM]);

  // ============== 末端 dot(Polymarket 风格:最后一个点圆点 + 光晕) ==============
  const lastDot = useCallback(
    (props: any): React.ReactElement | null => {
      const { cx, cy, index } = props;
      if (chartData.length > 0 && index === chartData.length - 1) {
        return <circle cx={cx} cy={cy} r={4.5} fill={CHART_COLOR} />;
      }
      return null;
    },
    [chartData.length]
  );

  // X 轴刻度:ET 时区 + HH:MM:SS(24h),与 LivePriceChart 刻度风格一致
  const tickFormatter = useCallback((ts: number) => {
    return new Date(ts).toLocaleTimeString("en-GB", {
      timeZone: ET_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }, []);

  // path / dot 加蓝色发光,跟 OutcomeGraph 风格一致
  const glowStyles = `
    path[stroke="${CHART_COLOR}"] { filter: drop-shadow(rgb(${CHART_COLOR_RGB}) 0px 0px 6px) drop-shadow(rgb(${CHART_COLOR_RGB}) 0px 0px 3px) !important; }
    circle[fill="${CHART_COLOR}"] { filter: drop-shadow(rgb(${CHART_COLOR_RGB}) 0px 0px 8px) drop-shadow(rgb(${CHART_COLOR_RGB}) 0px 0px 4px) !important; }
    @keyframes chanceSlideIn { 0% { transform:translateY(100%); opacity:0; } 100% { transform:translateY(0); opacity:1; } }
  `;

  return (
    <div className="rounded-xl p-4">
      {/* 标题:小字 label + 大字 chance%(hover 时 DOM 跟随更新) */}
      {label && (
        <div
          className="text-xs font-medium mb-1 uppercase tracking-wide"
          style={{ color: CHART_COLOR, opacity: 0.85 }}
        >
          {label}
        </div>
      )}
      <div ref={chanceRef} className="flex items-baseline gap-1 mb-3" />

      <div
        ref={chartContainerRef}
        className="relative"
        style={{ height: "320px" }}
      >
        <style dangerouslySetInnerHTML={{ __html: glowStyles }} />
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--text-secondary)]" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-sm">
            {t.market.common.noData}
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 35, left: 5, bottom: 5 }}
              >
                <CartesianGrid
                  stroke="var(--border-light)"
                  strokeOpacity={0.35}
                  strokeDasharray="3 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  stroke="transparent"
                  tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={tickFormatter}
                  minTickGap={50}
                />
                <YAxis
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fill: "var(--text-tertiary)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                  tickCount={6}
                />
                <Line
                  type="stepAfter"
                  dataKey="value"
                  stroke={CHART_COLOR}
                  strokeWidth={2}
                  dot={lastDot}
                  activeDot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* 透明遮罩拦截鼠标(避免 recharts 内部 re-render) */}
            <div
              className="absolute inset-0 z-10"
              onMouseMove={handleChartMouseMove}
              onMouseLeave={handleChartMouseLeave}
            />

            {/* hover cursor 竖虚线 */}
            <div
              ref={cursorRef}
              className="absolute pointer-events-none z-20"
              style={{
                display: "none",
                top: 10,
                bottom: 25,
                width: 0,
                borderLeft: "1px dashed var(--text-tertiary)",
              }}
            />

            {/* hover tooltip */}
            <div
              ref={tooltipRef}
              className="absolute pointer-events-none z-20 border bg-[var(--bg-primary)] border-[var(--border)] rounded-lg px-3 py-2 shadow-xl min-w-[120px]"
              style={{ display: "none" }}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default React.memo(ShortTermOutcomeGraph);
