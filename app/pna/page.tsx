"use client";

/**
 * /pna - Portfolio & Activity 页面
 *
 * 顶层 mode：[Yes/No] [Asian Handicap]（与原版一致）
 *   - Yes/No 模式：4 tab（positions/activity/orders/records）
 *   - Asian 模式：仅 orders tab，渲染亚盘订单簿
 *
 * 路由参数：
 *   - ?tab=positions|activity|orders|records  指定默认 tab（仅 Yes/No 模式生效）
 *   - ?mode=yesno|asian                       指定默认顶层 mode
 *   - ?userId=<id>                            看别人的 portfolio
 */

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/shadcn/tabs";
import { useTranslation } from "@/lib/i18n";
import { useAuthStore } from "@/lib/stores/authStore";
import ProfitLossChart from "./components/profit-loss-chart";
import ModeBar, { type PositionMode } from "./components/mode-bar";
import PositionsTable from "./components/positions-table";
import ActivityTable from "./components/activity-table";
import OrdersTable from "./components/orders-table";
import MarketRecordsTable from "./components/market-records-table";

const TAB_KEYS = ["positions", "activity", "orders", "records"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function isTabKey(v: string | null): v is TabKey {
  return !!v && (TAB_KEYS as readonly string[]).includes(v);
}

function PnaPageContent() {
  const { t } = useTranslation();
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

  // Asian 模式锁定为 orders tab；Yes/No 模式遵循用户的 tab 选择
  const tabValue: TabKey = mode === "asian" ? "orders" : tab;

  return (
    <div className="mx-auto max-w-5xl p-4 space-y-4">
      <ProfitLossChart targetUserId={targetUserId} />

      <ModeBar mode={mode} onChange={setMode} targetUserId={targetUserId} />

      <Tabs value={tabValue} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <TabsList variant="line">
          {mode === "yesNo" && <TabsTrigger value="positions">{t.pna.tabs.positions}</TabsTrigger>}
          {mode === "yesNo" && <TabsTrigger value="activity">{t.pna.tabs.activity}</TabsTrigger>}
          <TabsTrigger value="orders">
            {mode === "asian" ? t.pna.tabs.asianHandicapOrders : t.pna.tabs.openOrders}
          </TabsTrigger>
          {mode === "yesNo" && <TabsTrigger value="records">{t.pna.tabs.marketRecords}</TabsTrigger>}
        </TabsList>

        {mode === "yesNo" && (
          <>
            <TabsContent value="positions" className="mt-3">
              <PositionsTable targetUserId={targetUserId} />
            </TabsContent>
            <TabsContent value="activity" className="mt-3">
              <ActivityTable targetUserId={targetUserId} />
            </TabsContent>
            <TabsContent value="records" className="mt-3">
              <MarketRecordsTable />
            </TabsContent>
          </>
        )}
        <TabsContent value="orders" className="mt-3">
          <OrdersTable targetUserId={targetUserId} mode={mode} />
        </TabsContent>
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
