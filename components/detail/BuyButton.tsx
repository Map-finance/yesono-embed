"use client";

/**
 * Yes/No 买卖按钮。从 OutcomeList.tsx 拆出，机械搬运无修改。
 */

import React from "react";

interface BuyButtonProps {
  label: string;
  price: string;
  color: "yes" | "no";
  selected: boolean;
  onClick?: () => void;
  className?: string;
}

const BuyButton: React.FC<BuyButtonProps> = ({
  label,
  price,
  color,
  selected,
  onClick,
  className = "",
}) => {
  const yesSelected =
    "bg-[#22c55e] text-white border-[#22c55e] hover:bg-[#16a34a]";
  const yesDefault =
    "bg-[rgba(34,197,94,0.15)] text-[#22c55e] border-[rgba(34,197,94,0.3)] hover:bg-[rgba(34,197,94,0.25)]";

  const noSelected =
    "bg-[#ef4444] text-white border-[#ef4444] hover:bg-[#dc2626]";
  const noDefault =
    "bg-[rgba(239,68,68,0.15)] text-[#ef4444] border-[rgba(239,68,68,0.3)] hover:bg-[rgba(239,68,68,0.25)]";

  const colorStyles =
    color === "yes"
      ? selected
        ? yesSelected
        : yesDefault
      : selected
        ? noSelected
        : noDefault;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick();
      }}
      className={`px-5 py-2.5 w-[148px] space-x-1 flex items-center shrink-0 rounded-lg text-base font-bold whitespace-nowrap border transition-colors ${colorStyles} ${className}`}
    >
      <span className="flex-1 truncate">{label}</span>
      <span>{price}</span>
    </button>
  );
};

export default BuyButton;
