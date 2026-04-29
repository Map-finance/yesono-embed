"use client";

import ProxyImage from "@/components/common/ProxyImage";
import Tabs from "@/components/ui/Tabs";
import { useTranslation } from "@/lib/i18n";
import { UserInfo } from "@/lib/types";
import NumberFlow from "@number-flow/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from "recharts";
import PositionsTab from "./components/PositionsTab";
import ActivityTable from "./components/ActivityTable";
import OpenOrdersTab from "./components/OpenOrdersTab";
import MarketRecordsTab from "./components/MarketRecordsTab";
import AsianHandicapOrders from "./components/AsianHandicapOrders";
import { useHybridSmartAccount } from "@/lib/hooks/useHybridSmartAccount";
import { useAuthStore } from "@/lib/stores/authStore";
import { getUserProfileUserInfo, getUserOrderSummary } from "@/lib/api";
import { usePortfolioStore } from "@/lib/stores/portfolioStore";
import useProfitLossChart from "./hooks/useProfitLossChart";


// 图表颜色配置
const chartColor = "#ED6432";
const chartColorRGB = "237, 100, 50";

const TAB_PARAM_MAP: Record<string, string> = {
  orders: "AsianHandicapOrders",
  positions: "Positions",
  activity: "Activity",
  records: "MarketRecords",
};

const ProfileView: React.FC = () => {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  // 支持 URL 参数指定默认 tab，如 /pna?tab=orders
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(() => {
    return (tabParam && TAB_PARAM_MAP[tabParam]) || "Positions";
  });
  const { user: backendUser } = useAuthStore();
  const { smartAccount } = useHybridSmartAccount();

  const routeUserId = useMemo(
    () => (searchParams.get("userId") || "").trim(),
    [searchParams]
  );
  const currentUserId = useMemo(
    () => (backendUser?.userId || "").trim(),
    [backendUser?.userId]
  );
  const targetUserId = useMemo(
    () => routeUserId || currentUserId,
    [routeUserId, currentUserId]
  );
  const isViewingOtherUser = useMemo(() => {
    return false;
  }, []);

  const [otherUserProfile, setOtherUserProfile] = useState<UserInfo | null>(
    null
  );
  const [positionMode, setPositionMode] = useState<"yesNo" | "asian">(
    tabParam === "orders" ? "asian" : "yesNo"
  );
  const [asianSummary, setAsianSummary] = useState<{
    marketCounts: string;
    marketValues: string;
  } | null>(null);
  const [asianSummaryLoading, setAsianSummaryLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!isViewingOtherUser || !targetUserId) {
      setOtherUserProfile(null);
      return () => {
        cancelled = true;
      };
    }

    const fetchOtherUserProfile = async () => {
      try {
        const res = await getUserProfileUserInfo(targetUserId);
        const data = (res as any)?.data;
        if (!cancelled && data) {
          setOtherUserProfile({
            ...data,
            userId: String(data.userId ?? targetUserId),
          });
        }
      } catch (error) {
        console.error("[PNA] Failed to fetch other user profile:", error);
        if (!cancelled) {
          setOtherUserProfile(null);
        }
      }
    };

    fetchOtherUserProfile();

    return () => {
      cancelled = true;
    };
  }, [isViewingOtherUser, targetUserId]);

  const profileUser = useMemo(
    () => (isViewingOtherUser ? otherUserProfile : backendUser),
    [isViewingOtherUser, otherUserProfile, backendUser]
  );

  // 计算显示名称
  const userDisplayName = useMemo(() => {
    if (!profileUser) return targetUserId || "";
    return profileUser.username || profileUser.displayName || targetUserId || "";
  }, [profileUser, targetUserId]);

  // 显示地址
  const displayAddress = useMemo(() => {
    if (profileUser?.smartAccountAddress) return profileUser.smartAccountAddress;
    if (isViewingOtherUser) return targetUserId || "";
    return (
      profileUser?.smartAccountAddress ||
      (smartAccount?.address as string) ||
      ""
    );
  }, [profileUser, smartAccount, isViewingOtherUser, targetUserId]);

  // 生成用户头像（基于地址或名称）
  const avatarGradient = useMemo(() => {
    const seed = displayAddress || userDisplayName || "user";
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const gradients = [
      "from-purple-500 to-orange-500",
      "from-pink-500 to-purple-500",
      "from-indigo-500 to-purple-500",
      "from-cyan-500 to-blue-500",
    ];
    return gradients[Math.abs(hash) % gradients.length];
  }, [displayAddress, userDisplayName]);

  const avatarLetter = useMemo(() => {
    return userDisplayName
      ? userDisplayName.charAt(0).toUpperCase()
      : displayAddress
        ? displayAddress.slice(2, 3).toUpperCase()
        : "U";
  }, [userDisplayName, displayAddress]);

  const formattedJoinedDate = useMemo(() => {
    if (!profileUser?.joinedDate) return "Oct 2025";
    try {
      const date = new Date(profileUser.joinedDate);
      return date.toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });
    } catch (e) {
      console.warn('[PnaPage] Failed to format joined date', e);
      return profileUser.joinedDate;
    }
  }, [profileUser]);

  const { portfolio: portfolioTotal, cash: cashTotal } = usePortfolioStore();
  const positionsValue = portfolioTotal - cashTotal;

  const fetchAsianSummary = useCallback(async () => {
    setAsianSummaryLoading(true);
    try {
      const summaryUserId = isViewingOtherUser ? targetUserId : undefined;
      const res = await getUserOrderSummary(summaryUserId || undefined);
      if (res?.success && res?.data) {
        setAsianSummary({
          marketCounts: String(res.data.marketCounts ?? "0"),
          marketValues: String(res.data.marketValues ?? "0"),
        });
      } else {
        setAsianSummary({ marketCounts: "0", marketValues: "0" });
      }
    } catch (e) {
      console.warn('[PnaPage] Failed to fetch Asian summary', e);
      setAsianSummary({ marketCounts: "0", marketValues: "0" });
    } finally {
      setAsianSummaryLoading(false);
    }
  }, [isViewingOtherUser, targetUserId]);

  useEffect(() => {
    if (positionMode !== "asian") return;
    fetchAsianSummary();
  }, [positionMode, fetchAsianSummary]);

  // 根据顶部 Yes/No / 亚盘 切换，自动调整下方激活的 Tab，避免选中不存在的 Tab
  useEffect(() => {
    if (isViewingOtherUser) return;
    if (positionMode === "asian") {
      // 顶部选中“亚盘”时，只展示亚盘订单 Tab
      if (activeTab !== "AsianHandicapOrders") {
        setActiveTab("AsianHandicapOrders");
      }
    } else {
      // 顶部选中 Yes/No 时，隐藏亚盘订单，如果当前在该 Tab，则切回持仓
      if (activeTab === "AsianHandicapOrders") {
        setActiveTab("Positions");
      }
    }
  }, [positionMode, isViewingOtherUser, activeTab]);

  const [timeRange, setTimeRange] = useState("1D");
  const { chartData, isLoading: isChartLoading } = useProfitLossChart(timeRange, targetUserId || undefined);
  const [mounted, setMounted] = useState(false);

  // 新增：悬浮数据状态
  const [hoveredData, setHoveredData] = useState<{
    val: number;
    fullTime: string;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setHoveredData(null);
  }, [timeRange]);

  // 获取时间范围文字
  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case "1D":
        return t.pna.timeRange.pastDay;
      case "1W":
        return t.pna.timeRange.pastWeek;
      case "1M":
        return t.pna.timeRange.pastMonth;
      case "ALL":
        return t.pna.timeRange.allTime;
      default:
        return t.pna.timeRange.pastDay;
    }
  };

  // 当前显示的值（悬浮时显示悬浮值，否则显示最后一个值）
  const currentValue =
    hoveredData?.val ?? chartData[chartData.length - 1]?.val ?? 0;
  const currentTime = hoveredData?.fullTime ?? getTimeRangeLabel();
  const isPositive = currentValue >= 0;

  const glowStyles = `
  path[stroke="${chartColor}"] {
    filter: drop-shadow(rgb(${chartColorRGB}) 0px 0px 8px) drop-shadow(rgb(${chartColorRGB}) 0px 0px 4px) !important;
  }
`;

  // 鼠标离开图表时清空悬浮数据
  const handleChartMouseLeave = useCallback(() => {
    setHoveredData((prev) => (prev ? null : prev));
  }, []);

  // 自定义 Tooltip：取到悬浮数据点后**通过 useEffect 延迟 setState**，
  // 避免在 render 中直接 setState 触发 React #185
  // (maximum update depth exceeded)。
  // 依赖数组用原始值（val / time / active），而不是整个 payload 对象，
  // 保证引用稳定，effect 只在数据实际变化时触发。
  const CustomTooltip = (props: any) => {
    const { active, payload } = props || {};
    const point = active && Array.isArray(payload) && payload[0]?.payload;
    const val = point ? Number(point.val ?? 0) : null;
    const time = point ? (point.fullTime || "") : "";

    useEffect(() => {
      if (active && val !== null) {
        setHoveredData((prev) => {
          if (prev && prev.val === val && prev.fullTime === time) return prev;
          return { val, fullTime: time };
        });
      }
    }, [active, val, time]);

    return null;
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen" style={{ fontFamily: "Open Sauce One" }}>
      {/* Main Container - Narrowed to match reference */}
      <div className="max-w-300 mx-auto p-4">
        {/* 用户资料、盈亏图表 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-10">
          {/* 用户信息 */}
          <div className="border border-[--border] rounded-lg p-4 h-full flex flex-col justify-between">
            <div className="w-full">
              <div className="grid grid-cols-[64px_1fr] gap-x-3 items-start w-full">
                {/* 头像 */}
                <div className="relative">
                  {profileUser?.avatarUrl ? (
                    <div
                      className="rounded-full border border-(--border) overflow-hidden"
                      style={{
                        height: "64px",
                        width: "64px",
                      }}
                    >
                      <ProxyImage
                        /**
                         * 中文注释：
                         * - 用户头像通常也是第三方外链（例如 Polymarket/社交头像/CDN）
                         * - 这里同样走图片代理（https 外链经 Worker/CDN）
                         */
                        src={profileUser.avatarUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div
                      className={`rounded-full border border-(--border) bg-linear-to-br ${avatarGradient} flex items-center justify-center text-white text-2xl font-bold`}
                      style={{
                        height: "64px",
                        width: "64px",
                      }}
                    >
                      {avatarLetter}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 w-full overflow-hidden">
                  <div className="flex items-center justify-between w-full">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="text-2xl font-semibold truncate leading-tight">
                        {userDisplayName}
                      </p>
                    </div>
                    <div className="flex items-center shrink-0">
                      <div className="flex items-center rounded-md border border-[--border] bg-[--bg-secondary] p-0.5">
                        <button
                          type="button"
                          onClick={() => setPositionMode("yesNo")}
                          className={`px-2 py-1 text-xs rounded ${positionMode === "yesNo"
                              ? "bg-[--accent] text-black font-semibold"
                              : "text-[--text-secondary]"
                            }`}
                        >
                          {t.pna.profile.modeYesNo}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPositionMode("asian");
                            fetchAsianSummary();
                          }}
                          className={`px-2 py-1 text-xs rounded ${positionMode === "asian"
                              ? "bg-[--accent] text-black font-semibold"
                              : "text-[--text-secondary]"
                            }`}
                        >
                          {t.pna.profile.modeAsianHandicap}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-x-2 text-(--text-secondary) h-6">
                    <span className="text-sm whitespace-nowrap">
                      {t.pna.profile.joined} {formattedJoinedDate}
                    </span>
                    {/* <span className="text-sm">•</span>
                    <span className="text-sm whitespace-nowrap">
                      {profileUser?.profileViews || 0} {t.pna.profile.views}
                    </span> */}
                    {/* <div className="flex flex-1 justify-end pr-1">
                      <button
                        type="button"
                        className="flex justify-center items-center gap-x-0.5 text-white font-bold text-sm bg-gradient-to-r from-[#6676F1] to-[#4BEDFF] cursor-pointer rounded-sm w-[46px] h-[24px] pr-0.5"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="14"
                          height="14"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <title>Rewind</title>
                          <path d="M10 5.487a1 1 0 0 0-1.591-.806l-5.88 4.311a1.25 1.25 0 0 0 0 2.016l5.88 4.312A1 1 0 0 0 10 14.514v-3.16l5.409 3.966A1 1 0 0 0 17 14.514V5.487a1 1 0 0 0-1.591-.806L10 8.647zm-1.59-.806l.293.399Z"></path>
                        </svg>
                        <span className="text-xs translate-y-[0.5px]">25</span>
                      </button>
                    </div> */}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Stats Section with Dividers */}
            <div className="flex flex-row gap-x-5 items-center mt-8">
              <div className="flex flex-col gap-y-0.5">
                <p className="text-sm text-(--text-secondary) whitespace-nowrap font-medium">
                  {positionMode === "yesNo"
                    ? t.pna.profile.positionsValue
                    : t.pna.profile.asianPositionsValue}
                </p>
                <p className="text-xl font-medium">
                  {positionMode === "yesNo" ? (
                    <>
                      $
                      {positionsValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </>
                  ) : asianSummaryLoading ? (
                    "..."
                  ) : (
                    Number(asianSummary?.marketValues ?? 0).toLocaleString()
                  )}
                </p>
              </div>
              {/* <div className="w-px h-8 bg-[var(--border)] self-center"></div> */}
              {/* <div className="flex flex-col gap-y-0.5">
                <p className="text-sm text-[var(--text-secondary)] whitespace-nowrap font-medium">
                  {t.pna.profile.biggestWin}
                </p>
                <p className="text-xl font-medium">$0.00</p>
              </div> */}
              {/* <div className="w-px h-8 bg-[var(--border)] self-center"></div> */}
              {/* <div className="flex flex-col gap-y-0.5">
                <p className="text-sm text-[var(--text-secondary)] whitespace-nowrap font-medium">
                  {positionMode === "yesNo"
                    ? t.pna.profile.predictions
                    : t.pna.profile.asianSlipCount}
                </p>
                <p className="text-xl font-medium">
                  {positionMode === "yesNo"
                    ? predictionsCount.toLocaleString()
                    : asianSummaryLoading
                    ? "..."
                    : Number(asianSummary?.marketCounts ?? 0).toLocaleString()}
                </p>
              </div> */}
            </div>
          </div>

          {/* 盈亏图表 */}
          <div className="border border-[--border] rounded-lg p-4 flex flex-col min-h-62.5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-(--text-secondary) text-sm font-bold">
                {/* 根据正负值显示对应图标 */}
                {!isPositive ? (
                  <div className="text-[#F9452C]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                    >
                      <g fill="currentColor">
                        <path
                          d="m9.099,2.5H2.901c-.554,0-1.061.303-1.322.792-.262.488-.233,1.079.074,1.54l3.099,4.648c.279.418.745.668,1.248.668s.969-.25,1.248-.668l3.099-4.648c.308-.461.336-1.051.074-1.54-.262-.489-.769-.792-1.322-.792Z"
                          strokeWidth="0"
                        ></path>
                      </g>
                    </svg>
                  </div>
                ) : (
                  <div className="text-[#02B955]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                    >
                      <g fill="currentColor">
                        <path
                          d="m7.248,2.52c-.559-.837-1.938-.837-2.496,0L1.653,7.168c-.308.461-.336,1.051-.074,1.54.262.489.769.792,1.322.792h6.197c.554,0,1.061-.303,1.322-.792.262-.488.233-1.079-.074-1.54l-3.099-4.648Z"
                          strokeWidth="0"
                        ></path>
                      </g>
                    </svg>
                  </div>
                )}
                <span>{t.pna.profitLossLabel}</span>
              </div>

              <div className="flex gap-1">
                {["1D", "1W", "1M", "ALL"].map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`w-10 h-8 text-xs! md:text-sm! font-semibold uppercase rounded-md transition-all duration-300 ease-out z-0 ${timeRange === range
                        ? "bg-[--accent] text-black"
                        : "text-(--text-secondary) hover:text-(--text-primary)"
                      }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            <div className="">
              <h2 className="text-3xl font-semibold pointer-events-none flex items-center gap-2 leading-none tracking-tight">
                <NumberFlow
                  value={currentValue}
                  format={{
                    style: "currency",
                    currency: "USD",
                    currencyDisplay: "narrowSymbol", // 添加这一行
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                    signDisplay: "always",
                  }}
                />
                {/* icon */}

              </h2>
              <p className="text-xs text-(--text-secondary) font-medium mt-1">
                {currentTime}
              </p>
            </div>

            <div className="flex-1 min-h-16 relative">
              {/* 添加发光样式 */}
              <style dangerouslySetInnerHTML={{ __html: glowStyles }} />

              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
                  onMouseLeave={handleChartMouseLeave}
                >
                  <defs>
                    <linearGradient id="colorPnL" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={chartColor}
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor={chartColor}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  {/* 隐藏 Y 轴：根据数据自适应 padding，避免曲线贴成直线 */}
                  <YAxis
                    hide
                    domain={[
                      (dataMin: number) => {
                        const pad = Math.max(Math.abs(dataMin) * 0.2, 10);
                        return dataMin - pad;
                      },
                      (dataMax: number) => {
                        const pad = Math.max(Math.abs(dataMax) * 0.2, 10);
                        return dataMax + pad;
                      },
                    ]}
                  />

                  {/* Tooltip 用 CustomTooltip 作 render prop 读取 payload，
                      但 setState 延迟到 useEffect 避免 #185 */}
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ stroke: "#334155", strokeWidth: 1 }}
                  />

                  <Area
                    type="monotone"
                    dataKey="val"
                    stroke={chartColor}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorPnL)"
                    animationDuration={1000}
                    baseValue="dataMin"
                    activeDot={{
                      r: 5,
                      fill: chartColor,
                      stroke: "#1a2333",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Lower Section: Tabs & Table */}
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          lazyContent
          items={
            isViewingOtherUser
              ? [
                {
                  label: t.pna.tabs.positions,
                  value: "Positions",
                  content: (
                    <PositionsTab
                      isActive={activeTab === "Positions"}
                      userId={targetUserId || undefined}
                      allowClaim={false}
                    />
                  ),
                },
                {
                  label: t.pna.tabs.activity,
                  value: "Activity",
                  content: (
                    <ActivityTable
                      isParentTabActive={activeTab === "Activity"}
                      userId={targetUserId || undefined}
                    />
                  ),
                },
              ]
              : positionMode === "yesNo"
                ? [
                  {
                    label: t.pna.tabs.positions,
                    value: "Positions",
                    content: (
                      <PositionsTab
                        isActive={activeTab === "Positions"}
                        userId={targetUserId || undefined}
                        allowClaim
                      />
                    ),
                  },
                  {
                    label: t.pna.tabs.activity,
                    value: "Activity",
                    content: (
                      <ActivityTable
                        isParentTabActive={activeTab === "Activity"}
                        userId={targetUserId || undefined}
                      />
                    ),
                  },
                  {
                    label: t.pna.tabs.openOrders,
                    value: "OpenOrders",
                    content: (
                      <OpenOrdersTab
                        isActive={activeTab === "OpenOrders"}
                        userId={targetUserId || undefined}
                      />
                    ),
                  },
                  {
                    label: (t.pna.tabs as any).marketRecords || "Market Records",
                    value: "MarketRecords",
                    content: (
                      <MarketRecordsTab
                        isActive={activeTab === "MarketRecords"}
                      />
                    ),
                  },
                ]
                : [
                  {
                    label: t.pna.tabs.asianHandicapOrders,
                    value: "AsianHandicapOrders",
                    content: <AsianHandicapOrders />,
                  },
                ]
          }
        />
      </div>
    </div>
  );
};

function PnaPageFallback() {
  return (
    <div className="min-h-screen bg-(--bg-primary) flex items-center justify-center">
      <div className="animate-pulse text-(--text-secondary)">{"Loading..."}</div>
    </div>
  );
}

export default function PnaPage() {
  return (
    <Suspense fallback={<PnaPageFallback />}>
      <ProfileView />
    </Suspense>
  );
}