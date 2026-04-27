"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { translations, Locale, TranslationKeys } from './translations';
import { mutate } from "swr";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: TranslationKeys;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children, initialLocale }: { children: React.ReactNode; initialLocale?: Locale }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? 'en');
  const router = useRouter();

  // 初始化时从 localStorage 读取语言设置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLocale = localStorage.getItem('locale') as Locale | null;
      if (!initialLocale && savedLocale && translations[savedLocale]) {
        setLocaleState(savedLocale);
      } else if (initialLocale) {
        // 如果 server 提供了初始 locale，优先使用并写入 localStorage
        try {
          localStorage.setItem('locale', initialLocale);
        } catch (e) {
          // localStorage may be unavailable (incognito mode, quota exceeded), graceful degradation
          console.warn('[I18nContext] Failed to save initial locale to localStorage', e);
        }
      }
    }
  }, [initialLocale]);

  const setLocale = useCallback((newLocale: Locale) => {
    if (newLocale === locale) return;
    setLocaleState(newLocale);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('locale', newLocale);
      } catch (e) {
        console.warn('[I18nContext] Failed to save locale to localStorage', e);
      }
      try {
        // write cookie so server can read locale during SSR
        // 使用 setCookie 以确保安全基线（encodeURIComponent、Secure）
        const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `locale=${encodeURIComponent(newLocale)}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
      } catch (e) {
        console.warn('[I18nContext] Failed to set locale cookie', e);
      }
    }
    // 语言切换后主动触发 SWR 重新验证，避免等待下一轮轮询
    void mutate(() => true, undefined, { revalidate: true });
    // trigger server-side refresh so Server Components re-render with new locale
    try {
      router.refresh();
    } catch (e) {
      console.warn('[I18nContext] Failed to refresh router after locale change', e);
    }
  }, [locale, router]);

  const t = translations[locale] as TranslationKeys;

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}

export function useLocale() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useLocale must be used within an I18nProvider');
  }
  return { locale: context.locale, setLocale: context.setLocale };
}
