/**
 * PositionsTable 组件
 * 展示用户持仓列表
 */

"use client";

import React, { useState, useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import ProxyImage from '@/components/common/ProxyImage';
import type { Position } from '../hooks/useGetPositions';
import type { ClosedPosition } from '../hooks/useGetClosedPositions';
import Link from 'next/link';
import PnaEmptyState from './PnaEmptyState';

interface PositionsTableProps {
    positions: (Position | ClosedPosition)[];
    isLoading: boolean;
    activeSubTab: 'active' | 'closed';
    onSubTabChange: (tab: 'active' | 'closed') => void;
}

type SortField = 'value' | 'profitDollar' | 'profitPercent' | 'bet' | 'alphabetically' | 'avgPrice' | 'currentPrice';

const PositionsTable: React.FC<PositionsTableProps> = ({
    positions,
    isLoading,
    activeSubTab,
    onSubTabChange
}) => {
    const { t } = useTranslation();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{
        field: SortField;
        direction: 'asc' | 'desc';
    }>({ field: 'value', direction: 'desc' });


    // 过滤和排序后的持仓
    const filteredAndSortedPositions = useMemo(() => {
        // 1. 按状态过滤
        // 如果是 activeSubTab === 'active'，数据来自 useGetPositionsNew (Position)
        // 如果是 activeSubTab === 'closed'，数据来自 useGetClosedPositionsNew (ClosedPosition)
        // 接口返回的数据已经根据状态分开了，所以这里我们只需要处理搜索和排序
        let filtered = [...positions];

        // 2. 按搜索词过滤
        if (searchTerm) {
            filtered = filtered.filter(pos =>
                pos.market.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ('outcome' in pos && pos.outcome.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        // 3. 排序
        const sorted = [...filtered];
        sorted.sort((a, b) => {
            let compareValue = 0;

            if (activeSubTab === 'active') {
                const posA = a as Position;
                const posB = b as Position;
                switch (sortConfig.field) {
                    case 'value': compareValue = (posA.shares * posA.currentPrice) - (posB.shares * posB.currentPrice); break;
                    case 'profitDollar': {
                        const profitA = (posA.shares * posA.currentPrice) - (posA.shares * posA.avgPrice);
                        const profitB = (posB.shares * posB.currentPrice) - (posB.shares * posB.avgPrice);
                        compareValue = profitA - profitB;
                        break;
                    }
                    case 'profitPercent': {
                        const costA = posA.shares * posA.avgPrice;
                        const costB = posB.shares * posB.avgPrice;
                        const profitA = (posA.shares * posA.currentPrice) - costA;
                        const profitB = (posB.shares * posB.currentPrice) - costB;
                        const pctA = costA !== 0 ? (profitA / costA) * 100 : 0;
                        const pctB = costB !== 0 ? (profitB / costB) * 100 : 0;
                        compareValue = pctA - pctB;
                        break;
                    }
                    case 'bet': compareValue = posA.shares - posB.shares; break;
                    case 'alphabetically': compareValue = posA.market.localeCompare(posB.market); break;
                    case 'avgPrice': compareValue = posA.avgPrice - posB.avgPrice; break;
                    case 'currentPrice': compareValue = posA.currentPrice - posB.currentPrice; break;
                }
            } else {
                const posA = a as ClosedPosition;
                const posB = b as ClosedPosition;
                switch (sortConfig.field) {
                    case 'value': compareValue = posA.amountWon - posB.amountWon; break;
                    case 'profitDollar': compareValue = posA.profit - posB.profit; break;
                    case 'profitPercent': compareValue = posA.profitPct - posB.profitPct; break;
                    case 'bet': compareValue = posA.totalBet - posB.totalBet; break;
                    case 'alphabetically': compareValue = posA.market.localeCompare(posB.market); break;
                }
            }

            return sortConfig.direction === 'desc' ? -compareValue : compareValue;
        });

        return sorted;
    }, [positions, activeSubTab, searchTerm, sortConfig]);


    // 获取图标
    const getIcon = (iconUrl: string | null) => {
        if (!iconUrl) {
            return (
                <div className="w-10 h-10 bg-(--bg-secondary) rounded-sm flex items-center justify-center text-xs font-bold text-(--text-primary)">
                    ?
                </div>
            );
        }

        return (
            <div className="w-10 h-10 rounded-sm overflow-hidden">
                <ProxyImage
                    src={iconUrl}
                    alt="Market icon"
                    className="w-full h-full object-cover"
                />
            </div>
        );
    };

    if (isLoading && positions.length === 0) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-(--text-secondary)">{t.pna.loading || 'Loading...'}</div>
            </div>
        );
    }

    return (
        <div>
            {/* 过滤和排序控件 */}
            <div className="flex flex-wrap items-center gap-4 mb-6 mt-6 max-md:justify-between">
                <div className="flex rounded-md border border-[--border] overflow-hidden order-1">
                    {[
                        { key: 'active' as const, label: t.pna.positionFilters.active },
                        { key: 'closed' as const, label: t.pna.positionFilters.closed },
                    ].map((tab, idx) => (
                        <button
                            key={tab.key}
                            onClick={() => onSubTabChange(tab.key)}
                            className={`px-6 py-2 text-sm font-bold transition-all relative ${idx !== 1 ? 'border-r border-solid border-[--border]' : ''
                                } ${activeSubTab === tab.key
                                    ? 'bg-[--accent] text-black'
                                    : 'text-(--text-secondary) hover:text-(--text-primary)'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 表头 */}
            <div className="grid grid-cols-12 py-3 border-b border-[--border] text-xs font-bold text-[--text-secondary] uppercase tracking-wider max-md:hidden">
                <div className="col-span-6">{t.pna.positionHeaders.market}</div>
                {activeSubTab === 'active' ? (
                    <>
                        <div className="col-span-1 text-center">{t.pna.positionHeaders.avg}</div>
                        <div className="col-span-1 text-right">{t.pna.positionHeaders.current}</div>
                        <div className="col-span-3 text-right">{t.pna.positionHeaders.value}</div>
                    </>
                ) : (
                    <>
                        <div className="col-span-1 text-center">{t.pna.positionHeaders.bet}</div>
                        <div className="col-span-1 text-right">{t.pna.positionHeaders.value}</div>
                        <div className="col-span-3 text-right">{t.pna.positionHeaders.profitLoss}</div>
                    </>
                )}
                <div className="col-span-1"></div>
            </div>

            {/* 持仓列表 */}
            <div className="divide-y divide-[--border]">
                {filteredAndSortedPositions.length === 0 ? (
                    <PnaEmptyState message={t.pna.orders?.noOrders || "No open orders"} />
                ) : (
                    filteredAndSortedPositions.map((pos, idx) => {
                        const isActive = activeSubTab === 'active';
                        const activePos = pos as Position;
                        const closedPos = pos as ClosedPosition;

                        return (
                            <div
                                key={isActive ? activePos.id : `closed-${idx}`}
                                className="grid grid-cols-12 py-5 items-center hover:bg-[--bg-secondary] transition-colors group max-md:grid-cols-[auto_1fr_auto] max-md:gap-3"
                            >
                                {/* 市场信息 */}
                                <div className="col-span-6 flex gap-4 max-md:col-span-1 max-md:gap-3">
                                    {getIcon(pos.icon)}
                                    <div className="max-md:hidden">
                                        {pos.eventSlug ? (
                                            <Link href={`/market/${pos.eventSlug}`}>
                                                <h4 className="text-sm font-bold mb-0.5 hover:underline cursor-pointer truncate max-w-75" title={pos.market}>
                                                    {pos.question}
                                                </h4>
                                            </Link>
                                        ) : (
                                            <h4 className="text-sm font-bold mb-0.5 truncate max-w-75" title={pos.market}>
                                                {pos.question}
                                            </h4>
                                        )}
                                        <p className="text-xs text-(--text-secondary) font-medium flex items-center gap-1">
                                            <span className={`py-0.5 px-2 rounded whitespace-nowrap ${pos.profit >= 0
                                                ? 'bg-[#43c7731a] text-[#43c773]'
                                                : 'bg-[#e763631a] text-[#e76363]'
                                                }`}>
                                                {pos.outcome}
                                            </span>
                                            {isActive ? (
                                                <span className="text-text-secondary font-medium text-xs">
                                                    {activePos.shares.toLocaleString()} {t.pna.positionHeaders.shares} at ${activePos.avgPrice.toFixed(2)}
                                                </span>
                                            ) : (
                                                <span className="text-text-secondary font-medium text-xs">
                                                    {closedPos.result === 'Won' ? '🏆 Won' : '❌ Lost'}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {/* 移动端市场信息 */}
                                <div className="hidden max-md:block max-md:col-span-1 max-md:min-w-0">
                                    {pos.eventSlug ? (
                                        <Link href={`/market/${pos.eventSlug}`}>
                                            <h4 className="text-sm font-bold mb-1 hover:underline cursor-pointer line-clamp-2">
                                                {pos.market}
                                            </h4>
                                        </Link>
                                    ) : (
                                        <h4 className="text-sm font-bold mb-1 line-clamp-2">
                                            {pos.market}
                                        </h4>
                                    )}
                                    <p className="text-xs text-[#64748b] font-medium flex flex-wrap items-center gap-1">
                                        <span className={`py-0.5 px-2 rounded whitespace-nowrap text-[11px] ${pos.profit >= 0
                                            ? 'bg-[#43c7731a] text-[#43c773]'
                                            : 'bg-[#e763631a] text-[#e76363]'
                                            }`}>
                                            {pos.outcome}
                                        </span>
                                        {isActive ? (
                                            <span className="text-text-secondary font-medium text-[11px]">
                                                {activePos.shares.toLocaleString()} {t.pna.positionHeaders.shares} at ${activePos.avgPrice.toFixed(2)}
                                            </span>
                                        ) : (
                                            <span className="text-text-secondary font-medium text-[11px]">
                                                {closedPos.result === 'Won' ? '🏆 Won' : '❌ Lost'}
                                            </span>
                                        )}
                                    </p>
                                </div>

                                {isActive ? (
                                    <>
                                        {/* 活跃持仓显示的列 */}
                                        <div className="col-span-1 text-center text-sm font-bold max-md:hidden">
                                            ${activePos.avgPrice.toFixed(2)}
                                        </div>
                                        <div className="col-span-1 text-right text-sm font-bold max-md:hidden">
                                            ${activePos.currentPrice.toFixed(2)}
                                        </div>
                                        <div className="col-span-3 text-right max-md:col-span-1">
                                            <p className="text-sm font-bold max-md:text-base">
                                                ${(activePos.shares * activePos.currentPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </p>
                                            {(() => {
                                                const cost = activePos.shares * activePos.avgPrice;
                                                const currentVal = activePos.shares * activePos.currentPrice;
                                                const profit = currentVal - cost;
                                                const profitPct = cost !== 0 ? (profit / cost) * 100 : 0;

                                                return (
                                                    <p className={`text-[11px] font-bold max-md:text-xs ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {profit >= 0 ? '+' : ''}$
                                                        {Math.abs(profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        {' '}({profitPct.toFixed(2)}%)
                                                    </p>
                                                );
                                            })()}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* 已结束持仓显示的列 */}
                                        <div className="col-span-1 text-center text-sm font-bold max-md:hidden">
                                            ${closedPos.totalBet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="col-span-1 text-right text-sm font-bold max-md:hidden">
                                            ${closedPos.amountWon.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="col-span-3 text-right max-md:col-span-1">
                                            <p className={`text-sm font-bold max-md:text-base ${closedPos.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {closedPos.profit >= 0 ? '+' : ''}${Math.abs(closedPos.profit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </p>
                                            <p className={`text-[11px] font-bold max-md:text-xs ${closedPos.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                ({closedPos.profitPct.toFixed(2)}%)
                                            </p>
                                        </div>
                                    </>
                                )}
                                <div className="col-span-1"></div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default PositionsTable;
