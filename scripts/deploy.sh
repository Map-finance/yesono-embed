#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash scripts/deploy.sh            # 默认部署 dev（防止误操作生产）
#   bash scripts/deploy.sh dev        # 部署到 dev (worker: dev-yesono-embed)
#   bash scripts/deploy.sh prod       # 部署到 prod (worker: yesono-embed)，会二次确认
#   CONFIRM_PROD=yes  bash scripts/deploy.sh prod  # 跳过 prod 交互（CI 用）
#   SKIP_GIT_CHECK=1  bash scripts/deploy.sh prod  # 跳过 git 干净检查（hotfix）
#   SKIP_LINT=1       bash scripts/deploy.sh prod  # 跳过 pnpm lint
#
# 环境变量来源：wrangler.jsonc 的 vars / env.dev.vars，运行时由 Cloudflare 注入。
# 本地开发的 .env.development 仅给 `pnpm dev` 用，部署链路不再读它。

ENV="${1:-dev}"

case "$ENV" in
  dev)
    APP_ENV="development"
    WRANGLER_ARGS="--env dev"
    ;;
  prod)
    APP_ENV="production"
    WRANGLER_ARGS=""
    ;;
  *)
    echo "Unknown environment: $ENV (use 'dev' or 'prod')"
    exit 1
    ;;
esac

# --- 安全闸门 ----------------------------------------------------------------

# 1) prod 必须二次确认
if [ "$ENV" = "prod" ] && [ "${CONFIRM_PROD:-}" != "yes" ]; then
  read -r -p "⚠️  即将部署到 PRODUCTION (yesono-embed)。继续？输入 'yes' 确认: " ans
  if [ "$ans" != "yes" ]; then
    echo "已取消。"
    exit 1
  fi
fi

# 2) 工作树必须干净，避免本地未提交改动悄悄上线
if [ "${SKIP_GIT_CHECK:-}" != "1" ]; then
  if ! git diff-index --quiet HEAD -- 2>/dev/null; then
    echo "❌ git 工作树不干净。先提交/stash 再部署（或 SKIP_GIT_CHECK=1 强制）。"
    git status --short
    exit 1
  fi
fi

# 3) lint 前置（next.config.js 在 build 时关了 eslint，这里单独把关）
if [ "${SKIP_LINT:-}" != "1" ]; then
  echo "→ pnpm lint"
  pnpm lint
fi

# --- env 备份（保留：本地最后一道防线）---------------------------------------
if [ -x "$(dirname "$0")/backup-env.sh" ]; then
  bash "$(dirname "$0")/backup-env.sh" || echo "WARN: env backup failed, continuing"
fi

# --- 构建 + 部署 ------------------------------------------------------------
echo "→ Deploying to: $ENV"

# OpenNext 构建期需要 NODE_ENV=production（避免 dev 模式预渲染失败）。
export NODE_ENV=production

# 把 wrangler.jsonc 里对应环境的 vars 注入到 shell，让 `next build` 把
# NEXT_PUBLIC_* 烤进 bundle。这样 build 期与 worker 运行期来自同一份配置。
echo "→ Loading vars from wrangler.jsonc ($ENV)"
eval "$(node "$(dirname "$0")/extract-wrangler-vars.mjs" "$ENV")"

rm -rf .next .open-next

pnpm exec opennextjs-cloudflare build --dangerouslyUseUnsupportedNextVersion
pnpm exec wrangler deploy $WRANGLER_ARGS
