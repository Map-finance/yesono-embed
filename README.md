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

Cloudflare Workers via `@opennextjs/cloudflare` + Wrangler. Env values come from
[wrangler.jsonc](./wrangler.jsonc) `vars` / `env.dev.vars` (single source of
truth — no separate `.env.production`).

```bash
pnpm deploy:dev    # → worker: dev-yesono-embed (safe default)
pnpm deploy        # → worker: yesono-embed (prompts for confirmation)
pnpm preview       # local OpenNext preview
```

Preferred path is CI: [.github/workflows/deploy.yml](./.github/workflows/deploy.yml)
auto-deploys PR previews, `main` → dev, and `v*` tags → prod. See
[CLAUDE.md](./CLAUDE.md#deploy) for required GitHub Secrets and the trigger matrix.

## Color scheme

Background `#111111`, accent `#FFD608`, text `#FFFFFF`. Light theme also supported (toggle via `data-theme="light"` on `<html>`).
