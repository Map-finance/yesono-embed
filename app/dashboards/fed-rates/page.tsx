"use client";

import { PrimaryOutcomeBar } from "@/components/dashboards/ElectionCard";
import ButtonSwitch from "@/components/ui/ButtonSwitch";
import ProbabilityGauge from "@/components/ui/charts/ProbabilityGauge";
import Countdown from "@/components/ui/Countdown";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

const options = [
  {
    label: (
      <div className="px-2 size-full cursor-pointer flex items-center justify-center">
        Jan 28
      </div>
    ),
    value: "jan-28",
  },
  {
    label: (
      <div className="px-2 size-full cursor-pointer flex items-center justify-center">
        Mar 18
      </div>
    ),
    value: "mar-18",
  },
  {
    label: (
      <div className="px-2 size-full cursor-pointer flex items-center justify-center">
        Apr 29
      </div>
    ),
    value: "apr-29",
  },
];

export default function FedRatesPage() {
  const { t } = useTranslation();
  const [value, setValue] = useState("jan-28");
  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold">{t.dashboards.fedRates.title}</h1>
        <p className="mt-2 text-(--text-secondary)">
          {t.dashboards.fedRates.subtitle}
        </p>
      </div>
      <div className="mt-4">
        <ButtonSwitch
          options={options}
          value={value}
          onClick={setValue}
        ></ButtonSwitch>
      </div>
      <div className="mt-6 flex items-center border border-(--border) p-8 rounded-lg justify-between max-md:hidden">
        <div>
          <div className="text-(--text-secondary)">{t.dashboards.fedRates.expectedDecision}</div>
          <div className="font-semibold text-2xl mt-1">{t.dashboards.fedRates.noChange}</div>
        </div>
        <div>
          <ProbabilityGauge
            value={75}
            cornerRadius={15}
            thickness={15}
            color="#ffe44d"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="font-semibold">{t.dashboards.fedRates.meetingIn}</div>
          <Countdown targetTime="2026-01-28T00:00:00" />
        </div>
      </div>
      {/* mobile view start */}
      <div className="max-md:block md:hidden mt-4">
        <div className="flex justify-between items-center border border-(--border) p-2 px-4 rounded-lg">
          <div className="font-semibold">{t.dashboards.fedRates.meetingIn}</div>
          <Countdown targetTime="2026-01-28T00:00:00" />
        </div>
        <div className="flex justify-between items-center border border-(--border) p-2 px-4 rounded-lg mt-4">
          <div>
            <div className="text-(--text-secondary)">{t.dashboards.fedRates.expectedDecision}</div>
            <div className="font-semibold text-2xl mt-1">{t.dashboards.fedRates.noChange}</div>
          </div>
          <div className="w-40 -translate-y-5">
            <ProbabilityGauge
              value={75}
              cornerRadius={15}
              thickness={8}
              color="#ffe44d"
            />
          </div>
        </div>
      </div>
      {/* mobile view end */}
      <div className="mt-4 border border-(--border) p-5 rounded-lg">
        <h2 className="text-xl font-semibold">{t.dashboards.fedRates.fedDecision}</h2>
        <p className="font-semibold text-(--text-secondary) mt-1">
          Wed Jan 28, 2026 {t.dashboards.fedRates.fomcMeeting}
        </p>
        <div className="flex flex-col gap-2 mt-5">
          {[1, 2, 3, 4].map((_, idx) => (
            <a className="block" href={`/market/${idx + 1}`} key={idx}>
              <PrimaryOutcomeBar
                name={`Candidate ${idx + 1}`}
                winRate={Math.random() * 100}
              />
            </a>
          ))}
        </div>
      </div>
      <div className="mt-6">
        <h1>{t.dashboards.fedRates.oddsOverTime}</h1>
        <div className="mt-4 border border-(--border) rounded-lg h-[206px] flex items-center justify-center">
          todo chart
        </div>
      </div>
    </div>
  );
}
