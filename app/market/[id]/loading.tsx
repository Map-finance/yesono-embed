/**
 * 路由级即时骨架屏(Next App Router loading.tsx)。
 *
 * 作用:导航到 /market/[id] 时立即显示,填补"重型 use client 详情页 JS 加载 + 数据请求"
 * 这段冷启动空窗,让点击后"立刻有反馈"。配合列表卡的意向预取(MarketGrid),
 * 既不滥发视口预取挤占连接池,又保住秒开观感。
 *
 * 注意:这是 Server Component(无 "use client"/hooks),才能在客户端 chunk 加载前就渲染。
 * 仅用 CSS 变量主题色,深浅色自适应。
 */
export default function MarketDetailLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] animate-pulse">
      <div className="max-w-[1200px] mx-auto px-4 py-6">
        {/* 顶部:返回 + 标题行 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-6 w-6 rounded bg-[var(--bg-secondary)]" />
          <div className="h-10 w-10 rounded-lg bg-[var(--bg-secondary)]" />
          <div className="flex-1 min-w-0">
            <div className="h-5 w-2/3 rounded bg-[var(--bg-secondary)] mb-2" />
            <div className="h-3 w-1/3 rounded bg-[var(--bg-secondary)]" />
          </div>
        </div>

        {/* 主体:左图表 + 右交易面板 */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 左:图表 + outcome 列表 */}
          <div className="flex-1 min-w-0">
            <div className="h-[280px] w-full rounded-xl bg-[var(--bg-secondary)] mb-6" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)]"
                />
              ))}
            </div>
          </div>

          {/* 右:交易面板(桌面端) */}
          <div className="w-full lg:w-[340px] shrink-0 hidden lg:block">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className="flex gap-2 mb-4">
                <div className="h-10 flex-1 rounded-lg bg-[var(--bg-secondary)]" />
                <div className="h-10 flex-1 rounded-lg bg-[var(--bg-secondary)]" />
              </div>
              <div className="h-3 w-1/2 rounded bg-[var(--bg-secondary)] mb-3" />
              <div className="h-12 w-full rounded-lg bg-[var(--bg-secondary)] mb-4" />
              <div className="h-11 w-full rounded-lg bg-[var(--bg-secondary)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
