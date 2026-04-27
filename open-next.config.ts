import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// NODE_ENV=production 由构建脚本（scripts/deploy.sh 或 package.json 的 build:prod）保证，
// 避免 .env.production 中 NODE_ENV=development 触发 dev 模式预渲染失败。
export default defineCloudflareConfig({});
