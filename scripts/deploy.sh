#!/usr/bin/env bash
set -euo pipefail

# Usage: bash scripts/deploy.sh [dev|prod]
# - dev:  loads .env.development, deploys to dev environment (wrangler --env dev)
# - prod: loads .env.production, deploys to production

ENV="${1:-prod}"

if [ "$ENV" = "dev" ]; then
  ENV_FILE=".env.development"
  APP_ENV="development"
  WRANGLER_ARGS="--env dev"
elif [ "$ENV" = "prod" ]; then
  ENV_FILE=".env.production"
  APP_ENV="production"
  WRANGLER_ARGS=""
else
  echo "Unknown environment: $ENV (use 'dev' or 'prod')"
  exit 1
fi

echo "Deploying to: $ENV (using $ENV_FILE)"

if [ -x "$(dirname "$0")/backup-env.sh" ]; then
  bash "$(dirname "$0")/backup-env.sh" || echo "WARN: env backup failed, continuing"
fi

set -a
eval "$(sed '/^NODE_ENV=/d; /^#/d; /^$/d' "$ENV_FILE")"
set +a

export APP_ENV="$APP_ENV"
export NEXT_PUBLIC_APP_ENV="$APP_ENV"
unset NODE_ENV

rm -rf .next .open-next

opennextjs-cloudflare build --dangerouslyUseUnsupportedNextVersion
wrangler deploy $WRANGLER_ARGS
