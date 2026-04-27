"use client"

import { mockStartingSoonGames } from "@/lib/mockData";
import GameList from "@/components/sports/GameList";
import { useTranslation } from "@/lib/i18n";

export interface GamesProps {

}

export default function StartingSoonGames() {
    const { t } = useTranslation();
    return (
        <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
                <div className="text-3xl font-semibold">{t.sports.live.startingSoon}</div>
            </div>
            <GameList games={mockStartingSoonGames} showTimeDivider={true} />
        </div>
    )
}
