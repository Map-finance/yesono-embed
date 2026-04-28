# YesONo Embed

A display-only fork of `h2-market` for embedding inside a host project's iframe.
No login, no wallets, no trading — only market browsing pages.

## What's inside

- Pages: `/trending`, `/crypto`, `/sports`, `/market/[id]`, `/search`, `/dashboards/*`
- The host injects an auth token via `?token=` or `postMessage`; the axios layer
  reads it from `EmbedContext` and sets `Authorization: Bearer <token>`.
- An iframe bridge posts `ready` / `resize` / `navigate` messages to the parent.

See [CLAUDE.md](./CLAUDE.md) for architecture notes.

## Getting started

```bash
pnpm install
cp .env.example .env.local      # tweak as needed
pnpm dev                        # http://localhost:3000  (PORT=3002 if 3000 taken)
```

`/` redirects to `/trending`.

## Embedding

```html
<iframe
  id="yesono"
  src="https://your-embed.example.com/trending?token=USER_JWT"
  style="width:100%; border:0"
></iframe>

<script>
  window.addEventListener("message", (e) => {
    if (e.data?.type === "yesono-embed:resize") {
      document.getElementById("yesono").style.height = e.data.height + "px";
    }
  });

  // Refresh / change token at any time:
  // iframe.contentWindow.postMessage({ type: "yesono-embed:set-token", token: "..." }, "*");
</script>
```

Set `NEXT_PUBLIC_EMBED_FRAME_ANCESTORS` to the host origin(s) before going live
(default `*` allows any site to frame).

## Build & deploy

完整部署文档：**[docs/deploy.md](./docs/deploy.md)**。

CI 走 [.github/workflows/deploy.yml](./.github/workflows/deploy.yml)：push `main` → **prod**、push `dev` → dev、PR → preview、tag `v*` 仅归档不部署。本机 hotfix：

```bash
pnpm deploy:dev    # → worker: dev-yesono-embed (safe default)
pnpm deploy        # → worker: yesono-embed (prompts for confirmation)
pnpm preview       # local OpenNext preview, uses prod vars
```

环境变量来自 [wrangler.jsonc](./wrangler.jsonc) `vars` / `env.dev.vars`（单一真理来源，构建期 + 运行期同源）。

## Color scheme

Background `#111111`, accent `#FFD608`, text `#FFFFFF`. Light theme also supported (toggle via `data-theme="light"` on `<html>`).
