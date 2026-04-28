"use client";

import React from "react";
import { useLocale, useTranslation } from "@/lib/i18n";
import { Globe } from "lucide-react";

interface LanguageSwitcherProps {
  className?: string;
  showLabel?: boolean;
}

export default function LanguageSwitcher({ className = "", showLabel = true }: LanguageSwitcherProps) {
  const { locale, setLocale } = useLocale();

  const toggleLocale = () => {
    setLocale(locale === "en" ? "zh-CN" : "en");
  };

  const { t } = useTranslation();

  return (
    <button
      onClick={toggleLocale}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-(--bg-secondary) transition-colors ${className}`}
    >
      <Globe size={16} className="text-(--text-secondary)" />
      {showLabel && (
        <span className="text-sm text-(--text-secondary)">
          {locale === "en" ? (t.common.lang_zh_label ?? '中文') : (t.common.lang_en_label ?? 'English')}
        </span>
      )}
    </button>
  );
}
