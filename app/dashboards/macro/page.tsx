"use client";

import EconomyCard from "@/components/dashboards/EconomyCard";
import ElectionCard from "@/components/dashboards/ElectionCard";
import MacroDashboardCard from "@/components/dashboards/MacroDashboardCard";
import { fetchElectionData } from "@/lib/mockData";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useEffect, useState } from "react";
import type { Election } from "../global-elections/page";

export default function MacroPage() {
  const { t } = useTranslation();
  const [electionData, setElectionData] = useState<Election[]>([]);

  useEffect(() => {
    fetchElectionData().then(setElectionData);
  }, []);

  return (
    <div>
      <div>
        <h1 className="text-3xl font-semibold">{t.dashboards.macro.title}</h1>
        <div className="mt-4">
          <MacroDashboardCard />
        </div>
      </div>
      <div className="mt-6">
        <h1 className="text-3xl font-semibold">{t.dashboards.macro.economy}</h1>
        <div className="flex gap-3 mt-4 max-md:flex-col">
          {[1, 2, 3].map((_, idx) => (
            <div key={idx} className="flex-1">
              <EconomyCard />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-semibold">{t.dashboards.macro.keyElections}</h1>
          <div className="bg-(--bg-secondary) pl-3 py-[5px] flex items-center rounded-sm cursor-pointer hover:bg-(--bg-hover) transition-colors">
            <div className="font-semibold">{t.dashboards.macro.viewAll}</div>
            <ChevronRight />
          </div>
        </div>
        <div className="flex gap-3 mt-4 max-md:flex-col">
          {electionData.slice(0, 2).map((election) => (
            <div key={election.id} className="flex-1">
              <ElectionCard month={""} day={0} {...election} />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-6">
        <h1 className="text-3xl font-semibold">{t.dashboards.macro.geopolitics}</h1>
        <div className="flex gap-3 mt-4 max-md:flex-col">
          {[1, 2, 3].map((_, idx) => (
            <div key={idx} className="flex-1">
              <EconomyCard />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
