/**
 * ActivityTable 组件
 * 展示用户活动记录
 */

"use client";

import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import ProxyImage from '@/components/common/ProxyImage';
import Link from 'next/link';
import { getBasescanUrl } from "@/lib/config";
import PnaEmptyState from './PnaEmptyState';
import useGetActivity from '../hooks/useGetActivity';
import useGetChainTransactions from '../hooks/useGetChainTransactions';

type ActivityTab = 'activity' | 'chain';

// 格式化时间戳：自动识别秒/毫秒，显示相对时间（国际化）
function formatActivityTime(ts: number | string | undefined, timeI18n?: { minutesAgo: string; hourAgo: string; hoursAgo: string; dayAgo: string; daysAgo: string }): string {
    if (!ts) return '';
    let ms = typeof ts === 'string' ? Number(ts) : ts;
    if (ms < 1e12) ms *= 1000;
    const diff = Date.now() - ms;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (diff < 60000) return `<1 ${timeI18n?.minutesAgo || 'minutes ago'}`;
    if (diff < 3600000) return `${m} ${timeI18n?.minutesAgo || 'minutes ago'}`;
    if (diff < 86400000) return `${h} ${h === 1 ? (timeI18n?.hourAgo || 'hour ago') : (timeI18n?.hoursAgo || 'hours ago')}`;
    if (diff < 2592000000) return `${d} ${d === 1 ? (timeI18n?.dayAgo || 'day ago') : (timeI18n?.daysAgo || 'days ago')}`;
    return new Date(ms).toLocaleDateString();
}

interface ActivityTableProps {
    isParentTabActive: boolean;
    userId?: string;
}

const ActivityTable: React.FC<ActivityTableProps> = ({
    isParentTabActive,
    userId,
}) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<ActivityTab>('activity');

    const { activities, isLoading: isActivityLoading } = useGetActivity({
        enabled: isParentTabActive && activeTab === 'activity',
        userId,
    });

    const {
        transactions: chainTransactions,
        isLoading: isChainLoading,
        isLoadingMore: isChainLoadingMore,
        hasMore: chainHasMore,
        loadMore: loadMoreChain
    } = useGetChainTransactions({
        enabled: isParentTabActive && activeTab === 'chain',
        userId,
    });

    const currentLoading = activeTab === 'activity' ? isActivityLoading : isChainLoading;
    const currentData = activeTab === 'activity' ? activities : chainTransactions;


    // 翻译类型
    const translateType = (type: string) => {
        const normalizedType = (type || '').toUpperCase();

        const typeMap: Record<string, string> = {
            BUY: t.pna.activity.buy,
            SELL: t.pna.activity.sell,
            MERGE: t.pna.activity.merge || 'Merge',
            REDEEM: t.pna.activity.redeem || 'Redeem',
            DEPOSIT: t.pna.activity.deposit || 'Deposit',
            WITHDRAW: t.pna.activity.withdraw || 'Withdraw',
            SPLIT: t.trade.split || 'Split',
        };

        return typeMap[normalizedType] || type;
    };



    // 获取图标
    const getIcon = (activity: any) => {
        if (activity.icon) {
            return (
                <ProxyImage src={activity.icon} alt={activity.question} className="w-10 h-10 rounded-sm max-md:w-8 max-md:h-8" />
            );
        }
        // 对于 DEPOSIT/WITHDRAW,显示默认图标
        if (activity.type === 'DEPOSIT' || activity.type === 'WITHDRAW') {
            return (
                <div className="w-10 h-10 bg-[var(--bg-secondary)] rounded-sm flex items-center justify-center text-xs font-bold text-[var(--text-primary)] max-md:w-8 max-md:h-8">
                    {activity.type === 'DEPOSIT' ? '↓' : '↑'}
                </div>
            );
        }

        // 其他类型显示占位图标
        return (
            <div className="w-10 h-10 bg-[var(--bg-secondary)] rounded-sm flex items-center justify-center text-xs font-bold text-[var(--text-primary)] max-md:w-8 max-md:h-8">
                {activity.question ? activity.question.charAt(0) : '?'}
            </div>
        );
    };

    if (currentLoading && currentData.length === 0) {
        return (
            <div>
                {/* 子 tab 切换 - 与 PositionsTable 风格一致 */}
                <div className="flex flex-wrap items-center gap-4 mb-6 mt-6 max-md:justify-between">
                    <div className="flex rounded-md border border-[--border] overflow-hidden order-1">
                        {[
                            { key: 'activity' as const, label: t.pna.activity.transactionHistory },
                            { key: 'chain' as const, label: t.pna.activity.chainTransactionHistory },
                        ].map((tab, idx) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-6 py-2 text-sm font-bold transition-all relative ${idx !== 1 ? 'border-r border-solid border-[--border]' : ''} ${activeTab === tab.key ? 'bg-[--accent] text-black' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center justify-center py-20">
                    <div className="text-[var(--text-secondary)]">{t.pna.loading || 'Loading...'}</div>
                </div>
            </div>
        );
    }

    return (
        <div>
            {/* 子 tab 切换 - 与 PositionsTable 风格一致 */}
            <div className="flex flex-wrap items-center gap-4 mb-6 mt-6 max-md:justify-between">
                <div className="flex rounded-md border border-[--border] overflow-hidden order-1">
                    {[
                        { key: 'activity' as const, label: t.pna.activity.transactionHistory },
                        { key: 'chain' as const, label: t.pna.activity.chainTransactionHistory },
                    ].map((tab, idx) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-6 py-2 text-sm font-bold transition-all relative ${idx !== 1 ? 'border-r border-solid border-[--border]' : ''} ${activeTab === tab.key ? 'bg-[--accent] text-black' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
            {/* 表头 */}
            <div className="grid grid-cols-12 py-3 text-xs font-bold text-[--text-secondary] uppercase tracking-wider mt-6 max-md:hidden">
                <div className="col-span-1">{t.pna.activity.type}</div>
                <div className="col-span-8">{t.pna.activity.market}</div>
                <div className="col-span-3 text-right flex items-center justify-end gap-1">
                    <div
                        className="flex items-center gap-1 hover:bg-(--bg-hover) rounded-sm px-1 py-0.5 cursor-pointer"
                    >
                        {t.pna.activity.amount}

                    </div>
                </div>
            </div>

            {/* 活动列表 */}
            <div className="divide-y divide-[--border] max-md:mt-3">
                {currentData.length === 0 ? (
                    <PnaEmptyState message={t.pna.orders?.noOrders || "No open orders"} />
                ) : (
                    currentData.map((activity: any, index: number) => (
                        <div
                            key={`${activity.txHash}-${index}`}
                            className="grid grid-cols-12 py-4 items-center max-md:grid-cols-[1fr_90px] max-md:gap-2"
                        >
                            {/* 类型 */}
                            <div className="col-span-1 text-sm font-bold max-md:hidden">
                                {translateType(activity.type)}
                            </div>

                            {/* 市场信息 */}
                            <div className="col-span-8 flex gap-4 max-md:col-span-1 max-md:gap-3 max-md:min-w-0 max-md:overflow-hidden">
                                {getIcon(activity)}
                                <div className="min-w-0 flex-1">
                                    {/* <h4 className="text-sm font-bold mb-0.5 hover:underline cursor-pointer line-clamp-2 max-md:text-xs">
                                        {activity.market}
                                    </h4> */}
                                    {activity.eventSlug ? (
                                        <Link href={`/market/${activity.eventSlug}`}>
                                            <h4 className="text-sm font-bold mb-0.5 hover:underline cursor-pointer truncate" title={activity.market}>
                                                {activity.question}
                                            </h4>
                                        </Link>
                                    ) : (
                                        <h4 className="text-sm font-bold mb-0.5 truncate" title={activity.market}>
                                            {activity.question}
                                        </h4>
                                    )}
                                    <div className="text-xs text-[var(--text-secondary)] font-medium flex items-center gap-2 max-md:flex-wrap max-md:text-[11px]">
                                        {/* 显示类型(移动端) */}
                                        <span className="hidden max-md:inline-block py-0.5 px-2 rounded bg-[var(--bg-secondary)] text-[11px] font-medium">
                                            {translateType(activity.type)}
                                        </span>

                                        {/* 显示结果和价格(仅 Buy/Sell/REDEEM/MERGE if available) */}
                                        {activity.outcomeName ? (
                                            <>
                                                <span className={`py-0.5 px-2 rounded text-xs font-medium whitespace-nowrap ${activity.type === 'Buy' || activity.type === 'REDEEM'
                                                    ? 'bg-[#43c7731a] text-[#43c773]'
                                                    : 'bg-[#e763631a] text-[#e76363]'
                                                    }`}>
                                                    {activity.outcomeName} {activity.price ? `$${activity.price.toFixed(2)}` : ''}
                                                </span>
                                                <span className="text-text-secondary font-medium text-xs">
                                                    {(activity.shares || 0).toLocaleString()} {t.pna.activity.shares}
                                                </span>
                                            </>
                                        ) : (
                                            activity.marketId && (
                                                <span className="text-xs text-[var(--text-secondary)]">
                                                    ID: {activity.marketId}
                                                </span>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 金额和时间 */}
                            <div className="col-span-3 text-right max-md:col-span-1">
                                <p className="text-sm font-bold max-md:text-base">
                                    ${(activity.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                                {(activity.timestamp || activity.txHash) && (
                                    <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 flex items-center justify-end gap-1 whitespace-nowrap">
                                        {activity.timestamp && <span>{formatActivityTime(activity.timestamp, t.pna.time)}</span>}
                                        {activity.txHash && (
                                            <a
                                                href={getBasescanUrl.transaction(activity.txHash)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:text-[var(--text-primary)] transition-colors shrink-0"
                                                title={activity.txHash}
                                            >
                                                <ExternalLink size={11} />
                                            </a>
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* 加载更多 - 仅 chain tab */}
            {activeTab === 'chain' && currentData.length > 0 && (
                <div className="flex justify-center py-6">
                    {chainHasMore ? (
                        <button
                            onClick={loadMoreChain}
                            disabled={isChainLoadingMore}
                            className="px-6 py-2 text-sm font-medium border border-[--border] rounded-md hover:bg-[--bg-secondary] transition-colors disabled:opacity-50"
                        >
                            {isChainLoadingMore ? (t.pna.loading || 'Loading...') : (t.pna.loadMore || 'Load More')}
                        </button>
                    ) : (
                        <span className="text-sm text-[--text-secondary]">
                            {t.pna.noMore || 'No more data'}
                        </span>
                    )}
                </div>
            )}
        </div >
    );
};

export default ActivityTable;
