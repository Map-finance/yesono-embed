"use client";

import { Election } from "@/app/dashboards/global-elections/page";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function ElectionCard(
  props: Election & { month: string; day: number }
) {
  const router = useRouter();
  const handleClick = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest("a") &&
      (e.target as HTMLElement) !== e.currentTarget
    ) {
      return;
    }
    router.push("/market/1");
  };
  return (
    <div
      onClick={handleClick}
      className="border border-[--border] rounded-lg p-6 font-semibold hover:scale-[1.02] transition-transform cursor-pointer"
    >
      <a href="/market/1">
        <div className="flex gap-4 items-center">
          <div className="text-center">
            <div className="text-2xl">{props.day}</div>
            <div>{props.month}</div>
          </div>
          <div>
            <div className="text-2xl">{props.country}</div>
            <div className="text-[--text-secondary]">{props.electionType}</div>
          </div>
          <Image
            src={props.flagUrl}
            width={48}
            height={48}
            alt=""
            className="ml-auto size-[48px] object-cover rounded-md"
          />
        </div>
      </a>
      <div className="space-y-2 mt-4">
        {props.candidates.map((candidate, index) => (
          <a
            className="block"
            href={`/market/${index + 1}`}
            key={candidate.name}
          >
            <PrimaryOutcomeBar
              name={candidate.name}
              avatar={candidate.avatar}
              winRate={candidate.winRate}
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export interface PrimaryOutcomeBarProps {
  name: string;
  avatar?: string;
  winRate: number;
}

export function PrimaryOutcomeBar(candidate: PrimaryOutcomeBarProps) {
  return (
    <div className="relative rounded-sm bg-[--bg-secondary] font-semibold">
      <div
        className="absolute top-0 left-0 h-full bg-[--accent] rounded-sm opacity-60"
        style={{ width: `${Math.max(candidate.winRate, 1)}%` }}
      ></div>
      <div className="relative px-4 py-[6px] flex items-center">
        <div>
          {candidate.winRate < 1 ? "<1" : Math.floor(candidate.winRate)}%
        </div>
        {candidate.avatar && (
          <div className="size-[28px] flex items-center justify-center bg-white text-[0px] rounded-full ml-3 flex-shrink-0">
            <Image src={candidate.avatar} width={24} height={24} alt="icon" />
          </div>
        )}
        <div className="ml-2 truncate">{candidate.name}</div>
      </div>
    </div>
  );
}
