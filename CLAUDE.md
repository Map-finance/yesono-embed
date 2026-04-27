# CLAUDE.md

YesONo Embed — a display-only fork of `h2-market`, intended to be loaded inside an iframe of a host project. No login, no wallets, no trading.

## Commands

```bash
yarn dev            # Next dev server (3000 by default; pass PORT=3002 if 3000 taken)
yarn dev:https      # HTTPS dev (experimental)
yarn build          # next build
yarn build:clean    # rm -rf .next .open-next
yarn start          # next start
yarn lint
yarn deploy         # bash scripts/deploy.sh prod (Cloudflare via OpenNext + Wrangler)
yarn deploy:dev     # bash scripts/deploy.sh dev
yarn preview        # OpenNext local preview
```

No tests configured.

## Architecture

Next.js 14 App Router on `@opennextjs/cloudflare`. UI uses Tailwind + Antd 5 + a CSS-variable theme. Data fetched via SWR / TanStack Query with a thin axios layer at [lib/request.ts](lib/request.ts).

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
`I18nProvider` → `EmbedProvider` → `ToastProvider` → `NavigationProvider` → `ConfigProvider (Antd)` → `App` → children + `IframeBridge`.

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

CSS variables in [lib/theme/](lib/theme/) (`var(--accent)`, `var(--bg-primary)`, etc.) drive both Tailwind and Antd. Light/dark via `data-theme` on `<html>`.

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

### Telemetry

Stripped. [lib/sentryClient.ts](lib/sentryClient.ts) is a no-op stub so existing call sites still compile. The host project should do its own error reporting.

## Common gotchas

- **i18n**: 16 language files in `lib/i18n/langs/market/`. When adding keys, sync to all of them.
- **Mobile responsiveness**: prefer `flex flex-wrap`, `min-w-0` + `truncate`, `shrink-0`. Avoid hard widths on text containers.
- **Trading panel removed**: detail pages no longer render `TradingPanel`. If you reintroduce it, remember to also bring back `useCtfTrading` / `tradingStore` (today only a shell stub remains at [lib/store/tradingStore.ts](lib/store/tradingStore.ts)).
