"use client";

import { useMemo } from "react";
import NumberFlow from "@number-flow/react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import useGetPositions from "@/lib/hooks/pna/use-get-positions";
import useAsianSummary from "@/lib/hooks/pna/use-asian-summary";

export type PositionMode = "yesNo" | "asian";

interface ModeBarProps {
  mode: PositionMode;
  onChange: (m: PositionMode) => void;
  targetUserId?: string;
}

/**
 * 表格顶部一栏：左侧"持仓总额"，右侧 [Yes/No] [亚盘] 切换。
 *  - yesNo：从 useGetPositions 求 sum(value)
 *  - asian：从 useAsianSummary 取 marketValues
 */
export default function ModeBar({ mode, onChange, targetUserId }: ModeBarProps) {
  const { t } = useTranslation();

  const { positions, isLoading: isPositionsLoading } = useGetPositions({
    userId: targetUserId,
    limit: 100,
    enabled: mode === "yesNo",
  });
  const { marketValues, isLoading: isAsianLoading } = useAsianSummary({
    userId: targetUserId,
  });

  const yesNoTotal = useMemo(
    () => positions.reduce((sum, p) => sum + (p.value ?? 0), 0),
    [positions]
  );

  const total = mode === "yesNo" ? yesNoTotal : marketValues;
  const totalLoading = mode === "yesNo" ? isPositionsLoading : isAsianLoading;
  const totalLabel =
    mode === "yesNo"
      ? t.pna.profile.positionsValue
      : t.pna.profile.asianPositionsValue;

  return (
    <div className="flex items-center justify-end gap-3 text-xs">
      {/* 持仓总额：label + value 一行，紧贴切换按钮 */}
      <span className="text-(--text-secondary)">
        {totalLabel}
        <span className="ml-1.5 text-(--text-primary) font-semibold tabular-nums">
          {totalLoading ? (
            "—"
          ) : (
            <NumberFlow
              value={total}
              format={{
                style: "currency",
                currency: "USD",
                currencyDisplay: "narrowSymbol",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }}
            />
          )}
        </span>
      </span>

      {/* Mode 切换 */}
      <div className="inline-flex gap-1 rounded-md border border-(--border) bg-(--bg-card) p-1 shrink-0">
        <ModeButton current={mode} self="yesNo" label={t.pna.profile.modeYesNo} onClick={onChange} />
        <ModeButton current={mode} self="asian" label={t.pna.profile.modeAsianHandicap} onClick={onChange} />
      </div>
    </div>
  );
}

function ModeButton({
  current,
  self,
  label,
  onClick,
}: {
  current: PositionMode;
  self: PositionMode;
  label: string;
  onClick: (v: PositionMode) => void;
}) {
  const active = current === self;
  return (
    <button
      onClick={() => onClick(self)}
      className={cn(
        "px-3 py-1 rounded transition-colors",
        active
          ? "bg-(--accent) text-(--bg-primary) font-medium"
          : "text-(--text-secondary) hover:text-(--text-primary)"
      )}
    >
      {label}
    </button>
  );
}
