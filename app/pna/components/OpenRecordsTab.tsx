"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { getUserMarketRecords } from "@/lib/api";
import { useI18n } from "@/components/hooks/useI18n";
import { useLocale } from "@/lib/i18n";
import { formatHandicap } from "@/utils/handicap";
import { OpenRecordType } from "../types";
import { MarketRecord } from "@/types/market-record";
import { useAuthStore } from "@/lib/stores/authStore";
import { useToast } from "@/components/ui/Toast";
import Select from "@/components/ui/Select";
import PnaEmptyState from "./PnaEmptyState";

const pageSizeOptions = [5, 10, 20, 50];

interface OpenRecordsTabProps {
    isActive: boolean;
}

const OpenRecordsTab: React.FC<OpenRecordsTabProps> = ({ isActive }) => {
    const toast = useToast();
    const { t } = useI18n();
    const { locale } = useLocale();
    const { accessToken, isAuthenticated } = useAuthStore();

    const [openRecordData, setOpenRecordData] = useState<OpenRecordType[]>([]);
    const [openRecordLoading, setOpenRecordLoading] = useState(false);
    const [openRecordPagination, setOpenRecordPagination] = useState({
        current: 1,
        pageSize: 5,
        total: 0,
    });

    const transformMarketRecordData = useCallback(
        (apiData: MarketRecord[]): OpenRecordType[] => {
            return apiData.map((record, index) => {
                const formatTimestamp = (timestamp: number) => {
                    try {
                        const date =
                            timestamp.toString().length <= 10
                                ? new Date(timestamp * 1000)
                                : new Date(timestamp);
                        return date.toLocaleString("zh-CN", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                        });
                    } catch (error) {
                        console.warn("[OpenRecordsTab] Failed to format timestamp", error);
                        return t("timeUnknown");
                    }
                };

                const getTeamInfo = () => {
                    if (!record.event?.options?.length) {
                        return {
                            homeTeam: t("unknownHomeTeam"),
                            awayTeam: t("unknownAwayTeam"),
                        };
                    }

                    const homeOption = record.event.options.find((option) => option.code === "1");
                    const awayOption = record.event.options.find((option) => option.code === "2");

                    return {
                        homeTeam: homeOption?.name || t("unknownHomeTeam"),
                        awayTeam: awayOption?.name || t("unknownAwayTeam"),
                    };
                };

                const getPoolInfo = () => {
                    if (!record.options?.length) {
                        return { homePool: "0", awayPool: "0" };
                    }

                    const homeOption = record.options.find((option) => option.code === "1");
                    const awayOption = record.options.find((option) => option.code === "2");

                    const homeTurnover = homeOption?.turnover ?? 0;
                    const awayTurnover = awayOption?.turnover ?? 0;

                    return {
                        homePool: Number(homeTurnover || 0).toLocaleString(),
                        awayPool: Number(awayTurnover || 0).toLocaleString(),
                    };
                };

                const getMatchResult = () => {
                    if (!record.event?.options?.length) {
                        return "- : -";
                    }

                    const homeOption = record.event.options.find((option) => option.code === "1");
                    const awayOption = record.event.options.find((option) => option.code === "2");
                    const homeScore = homeOption?.outcomeValue || "";
                    const awayScore = awayOption?.outcomeValue || "";

                    if (!homeScore && !awayScore) {
                        return "- : -";
                    }

                    return `${homeScore || "-"}:${awayScore || "-"}`;
                };

                const { homeTeam, awayTeam } = getTeamInfo();
                const { homePool, awayPool } = getPoolInfo();
                const setupFeeRaw = record.setupFee;
                const setupFeeNum = setupFeeRaw == null ? 0 : Number(setupFeeRaw);
                const setupFee = Number.isFinite(setupFeeNum) && setupFeeNum > 0
                    ? setupFeeNum.toLocaleString()
                    : "0";

                return {
                    key: record.id.toString(),
                    serialNumber: (index + 1).toString().padStart(2, "0"),
                    league: record.event?.name || t("unknownLeague"),
                    event: `${homeTeam} vs ${awayTeam}`,
                    handicapType: record.mechanism || t("unknownType"),
                    handicap: record.line || "0",
                    homeTeamPool: homePool,
                    awayTeamPool: awayPool,
                    setupFee,
                    createTime: formatTimestamp(record.createdAt),
                    eventStatus: record.event?.stateName || t("unknownStatus"),
                    matchResult: getMatchResult(),
                };
            });
        },
        [t]
    );

    const fetchOpenRecordData = useCallback(
        async (page: number = 1, pageSize: number = 5) => {
            if (!isAuthenticated || !accessToken) return;

            setOpenRecordLoading(true);
            try {
                const response = await getUserMarketRecords(page, pageSize, "football");

                if (response.success && response.data) {
                    const transformedData = transformMarketRecordData(response.data.records || []);
                    setOpenRecordData(transformedData);
                    setOpenRecordPagination((prev) => ({
                        ...prev,
                        current: response.data.current || page,
                        pageSize: response.data.size || pageSize,
                        total: response.data.total || 0,
                    }));
                } else {
                    toast.error(response.msg || t("fetchOpenRecordsFailed"));
                    console.error("fetchOpenRecordData failed:", response.msg);
                }
            } catch (error) {
                console.error("fetchOpenRecordData failed:", error);
                toast.error(t("fetchOpenRecordsFailed"));
            } finally {
                setOpenRecordLoading(false);
            }
        },
        [accessToken, isAuthenticated, t, toast, transformMarketRecordData]
    );

    useEffect(() => {
        if (!(isActive && isAuthenticated && accessToken)) return;

        const timer = window.setTimeout(() => {
            void fetchOpenRecordData();
        }, 0);

        return () => window.clearTimeout(timer);
    }, [isActive, isAuthenticated, accessToken, fetchOpenRecordData, locale]);

    const handleOpenRecordPaginationChange = (page: number, pageSize?: number) => {
        void fetchOpenRecordData(page, pageSize || openRecordPagination.pageSize);
    };

    const totalPages = Math.max(
        1,
        Math.ceil(openRecordPagination.total / openRecordPagination.pageSize)
    );
    const currentPage = Math.min(openRecordPagination.current, totalPages);
    const hasRows = openRecordData.length > 0;
    const showInitialLoading = openRecordLoading && !hasRows;

    const goToPage = (nextPage: number) => {
        const safePage = Math.min(Math.max(nextPage, 1), totalPages);
        if (safePage === currentPage) return;
        handleOpenRecordPaginationChange(safePage, openRecordPagination.pageSize);
    };

    const changePageSize = (nextPageSize: number) => {
        if (nextPageSize === openRecordPagination.pageSize) return;
        handleOpenRecordPaginationChange(1, nextPageSize);
    };

    return (
        <div className="w-full overflow-x-auto">
            <div className="relative min-w-275 overflow-hidden rounded-xl border border-(--border) bg-(--bg-primary)">
                {openRecordLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-(--bg-primary)/55 backdrop-blur-[1px]">
                        <div className="flex items-center gap-2 rounded-full border border-(--border) bg-(--bg-primary) px-4 py-2 text-sm text-(--text-secondary) shadow-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            {t("loading") || "Loading..."}
                        </div>
                    </div>
                )}

                <table className="w-full border-separate border-spacing-0">
                    <thead className="bg-(--bg-secondary)">
                        <tr className="text-left text-xs font-semibold uppercase tracking-wider text-(--text-secondary)">
                            <th className="px-4 py-3 text-center w-15">{t("serialNumber")}</th>
                            <th className="px-4 py-3 w-30">{t("league")}</th>
                            <th className="px-4 py-3 w-60">{t("event")}</th>
                            <th className="px-4 py-3 text-center w-30">{t("handicapType")}</th>
                            <th className="px-4 py-3 text-center w-25">{t("handicap")}</th>
                            <th className="px-4 py-3 text-center w-30">{t("homeTeamPool")}</th>
                            <th className="px-4 py-3 text-center w-30">{t("awayTeamPool")}</th>
                            <th className="px-4 py-3 text-center w-25">{t("openingFee")}</th>
                            <th className="px-4 py-3 w-40">{t("createTime")}</th>
                            <th className="px-4 py-3 text-center w-30">{t("eventStatus")}</th>
                            <th className="px-4 py-3 text-center w-25">{t("matchResult")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {!showInitialLoading && !hasRows ? (
                            <tr>
                                <td colSpan={11} className="px-4 py-0">
                                    <PnaEmptyState message={t("noOrders") || "暂无订单"} />
                                </td>
                            </tr>
                        ) : (
                            openRecordData.map((record) => {
                                const lineValue = Number(record.handicap);

                                return (
                                    <tr
                                        key={record.key}
                                        className="border-b border-(--border) transition-colors hover:bg-(--bg-secondary)/70"
                                    >
                                        <td className="px-4 py-4 text-center text-[12px] md:text-[14px] font-number text-(--text-primary)">
                                            {record.serialNumber}
                                        </td>
                                        <td className="px-4 py-4 text-[12px] md:text-[14px] text-(--text-primary)">
                                            <span className="block truncate" title={record.league}>
                                                {record.league}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-[12px] md:text-[14px] text-(--text-primary)">
                                            <span className="block truncate" title={record.event}>
                                                {record.event}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center text-[12px] md:text-[14px] text-(--text-primary)">
                                            {record.handicapType === "overUnder"
                                                ? t("overUnder")
                                                : t("handicap")}
                                        </td>
                                        <td className="px-4 py-4 text-center text-[12px] md:text-[14px] text-(--text-primary) font-number">
                                            {Number.isFinite(lineValue)
                                                ? formatHandicap(lineValue, false)
                                                : record.handicap}
                                        </td>
                                        <td className="px-4 py-4 text-center text-[12px] md:text-[14px] text-(--text-primary) font-number">
                                            {record.homeTeamPool}
                                        </td>
                                        <td className="px-4 py-4 text-center text-[12px] md:text-[14px] text-(--text-primary) font-number">
                                            {record.awayTeamPool}
                                        </td>
                                        <td className="px-4 py-4 text-center text-[12px] md:text-[14px] text-(--text-primary) font-number">
                                            {record.setupFee}
                                        </td>
                                        <td className="px-4 py-4 text-[12px] md:text-[14px] text-(--text-primary) font-number">
                                            {record.createTime}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="inline-flex min-w-18 items-center justify-center rounded-full border border-(--border) bg-(--bg-secondary) px-2.5 py-1 text-[10px] md:text-[12px] text-(--text-primary)">
                                                {record.eventStatus}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center text-[12px] md:text-[14px] text-(--text-primary) font-number">
                                            {record.matchResult}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>

                <div className="flex flex-col gap-3 border-t border-(--border) px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-(--text-secondary)">
                        {t("totalRecords", {
                            total: openRecordPagination.total.toString(),
                        })}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 text-sm text-(--text-secondary)">
                            <span>Page size</span>
                            <Select
                                options={pageSizeOptions.map((size) => ({
                                    value: size,
                                    label: size.toString(),
                                }))}
                                value={openRecordPagination.pageSize}
                                onChange={changePageSize}
                                className="min-w-24"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => goToPage(currentPage - 1)}
                                disabled={currentPage <= 1}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-(--border) bg-(--bg-primary) text-(--text-primary) transition-colors hover:bg-(--bg-secondary) disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label={t("previousPage") || "Previous page"}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>

                            <span className="min-w-22 rounded-md border border-(--border) px-3 py-2 text-center text-sm text-(--text-primary)">
                                {currentPage} / {totalPages}
                            </span>

                            <button
                                type="button"
                                onClick={() => goToPage(currentPage + 1)}
                                disabled={currentPage >= totalPages}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-(--border) bg-(--bg-primary) text-(--text-primary) transition-colors hover:bg-(--bg-secondary) disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label={t("nextPage") || "Next page"}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OpenRecordsTab;
