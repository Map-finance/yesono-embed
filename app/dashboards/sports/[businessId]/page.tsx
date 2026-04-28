"use client";


import React, { useState } from "react";
import ButtonSwitch from "@/components/ui/ButtonSwitch";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

type FutureItem = {
    id: string;
    short: string;
    name: string;
    percent: number; // display percent value
    color: string;
};

function FuturesChart({ items, initialVisible = 6, title, simple }: { items: FutureItem[]; initialVisible?: number; title: string; simple?: boolean }) {
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const visible = expanded ? items.length : Math.min(initialVisible, items.length);

    return (
        <a className="flex-1" href="/market/1">
            <div className="bg-bg-card p-4 rounded-md hover:scale-[1.02] hover:shadow transition-all">
                <div className="text-lg font-semibold mb-4">{title}</div>

                <div className="space-y-2">
                    {(() => {
                        const max = items.reduce((m, x) => Math.max(m, x.percent), 1);
                        return items.slice(0, visible).map((it) => {
                            const widthPercent = (it.percent / max) * 100;
                            return (
                                <div key={it.id} className="flex items-center gap-3">
                                    <div className="w-36 flex items-center gap-3">
                                        {
                                            !simple && (
                                                <div
                                                    className="size-9 shrink-0 rounded-md flex items-center justify-center text-xs font-bold text-white"
                                                    style={{ backgroundColor: it.color }}
                                                >
                                                    {it.short}
                                                </div>
                                            )
                                        }
                                        <div className="truncate">{it.name}</div>
                                    </div>

                                    <div className={`w-14 text-right font-semibold ml-auto ${!simple ? "text-2xl" : "text-  xl"}`}>{it.percent}%</div>

                                    {!simple && (
                                        <div className="flex-1">
                                            <div className="h-8 rounded-md overflow-hidden">
                                                <div
                                                    className="h-8 rounded-md transition-all"
                                                    style={{ width: `${widthPercent}%`, backgroundColor: it.color }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        });
                    })()}
                </div>

                {
                    items.length > initialVisible && (
                        <div className="mt-6 flex items-center justify-between">
                            <button
                                className="text-(--text-secondary) flex items-center gap-1"
                                onClick={(e) => { e.preventDefault(); setExpanded((s) => !s) }}
                            >
                                {expanded ? t.dashboards.sports.showLess : t.dashboards.sports.showMore}
                                <ChevronDown className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
                            </button>
                        </div>
                    )
                }
            </div>
        </a>
    );
}

export default function SportsPage() {
    const { t } = useTranslation();
    const pathname = usePathname();
    const sampleData: FutureItem[] = [
        { id: "lar", short: "LAR", name: "Los Angeles R", percent: 16, color: "#0369A1" },
        { id: "sea", short: "SEA", name: "Seattle", percent: 13, color: "#0F766E" },
        { id: "buf", short: "BUF", name: "Buffalo", percent: 12, color: "#1E40AF" },
        { id: "den", short: "DEN", name: "Denver", percent: 9, color: "#BE3A15" },
        { id: "phi", short: "PHI", name: "Philadelphia", percent: 9, color: "#0F766E" },
        { id: "ne", short: "NE", name: "New England", percent: 8, color: "#0B5B88" },
        { id: "sf", short: "SF", name: "San Francisco", percent: 7, color: "#B91C1C" },
        { id: "jax", short: "JAX", name: "Jacksonville", percent: 6, color: "#0891B2" },
        { id: "dal", short: "DAL", name: "Dallas", percent: 5, color: "#0EA5A4" },
        { id: "kc", short: "KC", name: "Kansas City", percent: 5, color: "#DC2626" },
        { id: "min", short: "MIN", name: "Minnesota", percent: 4, color: "#7C3AED" },
        { id: "bal", short: "BAL", name: "Baltimore", percent: 4, color: "#0EA5A4" },
        { id: "gb", short: "GB", name: "Green Bay", percent: 3, color: "#15803D" },
        { id: "ind", short: "IND", name: "Indianapolis", percent: 3, color: "#0EA5A4" },
        { id: "ari", short: "ARI", name: "Arizona", percent: 2, color: "#F97316" },
        { id: "tb", short: "TB", name: "Tampa Bay", percent: 2, color: "#D97706" },
        { id: "nyj", short: "NYJ", name: "New York J", percent: 1, color: "#2563EB" },
        { id: "pit", short: "PIT", name: "Pittsburgh", percent: 1, color: "#111827" },
        { id: "hou", short: "HOU", name: "Houston", percent: 1, color: "#F97316" },
        { id: "car", short: "CAR", name: "Carolina", percent: 1, color: "#0EA5A4" },
    ];

    return (
        <div>
            <div className="text-3xl font-semibold">
                <div>{t.dashboards.sports.title}</div>
            </div>
            <div className="mt-4">
                <ButtonSwitch
                    options={[
                        { label: <a href="nfl" className="size-full flex items-center justify-center">NFL</a>, value: "nfl" },
                        { label: <a href="nba" className="size-full flex items-center justify-center">NBA</a>, value: "nba" },
                        { label: <a href="epl" className="size-full flex items-center justify-center">EPL</a>, value: "epl" },
                    ]}
                    value={pathname.split('/').pop()}
                />
            </div>
            <div className="mt-4">
                <FuturesChart items={sampleData} initialVisible={8} title="Super Bowl Winner" />
            </div>
            <div className="flex gap-4 mt-4 max-md:w-full max-md:overflow-x-auto scrollbar-hide">
                <FuturesChart items={sampleData.slice(0, 5)} title="Offensive Rookie of the Year" simple />
                <FuturesChart items={sampleData.slice(0, 5)} title="Defensive Rookie of the Year" simple />
                <FuturesChart items={sampleData.slice(0, 5)} title="Coach of the Year" simple />
            </div>
            <div className="flex gap-4 mt-4 max-md:flex-col">
                <FuturesChart items={sampleData.slice(0, 5)} title="NFC Champion" />
                <FuturesChart items={sampleData.slice(0, 5)} title="AFC Champion" />
            </div>
        </div>
    );
}