# 部署文档

> 项目：yesono-embed（Next.js 16 + OpenNext + Cloudflare Workers）
> 最后更新：2026-04-28

## 部署模型（重要）

```
┌─ main 分支 ════ prod 环境 ════════════════════════════════════════┐
│  push main 即上 prod；commit 必须经过 PR + review 进 main         │
└──────────────────────────────────────────────────────────────────┘
┌─ dev 分支 ════ dev 环境 ═════════════════════════════════════════┐
│  push dev 即上 dev；日常协作的"前沿分支"                          │
└──────────────────────────────────────────────────────────────────┘
┌─ feat/fix/* 分支 ──► PR 到 main 或 dev ──► preview worker ────┐
│  PR 合并/关闭后自动删除 preview                                   │
└──────────────────────────────────────────────────────────────────┘
┌─ tag v* ──► 仅作 release 归档，不触发部署 ─────────────────────┐
└──────────────────────────────────────────────────────────────────┘
```

## 路径概览

两条部署链路。**默认走 CI**；本机命令是 hotfix lane。

```
┌─ 平时 ──────────────────────────────────────────────────────────┐
│  PR opened/synced ──► GitHub Actions ──► preview worker         │
│  push dev          ──► GitHub Actions ──► dev-yesono-embed      │
│  push main         ──► GitHub Actions ──► yesono-embed (prod)   │
│  PR closed         ──► GitHub Actions ──► 删除 preview worker   │
│  tag v*            ──► 不触发 CI（仅 git 归档）                 │
└─────────────────────────────────────────────────────────────────┘
┌─ Hotfix（CI 挂时） ─────────────────────────────────────────────┐
│  pnpm deploy:dev   ──► 本机 ──► dev-yesono-embed                │
│  pnpm deploy       ──► 本机（二次确认）──► yesono-embed         │
└─────────────────────────────────────────────────────────────────┘
```

## 涉及的文件

| 文件 | 角色 |
|---|---|
| [.github/workflows/deploy.yml](../.github/workflows/deploy.yml) | CI workflow，单一入口 |
| [wrangler.jsonc](../wrangler.jsonc) | worker 配置 + **环境变量单一真理来源** |
| [open-next.config.ts](../open-next.config.ts) | OpenNext 必需，目前空配置 |
| [next.config.js](../next.config.js) | Next.js 配置（headers、images、redirects） |
| [middleware.ts](../middleware.ts) | 运行时 CSP / Referrer-Policy 注入 |
| [scripts/deploy.sh](../scripts/deploy.sh) | 本机部署入口（hotfix） |
| [scripts/extract-wrangler-vars.mjs](../scripts/extract-wrangler-vars.mjs) | 从 wrangler.jsonc 抽 vars 注入 build shell |
| [.env.development](../.env.example) | 仅本地 `pnpm dev` 用 |

## 环境变量

**单一真理来源 = [wrangler.jsonc](../wrangler.jsonc)**：
- 顶层 `vars` 块 = prod
- `env.dev.vars` 块 = dev
- 构建期：[scripts/extract-wrangler-vars.mjs](../scripts/extract-wrangler-vars.mjs) 抽取后 `eval` 注入构建 shell；`next build` 把 `NEXT_PUBLIC_*` 烤进 bundle
- 运行期：Cloudflare 直接从 wrangler.jsonc.vars 注入到 worker
- 两边来自同一份配置，**永不漂移**

`NEXT_PUBLIC_*` 全是公开值（会进浏览器 bundle），写在仓库里没问题。如果以后要加真正的密钥（DB 密码、第三方 secret token 之类），用 `wrangler secret put <KEY>` 注入，**不要**写进 vars。

新增/修改环境变量的 SOP：
1. 编辑 [wrangler.jsonc](../wrangler.jsonc) 的 `vars` 和/或 `env.dev.vars`
2. commit + push
3. CI 自动重新部署，或本机 `pnpm deploy:dev`

## CI 链路（GitHub Actions）

### 触发矩阵

| 触发事件 | target | worker 名 |
|---|---|---|
| PR opened / synchronize / reopened | preview | `pr-<num>-yesono-embed` |
| push to `main` | **prod** | `yesono-embed` |
| push to `dev` | dev | `dev-yesono-embed` |
| PR closed | (cleanup) | 删除 `pr-<num>-yesono-embed` |
| tag `v*` | (无部署) | 仅 git 归档；如要做 GitHub Release 单开 workflow |
| `workflow_dispatch` 手工触发 | 二选一 | dev or prod |

并发：同一 ref 上后到的 push 会取消正在跑的 run（避免互相覆盖）。

### 🚨 main = prod 的安全提醒

模型选用 "push main 即上 prod"，**任何合并到 main 的 commit 立刻进入生产**。三道闸门帮你拦：

1. **本地 pre-commit hook**（[.husky/pre-commit](../.husky/pre-commit)）：lint-staged + eslint，error 阻塞 commit
2. **CI Lint step**（[.github/workflows/deploy.yml](../.github/workflows/deploy.yml)）：全量 `pnpm lint`，error 阻塞 deploy
3. **强烈推荐**：在 GitHub `Settings → Branches → Branch protection rules` 给 `main` 加：
   - ✅ Require a pull request before merging
   - ✅ Require approvals (≥1)
   - ✅ Require status checks to pass（勾上 `build-and-deploy` job）
   - ✅ Do not allow bypassing the above settings

   → 这样直接 `git push origin main` 会被拒，必须走 PR + 通过 CI lint + 至少 1 人 review 才能合并。

如果还嫌不够，再加一道 **GitHub Environment 审批**：`Settings → Environments → prod → Required reviewers`，CI 跑到 deploy step 时会暂停等人按按钮。

### 必需的 GitHub Secrets

在 `Settings → Secrets and variables → Actions`：

| Secret | 值来源 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" 模板 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard URL `/dash.cloudflare.com/<这一段>/...` 的 32 位十六进制 |
| `CLOUDFLARE_WORKERS_SUBDOMAIN` | 你的 *.workers.dev 子域（不带后缀），用于在 PR 评论里拼 preview URL |

### 可选：GitHub Environments 审批

`Settings → Environments`：建 `dev` / `prod` / `preview` 三个 env。给 `prod` 加 **Required reviewers**，prod 部署就需要人工审批才会进。

> 既然 `main = prod` 是 push 即上线，**强烈建议至少把 prod 的 Required reviewers 配上**，作为 deploy step 的最后一道防线。

### 公开仓库注意事项

仓库 public 后，**外部贡献者从 fork 提的 PR 拿不到 secrets**（GitHub 默认安全策略），preview 部署会 401。仓库内成员从分支提 PR 不受影响。

## 本机部署（hotfix）

```bash
pnpm deploy:dev    # 默认；安全
pnpm deploy        # prod；会问你输入 'yes' 确认
pnpm preview       # 本机 OpenNext 预览，使用 prod vars
```

[scripts/deploy.sh](../scripts/deploy.sh) 的安全闸门：

| 闸门 | 触发条件 | 强制跳过 |
|---|---|---|
| prod 二次确认 | `ENV=prod` 且非 CI | `CONFIRM_PROD=yes` |
| git 工作树干净 | 有未提交改动 | `SKIP_GIT_CHECK=1` |
| `pnpm lint` 前置 | 有 lint 错误 | `SKIP_LINT=1` |

紧急情况全部跳过：
```bash
SKIP_GIT_CHECK=1 SKIP_LINT=1 CONFIRM_PROD=yes pnpm deploy
```

## 自定义域名绑定

[wrangler.jsonc](../wrangler.jsonc) 里 prod 块和 `env.dev` 块各有一段被注释的 `routes`。绑定步骤：

1. 在 Cloudflare Dashboard 把 zone 加到 account（如果还没加）
2. 取消注释，把 `pattern` 和 `zone_name` 改成实际域，例如：
   ```jsonc
   "routes": [
     { "pattern": "embed.yesono.trade/*", "zone_name": "yesono.trade", "custom_domain": true }
   ]
   ```
3. commit + push（或本机 `pnpm deploy`）

CSP `frame-ancestors`（[middleware.ts](../middleware.ts)）也要同步收紧 —— 把 [wrangler.jsonc](../wrangler.jsonc) 里 `NEXT_PUBLIC_EMBED_FRAME_ANCESTORS` 从 `"*"` 改成宿主域名（多个用空格分隔）。

## 监控与排错

### Cloudflare Dashboard
- Workers → `yesono-embed` / `dev-yesono-embed` → **Deployments** 看版本历史和回滚
- Workers → `<worker>` → **Logs** 看实时请求日志（[wrangler.jsonc](../wrangler.jsonc) 已开 `observability.enabled`）

### 实时拉日志
```bash
pnpm exec wrangler tail dev-yesono-embed
pnpm exec wrangler tail yesono-embed
```

### CI run 失败排查

| 现象 | 可能原因 |
|---|---|
| `Authentication error [code: 10000]` | `CLOUDFLARE_API_TOKEN` 不存在 / 过期 / 权限不足 |
| `Account not found` | `CLOUDFLARE_ACCOUNT_ID` 错 |
| `pnpm install` lockfile mismatch | `package.json` 改了但 `pnpm-lock.yaml` 没同步提交 |
| `OpenNext build failed` | Next 16 + OpenNext 兼容性，需要升 `@opennextjs/cloudflare` 或回滚 Next |
| `The job was not started: Actions budget` | GitHub Actions 计费额度用完（公开仓库不会，私有仓库可能） |

## 常见任务

### 升级 Next 大版本（例如 16 → 17）
1. 升 `next` 和 `@opennextjs/cloudflare`
2. 跑 `pnpm install` 让 lockfile 更新
3. **务必**：跨大版本必须 `pnpm build:clean`（删 `.next` 和 `.open-next`），否则 dev / build 会用旧缓存出诡异错误
4. 本机 `pnpm deploy:dev` 验通后再 push

### 回滚 prod
1. Cloudflare Dashboard → Workers → `yesono-embed` → Deployments
2. 点目标版本旁的菜单 → **Rollback**
3. 同步在 git 上 revert 对应 commit 并 push（保持 git 与 worker 状态一致）

### 紧急把流量切回旧版本（不动 git）
直接在 Cloudflare Dashboard 用 **Gradual deployments** 把新版本流量降到 0%。

## 已知遗留

- [middleware.ts](../middleware.ts) 在 Next 16 已被标记 deprecated（建议改名 `proxy.ts`）；不影响功能，单独 PR 处理
- [next.config.js](../next.config.js) 暂时 `typescript.ignoreBuildErrors: true`，存量 TS 错误待清
- CI 的 `pnpm lint` 步骤 `continue-on-error: true`，存量 89 个 react-hooks 错误待清后恢复阻塞
