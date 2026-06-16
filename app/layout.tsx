/**
 * Next.js App Router - Root Layout
 * 这是所有页面的根布局组件
 */

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import '@/styles/index.css';
import ClientWrapper from './ClientWrapper';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'YesONo',
  description: 'A YesONo prediction market platform with configuration-driven architecture',
  icons: {
    icon: '/brand-icon.png',
    shortcut: '/brand-icon.png',
    apple: '/brand-icon.png',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 读取服务器端 cookie 中的 locale（如果存在）
  // 注:CSP nonce 不在这里读 —— `nonce` 属性只对 <script>/<style> 标签有效,
  // 浏览器解析完 HTML 后会把 <head>/<body> 上的 nonce 属性值置空(防 XSS 复用),
  // 导致 React hydration 必报 mismatch。Next.js 框架已通过 middleware 设的 x-nonce
  // 自动给注入脚本加 nonce,这里无需手动处理。
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
      }} className={cn("font-sans", geist.variable)}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
      </head>
      <body>
        <ClientWrapper initialLocale={locale} initialNavigation={/*navData*/undefined}>
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}

