"use client";

/**
 * /pna - Portfolio & Activity 页面
 *
 * 功能（按 tab）：
 *   - Positions   持仓
 *   - Activity    活动
 *   - Orders      未完成订单（含 yesNo 与 Asian Handicap 两种）
 *   - Records     市场记录（仅创建记录，无审核）
 *   - 头部 P&L 图表
 *
 * 路由参数：
 *   - ?tab=positions|activity|orders|records  指定默认 tab
 *   - ?userId=<id>                            看别人的 portfolio
 *
 * UI 库：shadcn/ui + Radix Primitives + Tailwind v4
 *
 * TODO（重写中）：
 *   - 装 shadcn Tabs/Card/Table/Skeleton/Avatar/Badge/ScrollArea
 *   - 拆子组件：profile-summary / profit-loss-chart /
 *     positions-table / activity-table / orders-table / market-records-table
 *   - 复用数据层 hooks: lib/hooks/pna/use-*
 */
import { Suspense } from "react";

function PnaPageContent() {
  return (
    <div className="p-6 text-(--text-primary)">
      <h1 className="text-2xl font-semibold">Portfolio & Activity</h1>
      <p className="mt-2 text-(--text-secondary)">
        WIP — 数据层已就绪 (lib/hooks/pna/*)，UI 用 shadcn 重写中。
      </p>
    </div>
  );
}

export default function PnaPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <PnaPageContent />
    </Suspense>
  );
}
