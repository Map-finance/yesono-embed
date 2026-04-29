"use client";

import { useState, useEffect } from "react";
import PositionsTable from "./PositionsTable";
import useGetPositions from "../hooks/useGetPositions";
import useGetClosedPositions from "../hooks/useGetClosedPositions";
import { useAuthHydration } from "@/lib/hooks/useAuthHydration";

interface PositionsTabProps {
    isActive: boolean;
    userId?: string;
    allowClaim?: boolean;
}

export default function PositionsTab({ isActive, userId, allowClaim = true }: PositionsTabProps) {
    const { isReady } = useAuthHydration();
    const [activeSubTab, setActiveSubTab] = useState<"active" | "closed">("active");

    // Only fetch when tab is active and auth is ready
    const shouldFetchActive = isActive && isReady && activeSubTab === "active";
    const shouldFetchClosed = isActive && isReady && activeSubTab === "closed";

    const {
        positions: activePositions,
        isLoading: isActivePositionsLoading,
        refresh: refreshActivePositions,
    } = useGetPositions({ enabled: shouldFetchActive, userId });

    const {
        positions: closedPositions,
        isLoading: isClosedPositionsLoading,
        refresh: refreshClosedPositions,
    } = useGetClosedPositions({ enabled: shouldFetchClosed, userId });

    const currentPositions = activeSubTab === "active" ? activePositions : closedPositions;
    const isPositionsLoading = activeSubTab === "active" ? isActivePositionsLoading : isClosedPositionsLoading;
    const refreshPositions = activeSubTab === "active" ? refreshActivePositions : refreshClosedPositions;

    // Tab 切换或激活时刷新数据
    useEffect(() => {
        if (isActive && isReady) {
            refreshPositions();
        }
    }, [isActive, activeSubTab, isReady]);

    return (
        <PositionsTable
            positions={currentPositions}
            isLoading={isPositionsLoading}
            activeSubTab={activeSubTab}
            onSubTabChange={setActiveSubTab}
        />
    );
}
