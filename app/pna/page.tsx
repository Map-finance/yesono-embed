"use client";

/**
 * /pna - Portfolio & Activity 页面
 *
 * 功能：
 *   - Positions   持仓
 *   - Activity    活动
 *   - Orders      未完成订单（含 Asian Handicap）
 *   - Records     市场记录（仅创建记录，无审核）
 *   - 顶部 Profile + P&L 图表
 *
 * 路由参数：
 *   - ?tab=positions|activity|orders|records  指定默认 tab
 *   - ?userId=<id>                            看别人的 portfolio
 */

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { useAuthStore } from "@/lib/stores/authStore";
import ProfileSummary from "./components/profile-summary";
import ProfitLossChart from "./components/profit-loss-chart";

const TAB_KEYS = ["positions", "activity", "orders", "records"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function isTabKey(v: string | null): v is TabKey {
  return !!v && (TAB_KEYS as readonly string[]).includes(v);
}

function PnaPageContent() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const tabParam = searchParams.get("tab");
  const initialTab: TabKey = isTabKey(tabParam) ? tabParam : "positions";

  const routeUserId = (searchParams.get("userId") || "").trim();
  const currentUserId = (user?.userId || "").trim();

  const targetUserId = routeUserId || currentUserId || undefined;
  const isViewingOtherUser = useMemo(
    () => Boolean(routeUserId && routeUserId !== currentUserId),
    [routeUserId, currentUserId]
  );

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <ProfileSummary
        targetUserId={targetUserId}
        isViewingOtherUser={isViewingOtherUser}
      />
      <ProfitLossChart targetUserId={targetUserId} />

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="bg-(--bg-card) border border-(--border)">
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="records">Records</TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="mt-3">
          <TabPlaceholder name="Positions" />
        </TabsContent>
        <TabsContent value="activity" className="mt-3">
          <TabPlaceholder name="Activity" />
        </TabsContent>
        <TabsContent value="orders" className="mt-3">
          <TabPlaceholder name="Orders" />
        </TabsContent>
        <TabsContent value="records" className="mt-3">
          <TabPlaceholder name="Records" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TabPlaceholder({ name }: { name: string }) {
  return (
    <div className="rounded-md border border-dashed border-(--border) p-8 text-center text-sm text-(--text-secondary)">
      {name} — 即将上线（PR2-4 实现）
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
