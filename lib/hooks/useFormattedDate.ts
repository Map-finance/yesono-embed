"use client";

import { useCallback } from "react";
import { useLocale } from "@/lib/i18n";

/**
 * 本地化日期/数字格式化 hook
 *
 * 用法:
 *   const { formatDate, formatDateTime, formatNumber } = useFormattedDate();
 *   formatDate(timestamp, { month: 'short', day: 'numeric' })
 *
 * 替代 `.toLocaleDateString('en-US', ...)` 之类硬编码,根据当前 locale 选 BCP47 标签:
 *   en          → en-US
 *   zh-CN       → zh-CN
 *   zh-TW       → zh-TW
 *   ja          → ja-JP
 *   vi          → vi-VN
 *   th          → th-TH
 *   km          → km-KH
 */

// 把 i18n 的 locale 映射到 Intl 用的 BCP47 标签
function toIntlLocale(locale: string): string {
  switch (locale) {
    case "en":
      return "en-US";
    case "zh-CN":
      return "zh-CN";
    case "zh-TW":
      return "zh-TW";
    case "ja":
      return "ja-JP";
    case "vi":
      return "vi-VN";
    case "th":
      return "th-TH";
    case "km":
      return "km-KH";
    default:
      return locale;
  }
}

export function useFormattedDate() {
  const { locale } = useLocale();
  const intlLocale = toIntlLocale(locale);

  const formatDate = useCallback(
    (date: Date | number | string, options?: Intl.DateTimeFormatOptions) => {
      try {
        const d = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleDateString(intlLocale, options);
      } catch {
        return "";
      }
    },
    [intlLocale]
  );

  const formatDateTime = useCallback(
    (date: Date | number | string, options?: Intl.DateTimeFormatOptions) => {
      try {
        const d = date instanceof Date ? date : new Date(date);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleString(intlLocale, options);
      } catch {
        return "";
      }
    },
    [intlLocale]
  );

  const formatNumber = useCallback(
    (n: number, options?: Intl.NumberFormatOptions) => {
      try {
        return n.toLocaleString(intlLocale, options);
      } catch {
        return String(n);
      }
    },
    [intlLocale]
  );

  return { formatDate, formatDateTime, formatNumber, intlLocale };
}
