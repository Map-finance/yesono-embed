'use client';

/**
 * MarketDetailTabs - 市场详情底部 tab 区(评论 / 持有人 / 公开活动流)
 *
 * 注意:用户「我的持仓 / 当前委托 / 成交历史」不在这里 —— 那 3 块按 h2 模式
 * 由 page.tsx 通过 <MyMarketStack /> 堆叠在 OutcomeList 下方。
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { ChevronUp } from 'lucide-react';
import CommentSection from '../common/CommentSection';
import TopHolders from './TopHolders';
import ActivityFeed from './ActivityFeed';
import { PolymarketMarketResp } from '@/types/home';
import { getAuthApiUrl } from '@/lib/config/authApiUrl';

interface MarketDetailTabsProps {
  marketId: string;
  unionKey?: string;
  eventSlug?: string;
  eventId?: string;
  markets?: PolymarketMarketResp[];
  selectedMarketId?: string;
}



const AUTH_BASE_URL = getAuthApiUrl('/api');

const MarketDetailTabs: React.FC<MarketDetailTabsProps> = ({ marketId, unionKey, eventSlug, eventId, markets, selectedMarketId }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [commentCount, setCommentCount] = useState(0);

  // 评论区使用 outcome 列表中选中的 market.id，默认取第一个
  const commentMarketId = selectedMarketId || markets?.[0]?.id || marketId;

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
  const tabs = [t.market.commentsNumber(commentCount), t.market.topHolders, t.market.activity];

  return (
    <div className="mt-6">
      {/* 标签页 */}
      <div className="flex items-center gap-6 border-b border-(--border) mb-4">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            onClick={() => setActiveTab(index)}
            className={`pb-3 text-sm font-medium transition-colors relative ${
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
