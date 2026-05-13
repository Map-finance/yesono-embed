"use client";

/**
 * OutcomeMobileCountdown - Outcome 详情页移动端 live 倒计时显示。
 * 从 page.tsx 拆出，机械搬运无修改。
 */

import React from "react";

interface CountdownLabels {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

interface OutcomeMobileCountdownProps {
  countdown: { days: number; hours: number; minutes: number; seconds: number };
  labels: CountdownLabels;
}

const OutcomeMobileCountdown: React.FC<OutcomeMobileCountdownProps> = ({
  countdown,
  labels,
}) => (
  <div className="flex shrink-0 items-center gap-2 sm:hidden">
    {countdown.days > 0 && (
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold leading-none text-[#FF453A] tabular-nums">
          {String(countdown.days).padStart(2, "0")}
        </span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-(--text-secondary)">
          {labels.days}
        </span>
      </div>
    )}
    {countdown.hours > 0 && (
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold leading-none text-[#FF453A] tabular-nums">
          {String(countdown.hours).padStart(2, "0")}
        </span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-(--text-secondary)">
          {labels.hours}
        </span>
      </div>
    )}
    <div className="flex flex-col items-center">
      <span className="text-2xl font-bold leading-none text-[#FF453A] tabular-nums">
        {String(countdown.minutes).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-(--text-secondary)">
        {labels.minutes}
      </span>
    </div>
    <div className="flex flex-col items-center">
      <span className="text-2xl font-bold leading-none text-[#FF453A] tabular-nums">
        {String(countdown.seconds).padStart(2, "0")}
      </span>
      <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-(--text-secondary)">
        {labels.seconds}
      </span>
    </div>
  </div>
);

export default OutcomeMobileCountdown;
