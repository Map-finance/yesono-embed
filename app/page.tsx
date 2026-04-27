/**
 * Next.js App Router - Home Page (Trending)
 * 首页重定向到 /trending
 */

import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/trending');
}

