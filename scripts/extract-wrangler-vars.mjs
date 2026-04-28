#!/usr/bin/env node
// 从 wrangler.jsonc 抽出某个环境的 vars，按 `export KEY=VALUE` 输出到 stdout。
// 用法：node scripts/extract-wrangler-vars.mjs [prod|dev]
//
// 设计目的：让 wrangler.jsonc 成为部署期 NEXT_PUBLIC_* 的唯一真理来源。
//   - 构建期：deploy.sh `eval $(node ...)` 把这些 vars 注入到 shell；
//     `next build` 会把 NEXT_PUBLIC_* 烤进 bundle。
//   - 运行期：Cloudflare 直接读 wrangler.jsonc.vars 注入到 worker。
// 两边来自同一份配置，避免 .env.production 与 wrangler.jsonc 漂移。

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WRANGLER_PATH = path.join(__dirname, "..", "wrangler.jsonc");

const target = process.argv[2] || "prod";
if (!["prod", "dev"].includes(target)) {
  console.error(`Unknown env: ${target} (expected 'prod' or 'dev')`);
  process.exit(1);
}

const raw = fs.readFileSync(WRANGLER_PATH, "utf8");
// 极简 JSONC: 去掉行注释和尾随逗号。值里若含 // 会误伤，目前 wrangler.jsonc 里没有这种值。
const stripped = raw
  .replace(/^\s*\/\/.*$/gm, "")
  .replace(/([^:\s])\s*\/\/.*$/gm, "$1")
  .replace(/,(\s*[}\]])/g, "$1");

let cfg;
try {
  cfg = JSON.parse(stripped);
} catch (err) {
  console.error("Failed to parse wrangler.jsonc:", err.message);
  process.exit(1);
}

const vars = target === "prod" ? cfg.vars : cfg.env?.dev?.vars;
if (!vars || typeof vars !== "object") {
  console.error(`No vars block found for env=${target} in wrangler.jsonc`);
  process.exit(1);
}

for (const [key, value] of Object.entries(vars)) {
  // JSON.stringify 帮我们处理引号 / 转义；shell `eval` 能正确解析双引号字符串。
  console.log(`export ${key}=${JSON.stringify(String(value))}`);
}
