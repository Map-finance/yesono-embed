import { useLocale } from '@/lib/i18n';
import { translations } from '@/locales';
import { useCallback } from 'react';

export function useI18n() {
    const { locale, setLocale } = useLocale();

    const t = useCallback((key: string, params?: Record<string, string | number>) => {
        // 获取当前语言的翻译对象
        const localeData = translations[locale as keyof typeof translations] || translations['en'];

        // 获取翻译值
        let value = (localeData as any)[key];

        // 如果找不到翻译，返回 key
        if (value === undefined) {
            return key;
        }

        // 处理参数替换 {param}
        if (typeof value === 'string' && params) {
            Object.entries(params).forEach(([k, v]) => {
                value = value.replace(`{${k}}`, String(v));
            });
        }

        return value;
    }, [locale]);

    return {
        t,
        language: locale,
        setLanguage: setLocale
    };
}
