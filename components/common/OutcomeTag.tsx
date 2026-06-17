type OutcomeType = "YES" | "NO" | "UP" | "DOWN";

const COLOR_MAP: Record<OutcomeType, string> = {
  YES: "bg-[#43c773]/10 text-[#43c773]",
  NO: "bg-[#e76363]/10 text-[#e76363]",
  UP: "bg-[#43c773]/10 text-[#43c773]",
  DOWN: "bg-[#e76363]/10 text-[#e76363]",
};

const DEFAULT_COLOR = "bg-[#43c773]/10 text-[#43c773]";

export default function OutcomeTag({
  outcome,
  text,
  className,
}: {
  outcome: string;
  text?: string;
  className?: string;
}) {
  const normalizedOutcome = outcome.toUpperCase() as OutcomeType;
  const colorClass = COLOR_MAP[normalizedOutcome] || DEFAULT_COLOR;

  return (
    <span
      className={`py-0.5 px-2 rounded whitespace-nowrap max-md:text-[11px] ${colorClass} ${className || ""}`}
    >
      {text || outcome}
    </span>
  );
}
