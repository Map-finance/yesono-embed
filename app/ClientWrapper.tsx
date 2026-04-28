"use client";

import React, { useEffect } from 'react';
import { App, ConfigProvider, theme as antdTheme } from 'antd';
import '@/lib/dayjsConfig';
import { applyTheme, defaultTheme, lightTheme } from '@/lib/theme';
import { I18nProvider } from '@/lib/i18n';
import { NavigationProvider } from '@/lib/providers/NavigationProvider';
import { EmbedProvider } from '@/lib/embed/EmbedContext';
import IframeBridge from '@/lib/embed/IframeBridge';
import Header from '@/components/Header';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';
import { ToastProvider } from '@/components/ui/Toast';

export default function ClientWrapper({
  children,
  initialLocale,
  initialNavigation,
}: {
  children: React.ReactNode;
  initialLocale?: any;
  initialNavigation?: any;
}) {
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') !== 'light';
    }
    return true;
  });

  useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute('data-theme');
      setIsDark(theme === 'dark' || !theme);
    };

    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const savedTheme =
      typeof window !== 'undefined' ? localStorage.getItem('theme') || 'dark' : 'dark';

    const theme = savedTheme === 'light' ? lightTheme : defaultTheme;
    applyTheme(theme);
  }, []);

  return (
    <I18nProvider initialLocale={initialLocale}>
      <EmbedProvider>
        <ToastProvider>
          <NavigationProvider initialData={initialNavigation}>
            <ConfigProvider
              theme={{
                algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                token: {
                  colorPrimary: '#ffd608',
                  colorBgBase: 'var(--bg-primary)',
                  colorBgContainer: 'var(--bg-card)',
                  colorBgElevated: 'var(--bg-card)',
                  colorText: 'var(--text-primary)',
                  colorTextSecondary: 'var(--text-secondary)',
                  colorBorder: 'var(--border)',
                  borderRadius: 8,
                },
                components: {
                  Select: {
                    selectorBg: 'var(--bg-input)',
                    optionSelectedBg: isDark ? '#2a2a3e' : '#e8e8e8',
                    colorBorder: 'var(--border)',
                    optionActiveBg: isDark ? '#252540' : '#f0f0f0',
                  },
                  DatePicker: {
                    colorBgContainer: 'var(--bg-input)',
                    colorBgElevated: 'var(--bg-card)',
                    colorBorder: 'var(--border)',
                    activeBorderColor: '#ffd608',
                  },
                  Input: {
                    colorBgContainer: 'var(--bg-input)',
                    colorBorder: 'var(--border)',
                    activeBorderColor: '#ffd608',
                  },
                  Button: {
                    primaryShadow: 'none',
                  },
                  Table: {
                    colorBgContainer: 'var(--bg-card)',
                    headerBg: 'var(--bg-secondary)',
                    headerColor: 'var(--text-primary)',
                    headerBorderRadius: 0,
                    borderColor: 'var(--border)',
                    rowHoverBg: 'var(--bg-hover)',
                    headerSplitColor: 'transparent',
                  },
                  Tabs: {
                    itemColor: 'var(--text-secondary)',
                    itemSelectedColor: 'var(--accent)',
                    inkBarColor: 'var(--accent)',
                    itemActiveColor: 'var(--accent-hover)',
                    colorBorderSecondary: 'transparent',
                  },
                  Pagination: {
                    itemActiveBg: 'var(--bg-secondary)',
                  },
                  Message: {
                    contentBg: 'var(--bg-card)',
                  },
                  Modal: {
                    contentBg: isDark ? '#1e1e2e' : '#ffffff',
                    headerBg: isDark ? '#1e1e2e' : '#ffffff',
                    footerBg: isDark ? '#1e1e2e' : '#ffffff',
                    colorText: 'var(--text-primary)',
                    colorIcon: 'var(--text-secondary)',
                    colorIconHover: 'var(--text-primary)',
                    colorBgMask: 'rgba(0,0,0,0.55)',
                    titleColor: 'var(--text-primary)',
                    titleFontSize: 16,
                  },
                  Drawer: {
                    colorBgElevated: isDark ? '#1e1e2e' : '#ffffff',
                    colorText: 'var(--text-primary)',
                    colorIcon: 'var(--text-secondary)',
                    colorIconHover: 'var(--text-primary)',
                  },
                },
              }}
            >
              <App>
                <div className="min-h-screen bg-(--bg-primary) pb-14 lg:pb-0">
                  <Header />
                  {children}
                  <MobileBottomNav />
                </div>
                <IframeBridge />
              </App>
            </ConfigProvider>
          </NavigationProvider>
        </ToastProvider>
      </EmbedProvider>
    </I18nProvider>
  );
}
