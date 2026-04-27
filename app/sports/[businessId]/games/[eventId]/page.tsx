"use client";

import { useEffect, useRef } from "react";

import { MarketDetailTabs } from "@/components/detail";
import MarketGroup from "@/components/sports/MarketGroup";
import ScoreboardPanel from "@/components/sports/ScoreboardPanl";
import IconButton from "@/components/ui/IconButton";
import useSportsStore from "@/lib/stores/sportsStore";
import { ArrowLeft, Bookmark, Code, Link } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { trackEvent } from "@/lib/sentryClient";

export default function GamePage() {
    const { t } = useTranslation();
    const router = useRouter();
    const params = useParams();
    const selectedMenu = useSportsStore(state => state.selectedMenu);
    const trackedRef = useRef<string | null>(null);

    useEffect(() => {
        const eventId = String(params?.eventId ?? "");
        const businessId = String(params?.businessId ?? "");
        if (!eventId) return;

        const menuSport = selectedMenu?.startsWith("sport:")
            ? selectedMenu.split(":")[1]
            : undefined;
        const sportsName = menuSport || businessId || "sports";
        const sportsSlug = businessId || sportsName;
        const key = `${eventId}:${sportsSlug}`;
        if (trackedRef.current === key) return;
        trackedRef.current = key;

        trackEvent("sports_detail", {
            sports_name: sportsName,
            sports_id: eventId,
            sports_slug: sportsSlug,
        });
    }, [params?.businessId, params?.eventId, selectedMenu]);

    const handleBackClick = () => {
        router.back();
    }

    return (
        <div>
            <div className="flex justify-between items-center">
                <div className="flex gap-2 items-center cursor-pointer group" onClick={handleBackClick}>
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 group-hover:scale-[1.02] transition-transform" />
                    <div className="text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{t.sports.game.backTo} <span className="uppercase">{selectedMenu?.split(':').pop()}</span></div>
                </div>
                <div className="flex">
                    <IconButton>
                        <Code size={20} />
                    </IconButton>
                    <IconButton>
                        <Bookmark size={20} />
                    </IconButton>
                    <IconButton>
                        <Link size={20} />
                    </IconButton>
                </div>
            </div>
            <div className="mt-4 flex flex-col gap-4">
                <ScoreboardPanel />
                <MarketGroup />
                <MarketDetailTabs marketId="12" />
            </div>
        </div>
    );
}
