"use client";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import { useState, useMemo } from "react";
import { useTranslation } from '@/lib/i18n';

// Mock data
const sportTypes = [
  { value: "football", label: "Football" },
  { value: "basketball", label: "Basketball" },
  { value: "csgo", label: "CSGO" },
];

const leagues: Record<string, { value: string; label: string }[]> = {
  football: [
    { value: "club-friendly", label: "Club Friendly" },
    { value: "premier-league", label: "Premier League" },
    { value: "la-liga", label: "La Liga" },
  ],
  basketball: [
    { value: "nba", label: "NBA" },
    { value: "cba", label: "CBA" },
  ],
  csgo: [
    { value: "major", label: "Major" },
    { value: "pro-league", label: "Pro League" },
  ],
};

interface InfoFormProps {
  onNext: (data: {
    sportType: string;
    league: string;
    team1: string;
    team2: string;
    matchTime: string;
  }) => void;
  onPrevious?: () => void;
  initialData?: {
    sportType?: string;
    league?: string;
    team1?: string;
    team2?: string;
    matchTime?: string;
  };
}

export default function CreateMarketSportsInfoForm({
  onNext,
  onPrevious = () => {},
  initialData = {},
}: InfoFormProps) {
  const { t } = useTranslation();
  const [sportType, setSportType] = useState<string | undefined>(
    initialData.sportType,
  );
  const [league, setLeague] = useState<string | undefined>(initialData.league);
  const [team1, setTeam1] = useState<string>(initialData.team1 || "");
  const [team2, setTeam2] = useState<string>(initialData.team2 || "");
  const [matchTime, setMatchTime] = useState<string>(
    initialData.matchTime || "",
  );
  const [isLoading, setIsLoading] = useState(false);

  const leagueOptions = useMemo(() => {
    if (!sportType) return [];
    return leagues[sportType] || [];
  }, [sportType]);

  const handleSportTypeChange = (value: string) => {
    setSportType(value);
    setLeague(undefined); // Reset league when sport type changes
  };

  const handleSubmit = async () => {
    if (!sportType || !league || !team1 || !team2 || !matchTime) {
      return;
    }

    setIsLoading(true);
    try {
      // Additional async validation can be performed here
      await new Promise((resolve) => setTimeout(resolve, 500));

      onNext({
        sportType,
        league,
        team1,
        team2,
        matchTime,
      });
    } catch (error) {
      console.error("Submission failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isValid = sportType && league && team1 && team2 && matchTime;

  return (
    <div>
      <div className="flex gap-6 text-xs max-md:flex-col max-md:gap-4">
        <div className="flex-1">
          <div className="mt-6">
            <div className="mb-2 text-[var(--text-secondary)]">{t.market.common.sportType}</div>
            <Select
              options={sportTypes}
              className="w-full"
              value={sportType}
              onChange={handleSportTypeChange}
              placeholder={t.market.create.selectSportType}
              disabled={isLoading}
            />
          </div>
          <div className="mt-6">
            <div className="mb-2 text-[var(--text-secondary)]">
              {t.market.common.leagueEvent}
            </div>
            <Select
              options={leagueOptions}
              className="w-full"
              value={league}
              onChange={setLeague}
              placeholder={t.market.create.selectLeague}
              disabled={isLoading || !sportType}
            />
          </div>
          <div className="mt-6">
            <div className="mb-2 text-[var(--text-secondary)]">{t.market.common.teamEntry}</div>
            <div className="flex gap-2 items-center">
              <Input
                type="text"
                value={team1}
                onChange={(e) => setTeam1(e.target.value)}
                placeholder={t.market.create.team1}
                disabled={isLoading}
                className="flex-1"
              />
              <span className="text-[var(--text-secondary)]">vs</span>
              <Input
                type="text"
                value={team2}
                onChange={(e) => setTeam2(e.target.value)}
                placeholder={t.market.create.team2}
                disabled={isLoading}
                className="flex-1"
              />
            </div>
          </div>
          <div className="mt-6">
            <div className="mb-2 text-[var(--text-secondary)]">{t.market.common.matchTime}</div>
            <Input
              type="datetime-local"
              value={matchTime}
              onChange={(e) => setMatchTime(e.target.value)}
              placeholder={t.market.create.selectMatchTime}
              disabled={isLoading}
              fullWidth
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end mt-6 gap-3 max-md:flex-col-reverse">
        {onPrevious && (
          <button
            onClick={onPrevious}
            disabled={isLoading}
            className="text-[var(--text-secondary)] text-sm underline hover:text-[var(--text-primary)] disabled:opacity-50 max-md:w-full max-md:py-2"
          >
            {t.market.common.back}
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          className="px-4 py-2 rounded-full bg-[var(--accent)] text-sm text-black font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity max-md:w-full"
        >
          {isLoading ? t.market.common.processing : t.market.common.next}
        </button>
      </div>
    </div>
  );
}
