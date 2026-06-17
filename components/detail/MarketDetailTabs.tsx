'use client';

/**
 * MarketDetailTabs - 市场详情标签页组件
 *
 * 已登录时多出 3 个"我的*"tab(持仓 / 委托 / 历史),走 legacy router 后端,
 * 各自 dynamic 化(ssr:false)只在点开时才挂载,减少首屏开销。
 */

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from '@/lib/i18n';
import { ChevronUp } from 'lucide-react';
import CommentSection from '../common/CommentSection';
import TopHolders from './TopHolders';
import ActivityFeed from './ActivityFeed';
import { PolymarketMarketResp } from '@/types/home';
import { getAuthApiUrl } from '@/lib/config/authApiUrl';
import { useAuthStore } from '@/lib/stores/authStore';
import { useMarketOrders } from '@/lib/hooks/useMarketOrders';
import { useMyMarketActivity } from '@/lib/hooks/useMyMarketActivity';

const MyOrdersTable = dynamic(() => import('./MyOrdersTable'), { ssr: false });
const MyPositionsTable = dynamic(() => import('./MyPositionsTable'), { ssr: false });
const MyHistoryList = dynamic(() => import('./MyHistoryList'), { ssr: false });

interface MarketDetailTabsProps {
  marketId: string;
  unionKey?: string;
  eventSlug?: string;
  eventId?: string;
  markets?: PolymarketMarketResp[];
  selectedMarketId?: string;
  /** 当前选中市场的完整对象,用于持仓/委托/Claim 过滤;不传则从 markets[selectedMarketId] 派生 */
  selectedMarketObj?: PolymarketMarketResp | null;
  /** 当前市场是否已结算 */
  isResolved?: boolean;
}



const AUTH_BASE_URL = getAuthApiUrl('/api');

const MarketDetailTabs: React.FC<MarketDetailTabsProps> = ({
  marketId,
  unionKey,
  eventSlug,
  eventId,
  markets,
  selectedMarketId,
  selectedMarketObj,
  isResolved = false,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const { isAuthenticated } = useAuthStore();

  // 评论区使用 outcome 列表中选中的 market.id，默认取第一个
  const commentMarketId = selectedMarketId || markets?.[0]?.id || marketId;
  // 当前 tab 用的 market 对象 + id:派生用,后续 hook 拉持仓/委托/历史都按它走
  const currentMarket =
    selectedMarketObj ||
    markets?.find((m) => String(m.id) === String(selectedMarketId)) ||
    markets?.[0] ||
    null;
  const currentMarketId = currentMarket?.id ? String(currentMarket.id) : commentMarketId;

  const fetchCommentCount = useCallback(() => {
    if (!commentMarketId) return;
    fetch(`${AUTH_BASE_URL}/comments/count?marketId=${commentMarketId}`)
      .then(res => res.json())
      .then(res => {
        if (res.success && res.data !== undefined) {
          setCommentCount(Number(res.data));
        }
      })
      .catch(err => console.error('[MarketDetailTabs] Failed to fetch comment count:', err));
  }, [commentMarketId]);

  useEffect(() => {
    fetchCommentCount();
  }, [fetchCommentCount]);

  // 创建评论后重新获取计数
  const handleCommentCreated = useCallback(() => {
    // 先乐观 +1，然后延迟重新获取准确值
    setCommentCount(prev => prev + 1);
    setTimeout(fetchCommentCount, 2000);
  }, [fetchCommentCount]);

  const { t } = useTranslation();
  // 我的* tabs 仅登录态显示。未登录时位置全部空着不渲染,索引也对齐
  const baseTabs = [t.market.commentsNumber(commentCount), t.market.topHolders, t.market.activity];
  const myTabsLabels = isAuthenticated
    ? [
        (t.market as any).myPosition || 'Positions',
        (t.market as any).openOrders || 'Open Orders',
        (t.market as any).history || 'History',
      ]
    : [];
  const tabs = [...baseTabs, ...myTabsLabels];

  return (
    <div className="mt-6">
      {/* 标签页 */}
      <div className="flex items-center gap-6 border-b border-(--border) mb-4 overflow-x-auto scrollbar-hide">
        {tabs.map((tab, index) => (
          <button
            key={tab + '-' + index}
            onClick={() => setActiveTab(index)}
            className={`pb-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
              activeTab === index
                ? 'text-(--text-primary)'
                : 'text-(--text-secondary) hover:text-(--text-primary)'
            }`}
          >
            {tab}
            {activeTab === index && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-(--accent)" />
            )}
          </button>
        ))}
      </div>

      {/* Comments Tab Content */}
      {activeTab === 0 && (
        <CommentSection entityId={String(commentMarketId)} onCommentCreated={handleCommentCreated} />
      )}

      {/* Top Holders Tab Content */}
      {activeTab === 1 && (
        <TopHolders markets={markets || []} />
      )}

      {/* Activity Tab Content */}
      {activeTab === 2 && (
        <ActivityFeed
          marketId={marketId}
          unionKey={unionKey}
          eventSlug={eventSlug}
          eventId={eventId}
          markets={markets}
        />
      )}

      {/* My Positions Tab(登录态)*/}
      {isAuthenticated && activeTab === 3 && (
        <MyPositionsTable
          market={currentMarket}
          isResolved={isResolved}
        />
      )}

      {/* My Open Orders Tab(登录态)*/}
      {isAuthenticated && activeTab === 4 && (
        <MyOrdersTabContent marketId={currentMarketId} market={currentMarket} />
      )}

      {/* My History Tab(登录态)*/}
      {isAuthenticated && activeTab === 5 && (
        <MyHistoryTabContent marketId={currentMarketId} />
      )}

      {/* 返回顶部 */}
      <div className="flex justify-center mt-6">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-1 px-4 py-2 rounded-lg bg-(--bg-hover) text-sm text-(--text-secondary) hover:text-(--text-primary) transition-colors"
        >
          {t.common.backToTop} <ChevronUp size={16} />
        </button>
      </div>
    </div>
  );
};

export default MarketDetailTabs;

// ─── 内部包装:把 useMarketOrders / useMyMarketActivity 数据装到 dynamic 组件 ───

function MyOrdersTabContent({
  marketId,
  market,
}: {
  marketId: string;
  market: PolymarketMarketResp | null;
}) {
  const { orders, isLoading, isLoadingMore, hasMore, loadMore } = useMarketOrders(
    marketId,
    null,
    'pending',
    true
  );
  const { t } = useTranslation();
  if (isLoading && orders.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-(--text-secondary)">
        {t.common.loading}
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-(--text-tertiary)">
        {(t.market as any).noOpenOrders || (t.pna as any)?.orders?.noOrders || 'No open orders'}
      </div>
    );
  }
  return (
    <MyOrdersTable
      orders={orders}
      market={market}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      onLoadMore={loadMore}
    />
  );
}

function MyHistoryTabContent({ marketId }: { marketId: string }) {
  const { activities, isLoading } = useMyMarketActivity(marketId, 20);
  const { t } = useTranslation();
  if (isLoading && activities.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-(--text-secondary)">
        {t.common.loading}
      </div>
    );
  }
  if (activities.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-(--text-tertiary)">
        {(t.market as any).noHistory || 'No trade history'}
      </div>
    );
  }
  return <MyHistoryList activities={activities} />;
}
