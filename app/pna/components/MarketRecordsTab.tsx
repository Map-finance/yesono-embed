"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import MarketCreationRecords from "./MarketCreationRecords";
import MarketAuditRecords from "./MarketAuditRecords";

type MarketSubTab = "creation" | "audit";

interface MarketRecordsTabProps {
  isActive: boolean;
}

export default function MarketRecordsTab({ isActive }: MarketRecordsTabProps) {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<MarketSubTab>("creation");

  return (
    <div>
      {/* 子 tab 切换 - 与 PositionsTable 风格一致 */}
      <div className="flex flex-wrap items-center gap-4 mb-6 mt-6 max-md:justify-between">
        <div className="flex rounded-md border border-[--border] overflow-hidden order-1">
          {[
            { key: "creation" as const, label: (t.pna.tabs as any).marketCreation || "Creation Records" },
            { key: "audit" as const, label: (t.pna.tabs as any).marketAudit || "Audit Records" },
          ].map((tab, idx) => (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key)}
              className={`px-6 py-2 text-sm font-bold transition-all relative ${
                idx !== 1 ? "border-r border-solid border-[--border]" : ""
              } ${
                activeSubTab === tab.key
                  ? "bg-[--accent] text-black"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 子 tab 内容 */}
      {activeSubTab === "creation" ? (
        <MarketCreationRecords isActive={isActive && activeSubTab === "creation"} />
      ) : (
        <MarketAuditRecords isActive={isActive && activeSubTab === "audit"} />
      )}
    </div>
  );
}
