/**
 * 中文注释：
 * - 这里原本使用 next/image 加载第三方图片。
 * - 但在 Cloudflare Pages 环境下，next/image 的远程域名白名单/优化链路容易受限，
 *   且我们现在已经实现了统一的“第三方图片代理 + CDN 缓存”能力。
 * - 因此这里改用普通 <img>，并把 src 走 `getProxiedImageUrl`：
 *   - 生产环境：命中 Cloudflare 边缘缓存，加速更稳定
 *   - 开发环境：保持原始链接，不影响本地调试
 */

import ProxyImage from "@/components/common/ProxyImage";

export default function MacroDashboardCard() {
  return (
    <a href="/market/1">
      <div className="border rounded-md border-[--border] py-6 px-4 hover:scale-[1.02] transition-transform">
        <div>
          <div className="flex items-center gap-4">
            <ProxyImage
              src="https://cdn.jsdelivr.net/npm/svg-country-flags@1.2.10/png250px/us.png"
              alt="Recession"
              className="size-[40px] object-cover rounded-md"
            />
            <div className="font-semibold text-xl">
              US recession by end of 2026?
            </div>
          </div>
          <div className="h-32 flex items-center justify-center">
            <div>todo chat</div>
          </div>
        </div>
      </div>
    </a>
  );
}
