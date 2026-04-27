import Link from 'next/link';

/** 404 页面 */
export default function NotFound() {
  return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 8 }}>404</h1>
      <p style={{ marginBottom: 16, color: 'var(--text-secondary, #666)' }}>
        页面不存在
      </p>
      <Link href="/trending">返回首页</Link>
    </div>
  );
}
