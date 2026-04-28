# CLAUDE.md

YesONo Embed — a display-only fork of `h2-market`, intended to be loaded inside an iframe of a host project. No login, no wallets, no trading.

## Commands

```bash
pnpm install         # install deps (pnpm 10.x; do NOT use yarn or npm)
pnpm dev             # Next dev server (3000 by default; pass PORT=3002 if 3000 taken)
pnpm dev:https       # HTTPS dev (experimental)
pnpm build           # next build
pnpm build:clean     # rm -rf .next .open-next
pnpm start           # next start
pnpm lint            # eslint . (flat config)
pnpm deploy          # bash scripts/deploy.sh prod (Cloudflare via OpenNext + Wrangler)
pnpm deploy:dev      # bash scripts/deploy.sh dev
pnpm preview         # OpenNext local preview
```

Package manager: **pnpm 10.33.2** (pinned via `packageManager` in package.json). `yarn.lock` and `.yarnrc.yml` have been removed; do not reintroduce them.

`pnpm install` also wires the husky `pre-commit` hook ([.husky/pre-commit](.husky/pre-commit)) that runs `lint-staged` on staged `.ts/.tsx/.js/.mjs` files. Errors block the commit. Bypass with `git commit --no-verify` only in emergencies.

No tests configured.

## Architecture

Next.js 16 App Router on `@opennextjs/cloudflare`. UI standard: **shadcn/ui + Radix Primitives + Tailwind** (see [docs/react-component-guide.md §18](docs/react-component-guide.md#18-ui-组件库shadcnui)); the legacy Antd 5 dependency has been removed. CSS-variable theme drives all components. Data fetched via SWR / TanStack Query with a thin axios layer at [lib/request.ts](lib/request.ts).

### Token / auth

The host injects an auth token via either query string `?token=...` or a `postMessage`:

```js
iframe.contentWindow.postMessage({ type: "yesono-embed:set-token", token: "..." }, "*");
iframe.contentWindow.postMessage({ type: "yesono-embed:clear-token" }, "*");
```

[lib/embed/EmbedContext.tsx](lib/embed/EmbedContext.tsx) holds the token. The axios interceptor at [lib/request.ts](lib/request.ts) reads it via `getEmbedToken()` and sets `Authorization: Bearer <token>`. With no token, requests just go anonymous (server returns whatever it returns).

### iframe bridge

[lib/embed/IframeBridge.tsx](lib/embed/IframeBridge.tsx) posts these messages to the parent window:

- `yesono-embed:ready` on first mount
- `yesono-embed:resize` `{ height }` on every body resize
- `yesono-embed:navigate` `{ path }` on route change

### Provider stack

[app/ClientWrapper.tsx](app/ClientWrapper.tsx):
`I18nProvider` → `EmbedProvider` → `ToastProvider` → `NavigationProvider` → children + `IframeBridge`.

### Available pages

- `/trending/[[...category]]`
- `/crypto`, `/crypto/[id]`
- `/sports`, `/sports/[businessId]/games/[eventId]`, `/sports/futures/*`, `/sports/live`
- `/market/[id]`, `/market/[id]/outcome/[outcomeIndex]`
- `/search`
- `/dashboards/*`

`/` redirects to `/trending` via [next.config.js](next.config.js).

### CSP / iframe security

`Content-Security-Policy: frame-ancestors $NEXT_PUBLIC_EMBED_FRAME_ANCESTORS` is set in both [next.config.js](next.config.js) and [middleware.ts](middleware.ts). Default is `*` (anyone can frame). Set the env to a space-separated list of host origins for production.

### Theme

CSS variables in [lib/theme/](lib/theme/) (`var(--accent)`, `var(--bg-primary)`, etc.) drive Tailwind and shadcn/ui. Light/dark via `data-theme` on `<html>`. shadcn's default tokens (`--background`, `--foreground`, ...) are mapped to the project variables in [styles/index.css](styles/index.css).

### i18n

15+ locales in [locales/](locales/). Stored in cookie + localStorage. When adding keys, sync to all language files.

### Module alias

`@/*` → repo root (see [tsconfig.json](tsconfig.json)).

### Env

See [.env.example](.env.example). Required:

- `NEXT_PUBLIC_C2C_API_BASE_URL` — read-only business API
- `NEXT_PUBLIC_AUTH_API_URL` — backend host (without `/api`)
- `NEXT_PUBLIC_ORDERBOOK_WS_URL` — orderbook websocket for live charts
- `NEXT_PUBLIC_EMBED_FRAME_ANCESTORS` — CSP allowlist for embedding

Optional:
- `NEXT_PUBLIC_REVIEW_API_HOST` — used by [lib/services/marketService.ts](lib/services/marketService.ts) image review endpoint
- `NEXT_PUBLIC_EXPLORER_BASE_URL` — block explorer link in detail pages
- `NEXT_PUBLIC_IMAGE_PROXY_BASE_URL` / `NEXT_PUBLIC_IMAGE_PROXY_ALLOWED_HOSTS` / `NEXT_PUBLIC_ENABLE_IMAGE_PROXY` — image proxy

**Source of truth for env**:
- **Local dev** (`pnpm dev`): reads `.env.development` (gitignored; copy from `.env.example`).
- **Cloudflare deploy** (`pnpm deploy[:dev]` or CI): values come from [wrangler.jsonc](wrangler.jsonc) `vars` (top-level = prod) and `env.dev.vars` (dev). [scripts/deploy.sh](scripts/deploy.sh) extracts them via [scripts/extract-wrangler-vars.mjs](scripts/extract-wrangler-vars.mjs) and exports to the build shell, so `next build` bakes the same values into the bundle that Cloudflare injects at runtime — single source of truth, no `.env.production`/wrangler drift.
- Real secrets (none today; if added later) belong in `wrangler secret put`, **not** `vars`.

### Deploy

完整文档见 [docs/deploy.md](docs/deploy.md)。一句话总结：

- **平时**：CI 自动部署。push `main` → dev；tag `v*` → prod；PR → preview worker（关闭自动清理）。
- **Hotfix**：本机 `pnpm deploy:dev` / `pnpm deploy`（prod 会要求二次确认）。
- **环境变量**：[wrangler.jsonc](wrangler.jsonc) 的 `vars` 是单一真理来源；构建期与 worker 运行期都从它注入。改 env → 改 [wrangler.jsonc](wrangler.jsonc) → push 触发重部署。

### Telemetry

Stripped. [lib/sentryClient.ts](lib/sentryClient.ts) is a no-op stub so existing call sites still compile. The host project should do its own error reporting.

## Component conventions

See [docs/react-component-guide.md](docs/react-component-guide.md) for the team's React component spec — naming, file size budgets, component layering, props/state/effect rules, styling, i18n, a11y, and the PR checklist. Treat it as the source of truth when adding new components or refactoring.

## Common gotchas

- **i18n**: 16 language files in `lib/i18n/langs/market/`. When adding keys, sync to all of them.
- **Mobile responsiveness**: prefer `flex flex-wrap`, `min-w-0` + `truncate`, `shrink-0`. Avoid hard widths on text containers.
- **Trading panel removed**: detail pages no longer render `TradingPanel`. If you reintroduce it, remember to also bring back `useCtfTrading` / `tradingStore` (today only a shell stub remains at [lib/store/tradingStore.ts](lib/store/tradingStore.ts)).
