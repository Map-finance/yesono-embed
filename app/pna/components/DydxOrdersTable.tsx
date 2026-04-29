/**
 * DydxOrdersTable 组件
 * 显示订单列表,支持搜索和取消订单，UI 参考设计稿
 */

"use client";

import React, { useState, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { Search, X, ListFilter } from "lucide-react";
import ProxyImage from "@/components/common/ProxyImage";
import Link from "next/link";
import PnaEmptyState from "./PnaEmptyState";

interface DydxOrdersTableProps {
    orders: any[];
    isLoading: boolean;
    onCancelOrder?: (order: any) => Promise<void>;
    onCancelAll?: () => Promise<void>;
    isCanceling?: string | null;
}

export default function DydxOrdersTable({
    orders,
    isLoading,
    onCancelOrder,
    onCancelAll,
    isCanceling,
}: DydxOrdersTableProps) {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState("");

    // 字段适配：新接口字段 -> 渲染层字段（保留 expiresAt 原始毫秒值）
    const adaptOrder = (order: any) => ({
        ...order,
        price: order.price ?? order.orderPrice,
        filled: order.filled ?? (order.filledSize !== undefined ? String(order.filledSize) : '0'),
        shares: order.shares ?? (order.placedSize !== undefined ? String(order.placedSize) : '0'),
        total: order.total ?? order.placedAmount,
        outcome: order.outcome ?? order.outComeUnionKey,
        id: order.id ?? String(order.orderId),
    });

    // 剩余时间倒计时（毫秒 -> 本地化字符串）
    const formatExpiry = (expiresAt: number | null | undefined): string => {
        const ordersT = (t as any).pna?.orders;
        if (!expiresAt) return ordersT?.untilCancelled ?? 'GTC';
        const diffMs = expiresAt - Date.now();
        if (diffMs <= 0) return ordersT?.expired ?? 'Expired';
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);
        const fmt = (tpl: string, n: number) => (tpl ?? '').replace('{{n}}', String(n));
        if (diffSec < 60) return fmt(ordersT?.expiresInSeconds ?? 'in {{n}}s', diffSec);
        if (diffMin < 60) return fmt(ordersT?.expiresInMinutes ?? 'in {{n}}m', diffMin);
        if (diffHour < 24) return fmt(ordersT?.expiresInHours ?? 'in {{n}}h', diffHour);
        return fmt(ordersT?.expiresInDays ?? 'in {{n}}d', diffDay);
    };

    // 获取侧边/结果样式 (Yes -> 20¢ 格式)
    const renderOutcomeBadge = (order: any) => {
        const outcomeRaw = order.outcome ?? order.outComeUnionKey ?? '';
        const isYes = String(outcomeRaw).toUpperCase().includes('YES');
        const priceInCents = (Number(order.price ?? order.orderPrice ?? 0) * 100).toFixed(0);

        return (
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isYes ? "text-[#02B955] bg-[#02B955]/10" : "text-[#F9452C] bg-[#F9452C]/10"}`}>
                {outcomeRaw} {priceInCents}¢
            </span>
        );
    };

    // 搜索过滤（先做字段适配）
    const filteredOrders = useMemo(() => {
        const adapted = orders.map(adaptOrder);
        if (!searchQuery.trim()) return adapted;
        const query = searchQuery.toLowerCase();
        return adapted.filter(order =>
            (order.question || '').toLowerCase().includes(query) ||
            (order.tokenId || '').toLowerCase().includes(query) ||
            (order.outComeUnionKey || '').toLowerCase().includes(query) ||
            (order.outcome || '').toLowerCase().includes(query)
        );
    }, [orders, searchQuery]);

    if (isLoading && orders.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="text-[var(--text-secondary)] text-sm">{t.common?.loading || "Loading..."}</div>
            </div>
        );
    }

    const DiamondIcon = () => (
        <span className="inline-block ml-1 opacity-50 scale-75">◇</span>
    );

    return (
        <div className="w-full flex flex-col gap-4">
            {/* Top Controls */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                <div className="relative w-full md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                    <input
                        type="text"
                        placeholder={t.pna.orders.searchPlaceholder || "Search"}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-10 pl-10 pr-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* <button className="flex-1 md:flex-none h-10 px-4 flex items-center justify-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-[var(--bg-hover)] transition-colors">
                        <ListFilter className="w-4 h-4" />
                        <span>{t.pna.orders.totalQuantity || "Total Quantity"}</span>
                    </button> */}
                    {/* <button
                        onClick={onCancelAll}
                        className="flex-1 md:flex-none h-10 px-4 flex items-center justify-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-[var(--bg-hover)] transition-colors"
                    >
                        <X className="w-4 h-4" />
                        <span>{t.pna.orders.cancelAll || "Cancel all"}</span>
                    </button> */}
                </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto">
                <table className="min-w-full w-full text-sm border-separate border-spacing-y-2">
                    <thead>
                        <tr className="text-[var(--text-secondary)] font-medium text-[10px] uppercase tracking-wider">
                            <th className="text-left py-1 px-4">
                                {t.pna.orders.market}
                            </th>
                            <th className="text-center py-1 px-4">
                                {t.pna.orders.filled}
                            </th>
                            <th className="text-center py-1 px-4">
                                {t.pna.orders.amount}
                            </th>
                            <th className="text-left py-1 px-4">
                                {t.pna.orders.expiration}
                            </th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredOrders.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="py-10 text-center">
                                    <PnaEmptyState
                                        className="py-0"
                                        message={t.pna.orders.noOrders || "No open orders"}
                                    />
                                </td>
                            </tr>
                        ) : (
                            filteredOrders.map((order) => (
                                <tr
                                    key={order.orderId || order.id}
                                    className="bg-[var(--bg-secondary)]/50 border border-[var(--border)] rounded-xl hover:border-[var(--border-hover)] transition-all overflow-hidden"
                                >
                                    {/* MARKET */}
                                    <td className="py-3 px-4 first:rounded-l-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 rounded-lg overflow-hidden bg-[var(--bg-primary)] shrink-0">
                                                <ProxyImage
                                                    src={order.eventImage || order.icon}
                                                    alt={order.question}
                                                    className="w-full h-full object-cover"
                                                    fallbackSrc="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQiIGhlaWdodD0iNDQiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIGZpbGw9IiMyYTJhMmEiLz48L3N2Zz4="
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1 min-w-0">
                                                <Link href={`/market/${order.eventSlug}`}>
                                                    <span className="text-[var(--text-primary)] font-semibold text-sm truncate block leading-tight max-w-[300px]" title={order.question}>
                                                        {order.question}
                                                    </span>
                                                </Link>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[var(--text-secondary)] text-xs capitalize">
                                                        {order.side || "Buy"}
                                                    </span>
                                                    {renderOutcomeBadge(order)}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* FILLED */}
                                    <td className="text-center py-3 px-4 text-[var(--text-primary)] font-medium">
                                        {order.filled || "0"} / {order.shares || "0"}
                                    </td>

                                    {/* TOTAL */}
                                    <td className="text-center py-3 px-4 text-[var(--text-primary)] font-bold">
                                        ${Number(order.total || 0).toFixed(2)}
                                    </td>

                                    {/* EXPIRATION */}
                                    <td className="text-left py-3 px-4 text-[var(--text-secondary)] text-sm">
                                        {formatExpiry(order.expiresAt)}
                                    </td>

                                    {/* ACTION */}
                                    <td className="py-3 px-4 last:rounded-r-xl text-right">
                                        {onCancelOrder && (
                                            <button
                                                onClick={() => onCancelOrder(order)}
                                                disabled={isCanceling === (order.orderId || order.id)}
                                                className="p-1 hover:bg-[var(--bg-hover)] rounded-md transition-colors text-[var(--text-secondary)] hover:text-[#F9452C] disabled:opacity-50"
                                            >
                                                {isCanceling === (order.orderId || order.id) ? (
                                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <X className="w-4 h-4" />
                                                )}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
