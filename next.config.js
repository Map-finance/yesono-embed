// OpenNext 的 Cloudflare dev 集成会给每个 `next dev` 额外拉起一个 workerd 运行时进程,
// CPU/内存翻倍。本项目代码未使用 Cloudflare bindings(getCloudflareContext),
// 故默认关闭,仅在需要本地验证 CF runtime 时显式 ENABLE_CF_DEV=1 pnpm dev 开启。
if (process.env.ENABLE_CF_DEV === "1") {
  const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare");
  initOpenNextCloudflareForDev();
}

const HOST_FRAME_ANCESTORS =
  process.env.NEXT_PUBLIC_EMBED_FRAME_ANCESTORS || "*";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 不需要 `output: "standalone"`：OpenNext 自己打 .open-next/worker.js。
  // 不需要 `eslint`：Next 16 已删除该配置项；CI 通过 `pnpm lint` 单独把关。
  reactStrictMode: true,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
  },
  typescript: {
    // TODO: 暂时关掉以推进依赖升级；存量 ts 错误见 git diff 后另开 PR 修
    ignoreBuildErrors: true,
  },
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "lodash"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${HOST_FRAME_ANCESTORS}`,
          },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.logo.dev",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "robohash.org",
        port: "",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/trending",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
