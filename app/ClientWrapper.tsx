"use client";

import React, { useEffect } from 'react';
import { SWRConfig } from 'swr';
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
  useEffect(() => {
    const savedTheme =
      typeof window !== 'undefined' ? localStorage.getItem('theme') || 'dark' : 'dark';

    const theme = savedTheme === 'light' ? lightTheme : defaultTheme;
    applyTheme(theme);
  }, []);

  return (
    <I18nProvider initialLocale={initialLocale}>
      {/* 全局 SWR 默认配置:页面隐藏/离线时不轮询不重新验证,
          避免锁屏/后台 tab 持续浪费电量与请求;切回前台/重连自动 revalidate */}
      <SWRConfig
        value={{
          refreshWhenHidden: false,
          refreshWhenOffline: false,
          revalidateOnReconnect: true,
        }}
      >
        <EmbedProvider>
          <ToastProvider>
            <NavigationProvider initialData={initialNavigation}>
              <div className="min-h-screen bg-(--bg-primary) pb-14 lg:pb-0">
                <Header />
                {children}
                <MobileBottomNav />
              </div>
              <IframeBridge />
            </NavigationProvider>
          </ToastProvider>
        </EmbedProvider>
      </SWRConfig>
    </I18nProvider>
  );
}
