/**
 * 中文注释：
 * - 该组件原来用 next/image 渲染远程图片。
 * - 但你们 `next.config.js` 里对 next/image 的 remotePatterns 有严格白名单，
 *   不在白名单的域名会导致图片不显示。
 * - 另外你们已经有了 Cloudflare 图片代理 `/i?url=...`，因此这里改用 ProxyImage：
 *   - 优先走代理（CDN 缓存）
 *   - 失败回退直连
 */

import ProxyImage from "@/components/common/ProxyImage";

interface PromisesPoliciesCardProps {
  market: {
    id: string;
    icon: string;
    title: string;
    percentage: number;
    change: number;
    isUp: boolean;
  };
}

export default function PromisesPoliciesCard({
  market,
}: PromisesPoliciesCardProps) {
  return (
    <a href="/markets/1">
      <div className="border border-[--border] rounded-md p-4 font-semibold hover:scale-[1.02] transition-transform">
        <div className="flex items-center gap-3">
          <ProxyImage
            src={market.icon}
            alt={market.title}
            className="rounded-md size-[40px] object-cover"
          />
          <div>{market.title}</div>
        </div>
        <div className="mt-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="text-lg">{market.percentage}%</div>
            <div className="text-[--text-secondary]">chance</div>
          </div>
          <div className="flex items-center gap-1">
            {market.change >= 0 ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className="text-text-brand z-[1] text-[#69d290]"
                style={{ transform: "rotate(180deg)" }}
              >
                <g fill="currentColor">
                  <path
                    d="m9.099,2.5H2.901c-.554,0-1.061.303-1.322.792-.262.488-.233,1.079.074,1.54l3.099,4.648c.279.418.745.668,1.248.668s.969-.25,1.248-.668l3.099-4.648c.308-.461.336-1.051.074-1.54-.262-.489-.769-.792-1.322-.792Z"
                    strokeWidth="0"
                  ></path>
                </g>
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className="text-text-brand z-[1] text-[#ff4d4f]"
              >
                <g fill="currentColor">
                  <path
                    d="m9.099,2.5H2.901c-.554,0-1.061.303-1.322.792-.262.488-.233,1.079.074,1.54l3.099,4.648c.279.418.745.668,1.248.668s.969-.25,1.248-.668l3.099-4.648c.308-.461.336-1.051.074-1.54-.262-.489-.769-.792-1.322-.792Z"
                    strokeWidth="0"
                  ></path>
                </g>
              </svg>
            )}
            <div className="text-sm">{market.change}%</div>
          </div>
        </div>
      </div>
    </a>
  );
}
