"use client";

/**
 * /pna - Portfolio & Activity 页面
 *
 * 自己 / 他人 切换（与原 h2-market /pna 保持一致）：
 *   - 看自己 + Yes/No：4 tab（持仓 / 活动 / 未完成订单 / 市场记录）
 *   - 看自己 + 亚盘  ：1 tab（亚盘订单）
 *   - 看别人        ：2 tab（持仓 / 活动），不显示 ModeBar，
 *                     不展示订单和市场记录（这些不属于公开数据范畴）
 *
 * 路由参数：
 *   - ?tab=positions|activity|orders|records  指定默认 tab
 *   - ?mode=yesno|asian                       指定默认顶层 mode（仅自己生效）
 *   - ?userId=<id>                            看别人的 portfolio
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { Card, CardContent } from "@/components/ui/shadcn/card";
import { useTranslation } from "@/lib/i18n";
import { useAuthStore } from "@/lib/stores/authStore";
import { getUserProfileUserInfo } from "@/lib/api";
import type { UserInfo } from "@/lib/types";
import ProxyImage from "@/components/common/ProxyImage";
import useGetPositions from "@/app/pna/hooks/use-get-positions";
import ProfitLossChart from "./components/profit-loss-chart";
import ModeBar, { type PositionMode } from "./components/mode-bar";
import PositionsTable from "./components/positions-table";
import ActivityTable from "./components/activity-table";
import OrdersTable from "./components/orders-table";
import MarketRecordsTable from "./components/market-records-table";

const AVATAR_GRADIENTS = [
  "from-purple-500 to-orange-500",
  "from-pink-500 to-purple-500",
  "from-indigo-500 to-purple-500",
  "from-cyan-500 to-blue-500",
];

/**
 * 公开个人资料头部卡片（display-only）。
 * 仅展示头像 / 名称 / 加入时间 / 持仓总额，不含任何账户/编辑/钱包/余额私有 UI。
 * 数据来源：公开的 getUserProfileUserInfo + useGetPositions（持仓总额客户端推导）。
 */
function ProfileHeaderCard({
  targetUserId,
  locale,
  joinedLabel,
  positionsValueLabel,
}: {
  targetUserId?: string;
  locale: string;
  joinedLabel: string;
  positionsValueLabel: string;
}) {
  const [profile, setProfile] = useState<UserInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!targetUserId) {
      setProfile(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const res = await getUserProfileUserInfo(targetUserId);
        const data = (res as { data?: UserInfo })?.data;
        if (!cancelled && data) {
          setProfile({ ...data, userId: String(data.userId ?? targetUserId) });
        }
      } catch (error) {
        console.warn("[PNA] Failed to fetch public profile:", error);
        if (!cancelled) setProfile(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  // 持仓总额：与 mode-bar / positions-table 保持一致，用 shares × currentPrice 客户端推导。
  const { positions } = useGetPositions({
    userId: targetUserId,
    limit: 100,
    enabled: Boolean(targetUserId),
  });
  const positionsValue = useMemo(
    () =>
      positions.reduce(
        (sum, p) => sum + (Number(p.shares) || 0) * (Number(p.currentPrice) || 0),
        0
      ),
    [positions]
  );

  const displayName = profile?.username || profile?.displayName || targetUserId || "";

  const avatarSeed = profile?.smartAccountAddress || displayName || "user";
  const avatarGradient = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < avatarSeed.length; i++) {
      hash = avatarSeed.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
  }, [avatarSeed]);
  const avatarLetter = displayName ? displayName.charAt(0).toUpperCase() : "U";

  const formattedJoinedDate = useMemo(() => {
    if (!profile?.joinedDate) return "";
    try {
      return new Intl.DateTimeFormat(locale, {
        month: "short",
        year: "numeric",
      }).format(new Date(profile.joinedDate));
    } catch {
      return profile.joinedDate;
    }
  }, [profile?.joinedDate, locale]);

  if (!profile) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-[64px_1fr] items-start gap-x-3">
          {/* 头像 */}
          {profile.avatarUrl ? (
            <div className="size-16 overflow-hidden rounded-full border border-(--border)">
              <ProxyImage
                src={profile.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div
              className={`flex size-16 items-center justify-center rounded-full border border-(--border) bg-gradient-to-br ${avatarGradient} text-2xl font-bold text-white`}
            >
              {avatarLetter}
            </div>
          )}

          <div className="flex min-w-0 flex-col gap-1">
            <p className="truncate text-2xl font-semibold leading-tight">
              {displayName}
            </p>
            {formattedJoinedDate && (
              <span className="text-sm text-(--text-secondary)">
                {joinedLabel} {formattedJoinedDate}
              </span>
            )}
            <div className="mt-3 flex flex-col gap-y-0.5">
              <p className="text-sm font-medium text-(--text-secondary)">
                {positionsValueLabel}
              </p>
              <p className="text-xl font-medium tabular-nums">
                $
                {positionsValue.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const TAB_KEYS = ["positions", "activity", "orders", "records"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function isTabKey(v: string | null): v is TabKey {
  return !!v && (TAB_KEYS as readonly string[]).includes(v);
}

function PnaPageContent() {
  const { t, locale } = useTranslation();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const tabParam = searchParams.get("tab");
  const modeParam = searchParams.get("mode");
  const initialTab: TabKey = isTabKey(tabParam) ? tabParam : "positions";
  const initialMode: PositionMode = modeParam === "asian" ? "asian" : "yesNo";

  const [mode, setMode] = useState<PositionMode>(initialMode);
  const [tab, setTab] = useState<TabKey>(initialTab);

  const routeUserId = (searchParams.get("userId") || "").trim();
  const currentUserId = (user?.userId || "").trim();
  const targetUserId = routeUserId || currentUserId || undefined;

  // 看别人：URL 指定了 userId 且与当前用户不一致（或当前用户未登录）
  const isViewingOtherUser = Boolean(routeUserId && routeUserId !== currentUserId);

  // 看别人时如果 tab 当前在 orders/records，自动切回 positions
  useEffect(() => {
    if (isViewingOtherUser && (tab === "orders" || tab === "records")) {
      setTab("positions");
    }
  }, [isViewingOtherUser, tab]);

  // 实际渲染的 tab 值：
  //   - 看别人：永远在 positions/activity 之间
  //   - 看自己 + 亚盘：锁定 orders
  //   - 看自己 + Yes/No：用户选什么显什么
  const tabValue: TabKey = isViewingOtherUser
    ? tab === "activity"
      ? "activity"
      : "positions"
    : mode === "asian"
      ? "orders"
      : tab;

  return (
    <div className="mx-auto max-w-6xl p-4 space-y-4">
      {/* 公开个人资料头部卡片：查看他人时展示头像/名称/加入时间/持仓总额 */}
      {isViewingOtherUser && (
        <ProfileHeaderCard
          targetUserId={targetUserId}
          locale={locale}
          joinedLabel={t.pna.profile.joined}
          positionsValueLabel={t.pna.profile.positionsValue}
        />
      )}

      <ProfitLossChart targetUserId={targetUserId} />

      {/* ModeBar 仅自己看：mode 切换、持仓总额（充提总额）只对当前用户有意义 */}
      {!isViewingOtherUser && (
        <ModeBar mode={mode} onChange={setMode} targetUserId={targetUserId} />
      )}

      <Tabs value={tabValue} onValueChange={(v) => setTab(v as TabKey)} className="w-full flex-col">
        <TabsList variant="line">
          {/* 看别人：仅 2 个 tab */}
          {isViewingOtherUser ? (
            <>
              <TabsTrigger value="positions">{t.pna.tabs.positions}</TabsTrigger>
              <TabsTrigger value="activity">{t.pna.tabs.activity}</TabsTrigger>
            </>
          ) : (
            <>
              {mode === "yesNo" && <TabsTrigger value="positions">{t.pna.tabs.positions}</TabsTrigger>}
              {mode === "yesNo" && <TabsTrigger value="activity">{t.pna.tabs.activity}</TabsTrigger>}
              <TabsTrigger value="orders">
                {mode === "asian" ? t.pna.tabs.asianHandicapOrders : t.pna.tabs.openOrders}
              </TabsTrigger>
              {mode === "yesNo" && <TabsTrigger value="records">{t.pna.tabs.marketRecords}</TabsTrigger>}
            </>
          )}
        </TabsList>

        {/* 看别人 / 看自己 yesNo 都展示 positions + activity */}
        {(isViewingOtherUser || mode === "yesNo") && (
          <>
            <TabsContent value="positions" className="mt-3">
              <PositionsTable targetUserId={targetUserId} />
            </TabsContent>
            <TabsContent value="activity" className="mt-3">
              <ActivityTable targetUserId={targetUserId} />
            </TabsContent>
          </>
        )}

        {/* records 仅自己 yesNo */}
        {!isViewingOtherUser && mode === "yesNo" && (
          <TabsContent value="records" className="mt-3">
            <MarketRecordsTable />
          </TabsContent>
        )}

        {/* orders 仅自己（yesNo 显示 yesNo 订单 / asian 显示亚盘订单簿） */}
        {!isViewingOtherUser && (
          <TabsContent value="orders" className="mt-3">
            <OrdersTable targetUserId={targetUserId} mode={mode} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default function PnaPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl p-6 text-(--text-secondary)">
          Loading...
        </div>
      }
    >
      <PnaPageContent />
    </Suspense>
  );
}
