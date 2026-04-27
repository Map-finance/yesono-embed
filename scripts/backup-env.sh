#!/usr/bin/env bash
# 备份本项目的 .env.* 文件到 ~/.env-backup/h2-market/，按时间戳保留快照。
# 由于 .env.production / .env.development 在 .gitignore 中，git 不会保护它们；
# 该脚本提供本地最后一道防线，可在部署脚本前手动或自动执行。
#
# 用法：
#   bash scripts/backup-env.sh           # 备份当前所有 .env.*
#   bash scripts/backup-env.sh restore   # 列出可用快照
#   bash scripts/backup-env.sh restore <snapshot-dir>  # 从指定快照恢复
#
# 保留策略：默认保留最近 30 份快照，更早的会被自动清理。
set -euo pipefail

PROJECT_NAME="h2-market"
BACKUP_ROOT="${HOME}/.env-backup/${PROJECT_NAME}"
KEEP_COUNT=30
ENV_PATTERNS=(.env .env.production .env.development .env.test .env.local .env.sentry .env.example)

cmd="${1:-backup}"

backup() {
  local stamp
  stamp=$(date +%Y%m%d-%H%M%S)
  local dest="${BACKUP_ROOT}/${stamp}"
  mkdir -p "$dest"

  local copied=0
  for f in "${ENV_PATTERNS[@]}"; do
    if [ -f "$f" ]; then
      cp -p "$f" "$dest/"
      copied=$((copied + 1))
    fi
  done

  if [ "$copied" -eq 0 ]; then
    echo "WARN: 当前目录没有任何 .env.* 文件可以备份" >&2
    rmdir "$dest" 2>/dev/null || true
    exit 1
  fi

  echo "✓ 已备份 $copied 个 env 文件 -> $dest"

  # 保留最近 KEEP_COUNT 份，清理更早的
  local total
  total=$(ls -1 "$BACKUP_ROOT" | wc -l | tr -d ' ')
  if [ "$total" -gt "$KEEP_COUNT" ]; then
    local to_delete=$((total - KEEP_COUNT))
    ls -1 "$BACKUP_ROOT" | sort | head -n "$to_delete" | while read -r dir; do
      rm -rf "${BACKUP_ROOT:?}/${dir}"
      echo "🗑  清理旧快照: $dir"
    done
  fi
}

restore() {
  if [ ! -d "$BACKUP_ROOT" ] || [ -z "$(ls -A "$BACKUP_ROOT" 2>/dev/null)" ]; then
    echo "ERROR: 没有任何备份快照" >&2
    exit 1
  fi

  local snap="${1:-}"
  if [ -z "$snap" ]; then
    echo "可用的备份快照（最新在下）:"
    ls -1 "$BACKUP_ROOT" | sort | nl
    echo ""
    echo "使用 'bash scripts/backup-env.sh restore <快照名>' 恢复，例如:"
    local latest
    latest=$(ls -1 "$BACKUP_ROOT" | sort | tail -n 1)
    echo "  bash scripts/backup-env.sh restore $latest"
    exit 0
  fi

  local src="${BACKUP_ROOT}/${snap}"
  if [ ! -d "$src" ]; then
    echo "ERROR: 快照不存在 $src" >&2
    exit 1
  fi

  for f in "$src"/.env* "$src"/.env*.*; do
    [ -f "$f" ] || continue
    local name
    name=$(basename "$f")
    cp -p "$f" "./$name"
    echo "✓ 恢复 $name"
  done
}

case "$cmd" in
  backup)  backup ;;
  restore) shift || true; restore "${1:-}" ;;
  *)
    echo "未知命令: $cmd" >&2
    echo "用法: bash scripts/backup-env.sh [backup|restore [snapshot]]" >&2
    exit 1
    ;;
esac
