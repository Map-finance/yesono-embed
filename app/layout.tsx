/**
 * Next.js App Router - Root Layout
 * 这是所有页面的根布局组件
 */

import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import '@/styles/index.css';
import ClientWrapper from './ClientWrapper';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'YesONo',
  description: 'A YesONo prediction market platform with configuration-driven architecture',
  icons: {
    icon: '/icon.png',
    shortcut: '/icon.png',
    apple: '/icon.png',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerStore = await headers();
  const nonce = headerStore.get('x-nonce') || undefined;

  // 读取服务器端 cookie 中的 locale（如果存在）
  const cookieStore = await cookies();
  const locale = (cookieStore.get('locale')?.value as string) || 'en';
  const theme = (cookieStore.get('theme')?.value as string) || 'dark';
  const isLight = theme === 'light';

  // 在 server 端拉取导航与 sports 标签树，作为 initial data 注入客户端 Provider
  // let navData: any[] = [];

  // try {
  //   const navRes = await fetch(`${API_BASE}/api/navigation`, {
  //     method: 'GET',
  //     headers: { 'Accept-Language': locale },
  //     cache: 'no-store',
  //   });
  //   if (navRes.ok) {
  //     const jr = await navRes.json();
  //     if (jr && jr.success && Array.isArray(jr.data)) navData = jr.data;
  //   }
  // } catch (e) {
  //   // ignore
  // }
  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-theme={theme}
      style={{
        backgroundColor: isLight ? '#ffffff' : '#111111',
        color: isLight ? '#000000' : '#ffffff',
        colorScheme: isLight ? 'light' : 'dark',
      }}
    >
      <head nonce={nonce}>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
      </head>
      <body nonce={nonce}>
        <ClientWrapper initialLocale={locale} initialNavigation={/*navData*/undefined}>
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}

