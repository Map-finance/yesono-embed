"use client";

/**
 * CapsuleTooltip - TimeCapsule 悬浮提示框（状态行 + 双时区结算时间）。
 * 从 TimeCapsule.tsx 拆出，机械搬运无修改。
 */

import React from "react";
import { useTranslation } from "@/lib/i18n";
import {
  DEFAULT_TIME_CAPSULE_TEXT,
  formatLocalizedDualTimezone,
  getLocalizedTimeLeftLabel,
} from "./TimeCapsule.format";

interface CapsuleTooltipProps {
  endDate: number | string;
  isLive: boolean;
  isEnded: boolean;
  currentTime: number;
}

const CapsuleTooltip: React.FC<CapsuleTooltipProps> = ({
  endDate,
  isLive,
  isEnded,
  currentTime,
}) => {
  const { t, locale } = useTranslation();
  const timeCapsuleText =
    (t.market as any).timeCapsule ?? DEFAULT_TIME_CAPSULE_TEXT;
  const tz = formatLocalizedDualTimezone(endDate, locale);
  // 使用传入的 currentTime 参数（由父组件通过 liveTick 触发更新）
  const timeLeft = !isEnded
    ? getLocalizedTimeLeftLabel(endDate, currentTime, timeCapsuleText)
    : "";

  return (
    <div className="w-64 p-3">
      {/* 状态行 */}
      <div className="flex items-center justify-between mb-2">
        {isEnded ? (
          <span className="flex items-center gap-1.5 text-sm text-(--text-secondary)">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {timeCapsuleText.eventEnded}
          </span>
        ) : isLive ? (
          <>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-[#FF453A]">
              <div className="relative flex items-center justify-center w-3 h-3">
                <div className="absolute inset-0 rounded-full bg-[#FF453A]/40"></div>
                <div className="absolute inset-0 rounded-full bg-[#FF453A] animate-ping opacity-75"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF453A] relative z-10"></div>
              </div>
              {t.market.event.live}
            </span>
            {timeLeft && (
              <span className="text-sm text-(--text-secondary)">
                {timeLeft}
              </span>
            )}
          </>
        ) : (
          <span className="text-sm font-semibold text-(--text-primary)">
            {timeLeft}
          </span>
        )}
      </div>

      {/* Resolution Time */}
      <div className="text-xs text-(--text-tertiary) mb-1.5">
        {t.market.chart.resolutionTime}
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-blue-400 font-medium">ET</span>
          <span className="text-(--text-secondary)">{tz.etDate}</span>
          <span className="text-(--text-primary) font-semibold">
            {tz.etTime}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-green-400 font-medium">UTC</span>
          <span className="text-(--text-secondary)">{tz.utcDate}</span>
          <span className="text-(--text-primary) font-semibold">
            {tz.utcTime}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CapsuleTooltip;
