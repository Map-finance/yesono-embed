"use client";

import React, { useEffect, useState } from "react";

interface CountdownLabels {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

interface LiveCountdownProps {
  /** 结束时刻(毫秒时间戳) */
  endDate: number;
  labels: CountdownLabels;
}

interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const ZERO: Parts = { days: 0, hours: 0, minutes: 0, seconds: 0 };

function compute(endDate: number): Parts {
  const diff = endDate - Date.now();
  if (diff <= 0) return ZERO;
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((diff % (1000 * 60)) / 1000),
  };
}

/**
 * 移动端实时倒计时(每秒刷新)。
 *
 * 刻意独立成组件、自持 1s state:原先倒计时 state 在 MarketPage(1000+ 行)里,
 * 每秒 setState 会重渲染整页(实测每秒 50-78ms 的 Long Task)。抽出后每秒只重渲染这一小块。
 */
const LiveCountdown: React.FC<LiveCountdownProps> = ({ endDate, labels }) => {
  const [parts, setParts] = useState<Parts>(() => compute(endDate));

  useEffect(() => {
    setParts(compute(endDate));
    const timer = setInterval(() => setParts(compute(endDate)), 1000);
    return () => clearInterval(timer);
  }, [endDate]);

  return (
    <div className="sm:hidden flex items-center gap-2">
      {parts.days > 0 && (
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold text-[#FF453A] leading-none mb-1 tabular-nums">
            {String(parts.days).padStart(2, "0")}
          </span>
          <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">
            {labels.days}
          </span>
        </div>
      )}
      {parts.hours > 0 && (
        <div className="flex flex-col items-center">
          <span className="text-3xl font-bold text-[#FF453A] leading-none mb-1 tabular-nums">
            {String(parts.hours).padStart(2, "0")}
          </span>
          <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">
            {labels.hours}
          </span>
        </div>
      )}
      <div className="flex flex-col items-center">
        <span className="text-3xl font-bold text-[#FF453A] leading-none mb-1 tabular-nums">
          {String(parts.minutes).padStart(2, "0")}
        </span>
        <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">
          {labels.minutes}
        </span>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-3xl font-bold text-[#FF453A] leading-none mb-1 tabular-nums">
          {String(parts.seconds).padStart(2, "0")}
        </span>
        <span className="text-[10px] text-[var(--text-secondary)] uppercase font-bold tracking-wider">
          {labels.seconds}
        </span>
      </div>
    </div>
  );
};

export default React.memo(LiveCountdown);
