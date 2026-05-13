# FR-1 iframe 父子通信 · 模拟实现说明

> 范围：本文档对应 [tob_frontend.md §FR-1](./tob_frontend.md)。
> 由于 tob 后端尚未对接，本期仅实现 **协议层 + 客户端运行时 + 本地 mock 父页**，
> 业务接入（FR-2 SSO 真链路鉴权 / FR-3..FR-15）按各自功能点继续推进。

---

## 0. 路径映射说明

`tob.md` / `tob_frontend.md` 假设在主站 `h2-market` 新增 `/embed/*` 子路由。
**本仓库 `yesono-embed` 是独立的"嵌入专用"项目**，整体即"嵌入版"，没有 `/embed/` 前缀：

| 文档中的写法              | 本仓库的实际位置                          |
| ------------------------- | ----------------------------------------- |
| `app/embed/layout.tsx`    | `app/layout.tsx`                          |
| `app/embed/page.tsx`      | `app/[各业务页]/page.tsx`（如 `/trending`）|
| `lib/embed/`              | `lib/embed/`（同名）                      |
| CSP `source: '/embed/:path*'` | `middleware.ts` 全局 matcher          |

所以接 FR-9.2 CSP 与 `/embed/error` 错误页时，要把"路由特化"改成"全站默认"。

---

## 1. 目标 & 非目标

**目标**

- 在 yesono-embed 项目内落地稳定可联调的 iframe 父子通信协议（v1）。
- 严格按 FR-1 要求实现 origin 校验、单一可信父 origin 锁定、出站消息（ready / resize / nav / metric / auth-required）。
- 提供本地 mock 父页（`public/mock-parent.html`），无需任何后端即可端到端跑握手 / 续期 / locale / theme 切换。
- 保持对老调用点（`getEmbedToken()` 给 axios 拦截器）的向后兼容。

**非目标（本期不做）**

- 不接入真实 tob 后端 (`/api/tob/auth/verify`)。
- 不做 token 续期 HTTP 重试逻辑（FR-2.3 的 401 重放队列），后续接 FR-2 时实现。
- 不做 `/embed/*` 子路由拆分；本仓库整体即"嵌入版"，全站都用嵌入态运行。

---

## 2. 架构

```
+--------------------+        postMessage         +-------------------------+
|  父页（渠道方/mock）|◀─ embed:ready/resize/... ─│  Bridge (lib/embed/     |
|                    |─ embed:auth/refresh/... ─▶│   bridge.ts)            |
+--------------------+                            +-----------┬-------------+
                                                              │
                                                              ▼
                                                    +-------------------------+
                                                    | EmbedContext.tsx        |
                                                    |  - token / expiresAt    |
                                                    |  - user / channel       |
                                                    |  - trustedOrigin        |
                                                    |  - bridge (单例)        |
                                                    +-----------┬-------------+
                                                                │
                            ┌──────────────────────┬────────────┴────────────┐
                            ▼                      ▼                         ▼
                  IframeBridge.tsx         lib/api.ts / request.ts     业务组件
                  (出站 ready/resize/      (axios 拦截器读 token)       useEmbed()
                   nav)
```

模块职责严格单向：

- `protocol.ts`：纯类型 + 常量，不带逻辑。
- `config.ts`：origin / locale / theme 白名单。
- `bridge.ts`：与 React 解耦的 postMessage 收发器（可单测）。
- `EmbedContext.tsx`：bridge 的唯一持有者，把消息状态化暴露给 React。
- `IframeBridge.tsx`：只负责出站事件（ready/resize/nav）。

---

## 3. 协议（v1）

所有消息都满足：

```ts
{ type: "embed:*", v: 1, ts: number, ...payload }
```

> **协议扩展（非 spec 强制）**：`embed:ping` / `embed:pong` / `embed:error` 是本实现
> 为联调便利新增的可选消息，不在 `tob_frontend.md §FR-1.2/1.3` 强制清单中。
> 渠道方可不实现；子页对未收到 `embed:pong` 不做任何阻塞。

### 3.1 父 → 子

| type                   | payload                                                     | 时机                  |
| ---------------------- | ----------------------------------------------------------- | --------------------- |
| `embed:auth`           | `{ token, expiresAt?, userCode?, channel?, locale?, theme? }` | 收到 ready 后         |
| `embed:token-refresh`  | `{ token, expiresAt? }`                                     | 主动续期 / 子页请求后 |
| `embed:locale-change`  | `{ locale }`                                                | 父页切语言            |
| `embed:theme-change`   | `{ theme: 'light'\|'dark' }`                                | 父页切主题            |
| `embed:ping`           | `{ nonce }`                                                 | 健康检查              |

### 3.2 子 → 父

| type                  | payload                                  | 时机                  |
| --------------------- | ---------------------------------------- | --------------------- |
| `embed:ready`         | `{ path, href, protocolVersion }`        | 子页挂载完成          |
| `embed:auth-required` | `{ reason: 'expired'\|'invalid'\|'missing' }` | token 失效或临近过期 |
| `embed:resize`        | `{ height }`                             | 内容高度变化（节流）  |
| `embed:nav`           | `{ path }`                               | 路由变化              |
| `embed:metric`        | `{ event, payload? }`                    | 业务埋点              |
| `embed:pong`          | `{ nonce }`                              | 回应 ping             |
| `embed:error`         | `{ code, message? }`                     | 子页内部错误上报      |

### 3.3 版本协商（回应 F4 待确认）

每条消息都带 `v: number`。当前协议为 v1。
- 子页收到 `v > 1` 的消息：尝试以 v1 schema 兼容处理（fail-open，避免父页比子页新时整体卡死）。
- 子页通过 `embed:ready.protocolVersion` 主动告知自身能力，父页据此降级。

---

## 4. 安全（FR-1.4 / 1.5 / 9.x）

### 4.1 origin 校验

由 `lib/embed/config.ts::isParentOriginAllowed()` 统一判定：

1. 优先读取 `NEXT_PUBLIC_EMBED_ALLOWED_PARENT_ORIGINS`（空格或逗号分隔）。
2. 兼容已有 `NEXT_PUBLIC_EMBED_FRAME_ANCESTORS`（仅当其值是具体 origin 时）。
3. 白名单非空时：仅放行其中的 origin。
4. 白名单为空 + dev 环境：放行 same-origin / `localhost` / `127.0.0.1`，方便本地联调。
5. 白名单为空 + 生产：**全部拒绝**（fail-closed）。

> ⚠ 不允许 `'*'` 出现在白名单。生产部署清单要求显式枚举（FR-1.4）。

### 4.2 source 校验

除 origin 外，还校验 `event.source === window.parent`，防止页面里被嵌入的同 origin 子 iframe 伪造 message。

### 4.3 trusted origin 锁定

首次收到合法消息后，把 `event.origin` 锁定为 `trustedParentOrigin`：

- 后续 `postMessage` 一律使用该 origin（**不再使用 `'*'`**）。
- 后续若再收到不同 origin 的消息（即便都在白名单内）也会拒绝，避免多父页同时操控。

### 4.4 ready 阶段的 target origin

`embed:ready` 在尚未锁定 trusted origin 时发送。处理：

1. 优先解析 `document.referrer`，若得到 origin 且在白名单 → 直接用它。
2. 否则回退 `'*'`。`ready` 不含敏感字段，可以接受。

### 4.5 token 存储（FR-9.5）

- 内存（React state）+ `sessionStorage`（key `yesono.embed.token.v1`），不写 `localStorage`。
- `pagehide` 时清空 sessionStorage。
- 过期时间已存 → 启动时若已过期不恢复。

### 4.6 URL token 兼容

历史代码读 `?token=xxx`。当前实现：**仅 dev 环境读取并打印警告**；生产忽略，强制走 postMessage（FR-9.4）。

### 4.7 防嵌入劫持（FR-1.5）

> ⚠ 当前未启用。原因：本仓库整体就是嵌入版，但本地直接 `next dev` 打开根路径就不在 iframe 里——为了不让开发体验破碎，暂未在 EmbedProvider 中强跳错误页。
>
> 待 FR-12 错误页 / `/embed/error` 路由落地后再补 `if (window.top === window.self)` 跳转。临时可由 `frame-ancestors` CSP（已在 `middleware.ts` 设置）来从渠道方侧防御。

---

## 5. 客户端 API

### 5.1 React 侧

```tsx
import { useEmbed } from "@/lib/embed/EmbedContext";

function MyPanel() {
  const {
    token,
    expiresAt,
    status,        // 'idle' | 'ready' | 'authed' | 'error'
    user,          // { userCode, channel } | null
    trustedOrigin, // string | null
    requestAuthRefresh,
    trackMetric,
    bridge,        // 高级用法：直接拿 Bridge 实例
  } = useEmbed();

  // 业务里上报埋点
  trackMetric("market_clicked", { marketId: "BTC-USD" });
}
```

### 5.2 非 React 模块（axios 拦截器）

```ts
import { getEmbedToken, requestEmbedAuthRefresh } from "@/lib/embed/EmbedContext";

const t = getEmbedToken();              // 同步取 token
requestEmbedAuthRefresh("expired");      // 401 时调用
```

`getEmbedToken()` 行为与改造前一致，`lib/api.ts` / `lib/request.ts` 无需改动。

### 5.3 Bridge 直接使用（少见）

```ts
import { createBridge } from "@/lib/embed/bridge";
const bridge = createBridge();
bridge.on("embed:auth", (msg) => {/* ... */});
bridge.send({ type: "embed:metric", event: "foo", payload: { a: 1 } });
bridge.dispose();
```

---

## 6. 鉴权握手时序（FR-3，模拟链路）

```
父页(load)─┐
           ├─ src=/trending  →  子页挂载
           │                       │
           │                       ├─ 创建 bridge, 监听 message
           │                       └─ 发 embed:ready ──┐
           │                                            ▼
           ├──── 收到 embed:ready ────────── 校验 origin OK
           │
           ├─ 发 embed:auth ──────────────────────────▶ 锁定 trustedOrigin
           │   {token, expiresAt, userCode,                │
           │    channel, locale, theme}                    ├─ 写 sessionStorage
           │                                               ├─ status = 'authed'
           │                                               └─ 业务可见 token
           │
           │                                       〈每分钟检查〉
           │                          ◀─── embed:auth-required (expired)
           │
           ├─ 发 embed:token-refresh ─────────────▶ 更新 token，业务无感
```

> 真实链路的 `GET /api/tob/auth/verify` 会在 FR-2 阶段加入：收到 `embed:auth` 后调用该接口确认 token 合法并拉取 walletAddress。

---

## 7. 本地 mock 父页

文件：`public/mock-parent.html`，由 Next dev 服务器直接静态托管。

### 7.1 启动

```bash
pnpm dev
# 浏览器打开
open http://localhost:3000/mock-parent.html
```

默认会以 `http://localhost:3000/trending` 作为子页 URL 加载。

可通过 query 指定子页地址：
```
http://localhost:3000/mock-parent.html?src=http://localhost:3000/trending
```

### 7.2 控制台能力

- **鉴权握手**：填入 token / TTL / userCode / channel / locale / theme，点击 `发送 embed:auth`。
- **续期**：`embed:token-refresh`（自动加 `-refreshed` 后缀方便观察）。
- **快过期**：发一个 60s 过期的 token，30s 内观察子页是否会自发 `embed:auth-required`。
- **locale / theme 切换**：单独发对应消息，验证子页响应。
- **健康检查**：`embed:ping` ←→ `embed:pong`。
- **故意非法消息**：测试无 `type` / 未知 `type` 是否被静默丢弃。
- **自定义 JSON**：直接编辑发送任何形状。
- **日志**：右下角面板按时间倒序打印所有进出消息。

### 7.3 跨 origin 验证（可选）

mock 父页与子页同 origin 时，`isParentOriginAllowed` 在 dev 下默认放行。
要验证生产白名单逻辑：

```bash
# 1. 把 mock-parent.html 复制到独立目录，用其他端口起一个静态服务
npx serve public -l 5173

# 2. 设环境变量并重启子页 dev
NEXT_PUBLIC_EMBED_ALLOWED_PARENT_ORIGINS="http://localhost:5173" pnpm dev

# 3. 浏览器打开 http://localhost:5173/mock-parent.html?src=http://localhost:3000/trending
# 4. 故意改成不在白名单的 origin（如 :5174）→ 子页应在 console 打印 "rejected message from origin"
```

---

## 8. 关键文件清单

| 文件                                | 作用                                       | 状态     |
| ----------------------------------- | ------------------------------------------ | -------- |
| `lib/embed/protocol.ts`             | 协议类型、常量、版本                       | **新增** |
| `lib/embed/config.ts`               | origin / locale / theme 白名单 + 校验函数  | **新增** |
| `lib/embed/bridge.ts`               | postMessage 收发核心，可独立单测           | **新增** |
| `lib/embed/EmbedContext.tsx`        | React 集成、token 状态、sessionStorage     | **重写** |
| `lib/embed/IframeBridge.tsx`        | ready / resize 节流 / nav 出站             | **重写** |
| `public/mock-parent.html`           | 本地 mock 父页 + 控制台                    | **新增** |
| `app/ClientWrapper.tsx`             | 已挂载 `EmbedProvider` + `IframeBridge`    | 无改动   |
| `lib/api.ts` / `lib/request.ts`     | 通过 `getEmbedToken()` 注入 Bearer         | 无改动   |
| `middleware.ts`                     | 设置 `frame-ancestors`                     | 无改动（后续按 FR-9.2 扩展完整 CSP） |

---

## 9. 与既有代码的兼容性

- 旧消息类型（`yesono-embed:set-token` / `yesono-embed:clear-token` / `yesono-embed:resize` / `yesono-embed:navigate`）**已废弃**。`README.md` / `CLAUDE.md` 中的示例需要在下一次文档迭代里更新。
- `getEmbedToken()` 接口签名保持不变，axios 注入点零改动。
- `useEmbed()` 在原 `{ token, setToken }` 之外**新增**字段；老消费者只读 token 不会受影响。

---

## 10. 测试清单

| 用例                                    | 验证方式                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------- |
| 子页挂载即发 ready                      | mock 父页日志看到 `embed:ready` 且包含 `protocolVersion: 1`               |
| 合法 origin 的 auth 被接收              | 子页 `useEmbed().token` 变成传入值，`status='authed'`                     |
| 非白名单 origin 被拒绝                  | console 出现 `[embed-bridge] rejected message from origin: ...`           |
| trusted origin 锁定                     | 第二次从其他 origin 发消息（同样在白名单内）会被拒绝                      |
| `event.source !== window.parent` 拒绝   | 在子页内部新建 iframe 向 parent post 同样消息 → 被拒                       |
| 形状非法（无 type / 未知 type）静默丢弃 | mock 控制台"非法消息"按钮，子页不报错也不响应                              |
| token 过期主动续期                      | 发 60s 过期 token，等 5 分钟阈值内（demo 用 60s，需缩短常量）观察发起 auth-required |
| sessionStorage 恢复                     | 鉴权后刷新页面，子页仍能从 sessionStorage 读到 token                      |
| pagehide 清理                           | 关闭 tab 后再开 → sessionStorage 已空                                     |
| resize 节流                             | 100ms 内多次触发只 post 1 条 `embed:resize`                               |
| nav 通知                                | 子页路由切换 → 父页收到 `embed:nav` `{path}`                              |

> 自动化测试（Vitest / Playwright）后续在 FR-2 一起补，思路：mock `window.parent` + 派发 `MessageEvent`。

---

## 11. 后续 TODO（接 FR-2 前）

1. axios 拦截器响应分支：401 → `requestEmbedAuthRefresh()` → 等下一次 `token-refresh` 到达后重放原请求（队列 / Promise）。
2. `middleware.ts` 扩展为 FR-9.2 完整 CSP（含 `connect-src` / `frame-src` / `object-src`），并对 `/embed/*` 路由特化（如本仓库后续做路由拆分）。
3. `app/(error)/embed-error/page.tsx`（或 `/embed/error`）落地，覆盖 `NOT_EMBEDDED` / `INVALID_ORIGIN` / `AUTH_FAILED` 三个文案。
4. 国际化：把 `applyLocale()` 中的 `dispatchEvent` 换成与 `lib/i18n/I18nContext` 直接联动（目前是松耦合，待 i18n 暴露 setter）。
5. 主题：`applyTheme()` 同上，与 `lib/theme` 的 `applyTheme()` 直接打通（避免双重写 cookie）。

---

## 12. 速查（常见操作片段）

```ts
// 业务里上报埋点
const { trackMetric } = useEmbed();
trackMetric("order_placed", { betId, market });

// 401 时手动触发续期
import { requestEmbedAuthRefresh } from "@/lib/embed/EmbedContext";
requestEmbedAuthRefresh("expired");

// 检查当前是否在 iframe 里
const { bridge } = useEmbed();
if (bridge?.isEmbedded()) { /* ... */ }
```
