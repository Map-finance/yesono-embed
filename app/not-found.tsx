"use client";

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';

/** 404 页面 */
export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>404</h1>
      <p style={{ marginBottom: 16, color: 'var(--text-secondary, #666)' }}>
        {t.common.pageNotFound}
      </p>
      <Link href="/trending">{t.common.backToHome}</Link>
    </div>
  );
}
