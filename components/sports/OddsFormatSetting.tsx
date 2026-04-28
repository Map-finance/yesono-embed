"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "@/lib/i18n";

export default function OddsFormatSetting({ className }: { className?: string }) {
    const { t } = useTranslation();
    const options = [
        { key: "Price", label: t.sports.oddsFormat.price },
        { key: "American", label: t.sports.oddsFormat.american },
        { key: "Decimal", label: t.sports.oddsFormat.decimal },
        { key: "Percentage", label: t.sports.oddsFormat.percentage },
    ];
    const [select, setSelect] = useState("American");
    return (
        <div className={`w-48 ${className}`}>
            <div className="text-(--text-secondary) text-sm font-semibold px-3 py-2 border-b border-(--border)">{t.sports.oddsFormat.title}</div>
            <ul>
                {
                    options.map((option) => (
                        <li key={option.key} className="flex items-center justify-between py-2 cursor-pointer text-sm px-3" onClick={() => setSelect(option.key)}>
                            <div className="font-semibold">{option.label}</div>
                            {select === option.key && <Check size={18} className="text-(--accent)" />}
                        </li>
                    ))
                }
            </ul>
        </div>
    );
}