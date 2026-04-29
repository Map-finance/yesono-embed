"use client";

import { useState, useEffect, useCallback } from "react";
import { useDydx } from "@/lib/hooks/useDydx";
import { cancelOrderApi } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { useAuthHydration } from "@/lib/hooks/useAuthHydration";
import { useToast } from "@/components/ui/Toast";
import { trackEvent } from "@/lib/sentryClient";
import useGetOrders from "../hooks/useGetOrders";
import DydxOrdersTable from "./DydxOrdersTable";

interface OpenOrdersTabProps {
    isActive: boolean;
    onRefreshActivity?: () => void;
    userId?: string;
}

export default function OpenOrdersTab({ isActive, onRefreshActivity, userId }: OpenOrdersTabProps) {
    const { t } = useTranslation();
    const toast = useToast();
    const { isReady } = useAuthHydration();
    const { cancelOrder } = useDydx();
    const [isCancelingOrderId, setIsCancelingOrderId] = useState<string | null>(null);

    const {
        orders,
        isLoading: isOrdersLoading,
        refresh: refreshOrders,
    } = useGetOrders({ enabled: isActive && isReady, userId });

    // Tab 激活时刷新数据
    useEffect(() => {
        if (isActive && isReady) {
            refreshOrders();
        }
    }, [isActive, isReady]);

    const handleCancelDydxOrder = useCallback(async (order: any) => {
        console.log("[Cancel] order:", order);

        setIsCancelingOrderId(String(order.orderId));
        try {
            let cancelResp: any = null;
            if (order.orderId) {
                try {
                    cancelResp = await cancelOrderApi({ orderId: String(order.orderId) });
                    console.log("[Cancel] Server cancel response:", cancelResp);
                } catch (apiErr) {
                    console.warn("[Cancel] API call failed:", apiErr);
                }
            }

            const internalOrders: any[] = cancelResp?.data?.internalOrders ?? [];
            const dydxSubOrders = internalOrders.filter(
                (sub: any) => sub?.dydxOrderData?.order
            );

            if (dydxSubOrders.length > 0) {
                for (const sub of dydxSubOrders) {
                    const o = sub.dydxOrderData.order;
                    const clientId = parseInt(o.clientId);
                    const orderFlags = parseInt(o.orderFlags ?? "0");
                    const clobPairId = parseInt(o.clobPairId);
                    const subaccNum = parseInt(o.subaccountNumber ?? "1");
                    const goodTilTimeInSeconds = o.goodTilBlockTime
                        ? Math.floor(new Date(o.goodTilBlockTime).getTime() / 1000)
                        : undefined;

                    console.log("[Cancel] Calling cancelRawOrder:", {
                        clientId,
                        orderFlags,
                        clobPairId,
                        goodTilTimeInSeconds,
                        subaccNum,
                    });

                    try {
                        await cancelOrder(
                            clientId,
                            orderFlags,
                            clobPairId,
                            undefined,
                            goodTilTimeInSeconds,
                            subaccNum
                        );
                    } catch (chainErr) {
                        console.error(
                            "[Cancel] Chain cancel failed for sub-order:",
                            sub.subOrderId,
                            chainErr
                        );
                    }
                }
            } else {
                console.log("[Cancel] No dydxOrderData found, skipping on-chain cancel");
            }

            const orderIdForTrack = String(order.orderId ?? order.id ?? "");
            if (orderIdForTrack) {
                trackEvent("order_cancel", { order_id: orderIdForTrack });
            }

            toast.success(t.pna.orders.cancelSuccess || "Order canceled successfully");
            refreshOrders();
            onRefreshActivity?.();
        } catch (error: any) {
            console.error("[PNA] Cancel order failed:", error);
            toast.error(t.pna.orders.cancelFailed || "Failed to cancel order");
        } finally {
            setIsCancelingOrderId(null);
        }
    }, [cancelOrder, refreshOrders, onRefreshActivity, toast, t]);

    const handleCancelAllOrders = useCallback(async (market?: string) => {
        try {
            toast.info(t.pna.orders.cancelingAll || "Canceling all orders...");
        } catch (error: any) {
            console.error("[PNA] Cancel all orders failed:", error);
            toast.error(t.pna.orders.cancelAllFailed || "Failed to cancel orders");
        }
    }, [toast, t]);

    return (
        <div className="mt-6">
            <DydxOrdersTable
                orders={orders}
                isLoading={isOrdersLoading}
                onCancelOrder={handleCancelDydxOrder}
                onCancelAll={handleCancelAllOrders}
                isCanceling={isCancelingOrderId}
            />
        </div>
    );
}
