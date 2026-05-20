# 父子页通信协议与流程

> 单一真相来源代码：
> - 协议类型定义：`lib/embed/protocol.ts`
> - 通信封装（origin/源校验、锁定、发送/监听）：`lib/embed/bridge.ts`
> - React 状态机（握手 / verify / 401 重放 / locale / theme）：`lib/embed/EmbedContext.tsx`
> - 渠道 JWT → 本系统 accessToken：`lib/embed/tobAuth.ts`
> - 401 重放队列：`lib/embed/auth-queue.ts`
> - origin 白名单：`lib/embed/config.ts`（env `NEXT_PUBLIC_EMBED_ALLOWED_PARENT_ORIGINS`）
> - 父页联调模拟器：`public/mock-parent.html`

---

## 1. 设计总览

```
┌────────────────────────┐                    ┌─────────────────────────────┐
│  Parent (渠道方网站)    │                    │  Child (yesono-embed iframe)│
│                        │                    │                             │
│  - 持有渠道 JWT         │  postMessage       │  - 监听 message             │
│  - 通过 iframe src 嵌入 │ ───────────────▶   │  - origin 白名单校验         │
│                        │                    │  - 锁定 trusted origin      │
│                        │  postMessage       │  - 渠道 JWT →               │
│                        │ ◀───────────────   │    GET /api/tob/auth/verify │
│                        │                    │  - 拿到 accessToken，        │
│                        │                    │    注入所有后续 HTTP         │
└────────────────────────┘                    └─────────────────────────────┘
```

关键约束（**安全**）：

- 消息格式必须有 `type: "embed:..."` 前缀 + `v: number`
- 子页只接受 `window.parent` 发来 + origin 在白名单 的消息
- 子页 **首次收到合法消息后锁定 `trustedParentOrigin`**，之后所有发送 / 接收均与此 origin 匹配
- `ready` 握手阶段因尚未锁定，发送目标 origin 回退策略：`referrer 推断 → 白名单验证 → 命中则用推断值，否则回退 "*"`（`ready` 不含敏感数据，可容忍）

协议版本：**v1**（每条消息的 `v` 字段；子→父的 `embed:ready` 回报自身最高支持版本，便于将来协商）

---

## 2. 消息目录

### 2.1 父 → 子（`ParentMsgType`）

| type | payload | 说明 |
| --- | --- | --- |
| `embed:auth` | `{ token, expiresAt?, userCode?, channel?, locale?, theme? }` | **必须**。首次握手；`token` 是**渠道 JWT**（不是本系统 accessToken） |
| `embed:token-refresh` | `{ token, expiresAt? }` | 当子页因 401 发出 `embed:auth-required` 后由父页下发新的渠道 JWT |
| `embed:locale-change` | `{ locale }` | 切语言；白名单校验过才应用 |
| `embed:theme-change` | `{ theme: "light" \| "dark" }` | 切主题 |
| `embed:ping` | `{ nonce }` | 健康检查；子页回 `embed:pong { nonce }` |

### 2.2 子 → 父（`ChildMsgType`）

| type | payload | 说明 |
| --- | --- | --- |
| `embed:ready` | `{ path?, href?, protocolVersion: 1 }` | 子页挂载完成即广播，父页可作 "iframe up" 信号 |
| `embed:auth-required` | `{ reason: "expired" \| "invalid" \| "missing" }` | 子页业务接口 401 或 verify 失败时主动请求父页刷新渠道 JWT |
| `embed:resize` | `{ height }` | 内容高度变化，父页可同步 iframe 高度 |
| `embed:nav` | `{ path }` | 子页路由变更，父页可同步 URL |
| `embed:metric` | `{ event, payload? }` | 埋点透传（父页决定是否上报） |
| `embed:pong` | `{ nonce }` | 对 ping 的回复 |
| `embed:error` | `{ code, message? }` | 运行时异常；e.g. `tob_auth_rate_limited` |

**通用 envelope**（`BaseMsg`）：所有消息必带 `v: 1`，发送端自动注入 `ts: Date.now()`，可选 `id` 用于 request/response 配对。

---

## 3. 握手时序图

```
Parent                             Child (iframe)
──────                             ──────────────
                                   (iframe onload)
                                   ─ createBridge()
                                   ─ send embed:ready {protocolVersion:1, path, href}
               ◀────────────────── embed:ready
  确认 iframe
  已挂载
  ↓
  postMessage(embed:auth, {token:<channel-JWT>, userCode, channel, locale, theme})
  ───────────────────────────▶

                                   ─ origin 白名单校验 ✓
                                   ─ trustedParentOrigin 锁定
                                   ─ 收到 embed:auth
                                     setStatus("verifying")
                                     setUser({userCode, channel, profile:null})
                                     apply locale / theme
                                     ↓
                                     GET /api/tob/auth/verify
                                       Authorization: Bearer <channel-JWT>
                                     ───────────────────────────▶  [Backend]
                                     ◀─── 200 { code:200, data:{ token:{accessToken}, user, isNewUser } }
                                     ↓
                                     setToken(accessToken)
                                     writeSessionStorage({token, expiresAt})
                                     setStatus("authed")
                                     setUser({..., profile: r.user})

  （此后父页不直接感知 accessToken；
    子页一切 HTTP 请求自动带 Authorization: Bearer <accessToken>）

                                   ═══════════════════════════════════════════════
                                   后续业务接口（lib/request.ts 拦截器注入）
                                   ═══════════════════════════════════════════════

                                   POST /api/tob/order/create
                                     Authorization: Bearer <accessToken>
                                   ◀─── 401
                                   ↓
                                   authQueue.markRequesting() ✓
                                   send embed:auth-required {reason:"expired"}
               ◀────────────────── embed:auth-required
  ↓
  postMessage(embed:token-refresh, {token:<新 channel-JWT>})
  ───────────────────────────▶
                                   再次 verify → setToken(新 accessToken)
                                   authQueue.resolveAll() → 所有挂起的 401 请求自动重放
```

**状态机**（`EmbedContext.status`）：

```
idle  ──(收到 embed:auth)──▶  verifying  ──(verify 200)──▶  authed
                                   │
                                   └─(verify 4xx/5xx)──▶  error
                                                              │
                                                              └─(新 embed:auth / embed:token-refresh)──▶ verifying
```

---

## 4. 安全细节

### 4.1 origin 白名单

- env：`NEXT_PUBLIC_EMBED_ALLOWED_PARENT_ORIGINS="https://a.com,https://b.com"`
- 生产环境不允许 `*`；本地 dev 可放 `http://localhost:*`（参见 `lib/embed/config.ts` 实现）
- `bridge.onMessage`：
  1. `data` 必须是 object
  2. `data.type` 必须命中 `ParentMsgType`
  3. `ev.origin` 必须在白名单
  4. `ev.source === window.parent`（防内嵌子 iframe 伪造）
  5. 若 `trustedParentOrigin` 已锁定且本次 `ev.origin` 不一致，**直接拒绝**

### 4.2 trustedParentOrigin 锁定

- 首次合法消息后锁定，之后 `send()` 只用这个 origin；绝不回退 `*`
- 实现见 `lib/embed/bridge.ts:150-158`

### 4.3 渠道 JWT vs accessToken

- **渠道 JWT**（父页下发）：只用于 `/api/tob/auth/verify` 的 Authorization；子页不 persist
- **accessToken**（verify 返回）：
  - 内存：`EmbedContext.token` + `tokenRef`
  - `sessionStorage`：`yesono.embed.token` = `{ token, expiresAt }`（页刷新恢复）
  - 注入：`lib/request.ts` / `lib/api.ts` 的 `authFetch` 请求拦截器
- **刷新方式**：业务 401 → 子页发 `embed:auth-required` → 父页下发 `embed:token-refresh` → verify 拿到新 accessToken，auth-queue 自动重放原请求

---

## 5. env 变量速查

| 变量 | 作用 |
| --- | --- |
| `NEXT_PUBLIC_EMBED_ALLOWED_PARENT_ORIGINS` | 父页 origin 白名单（逗号分隔） |
| `NEXT_PUBLIC_TOB_API_BASE_URL` | `/api/tob/auth/verify` 和其他 tob 接口的基地址 |
| `NEXT_PUBLIC_TOB_USE_MOCK=1` | mock：verify 跳过网络直接把渠道 JWT 当 accessToken；tob 写接口走假数据 |
| `NEXT_PUBLIC_TOB_USE_NEW_ORDER=1` | 市场详情页 / 体育页展示新版下单面板 `<TradingPanel/>` |
| `NEXT_PUBLIC_TOB_USE_NEW_CTF=1` | 持仓页展示 Split/Merge/Redeem 按钮 + `<CtfActionDialog/>` |
| `NEXT_PUBLIC_TOB_DEFAULT_CREATE_BET_AMOUNT` | 创建市场默认 `betAmount`（渠道 UI 不暴露） |

---

## 6. 联调 Cheat Sheet（mock-parent.html）

开 `http://localhost:3000/mock-parent.html`：

| 按钮 | 发送消息 |
| --- | --- |
| **embed:auth** | `{type:"embed:auth", token:<input>, userCode, channel, locale, theme}` — 首次握手 |
| **embed:token-refresh** | `{type:"embed:token-refresh", token:<input>-refreshed}` — 模拟父页刷 JWT |
| **embed:locale-change** | 切 iframe 语言 |
| **embed:theme-change** | 切 iframe 主题 |
| **embed:ping** | 健康检查；iframe 应回 pong |

DevTools 验证：

1. Network：`GET /api/tob/auth/verify` 带 `Authorization: Bearer <JWT>`，200 后 `Cookie` 含 httpOnly `refreshToken`
2. Console：`[embed-bridge] trusted parent origin locked: ...`
3. React DevTools：`EmbedContext.status === "authed"`
4. `sessionStorage.getItem("yesono.embed.token")` 有值
5. 触发业务请求（创建市场 / 下单），Request Header 自动带 `Authorization: Bearer <accessToken>`

**排错**：

| 症状 | 定位 |
| --- | --- |
| 点 `embed:auth` 控制台打印 `rejected message from origin` | 白名单没加 `http://localhost:3000`，改 `NEXT_PUBLIC_EMBED_ALLOWED_PARENT_ORIGINS` 并**重启 dev server** |
| verify 未调用直接 authed | `NEXT_PUBLIC_TOB_USE_MOCK=1` 走 mock 短路，见 `tobAuth.ts:95-103` |
| verify 返回 401 | 渠道 JWT 解码失败或过期（payload `exp` 已过 / 缺字段） |
| verify 返回 429 | 命中登录限流，子页会发 `embed:error { code: "tob_auth_rate_limited" }` 给父页 |
| 业务接口 401 反复 | 父页没监听 `embed:auth-required`，没回 `embed:token-refresh`；或 `auth-queue` 超时了（默认 30s） |

---

## 7. 接入方集成指南：token 握手（父页必读）

子页（embed）**没有自己刷新 token 的能力**——它不持有 refresh token，session 完全归父页所有。子页能做的只是「喊一嗓子」请求续期，**父页必须实现下面两件事**，否则 token 过期后子页的下单 / 列表等会失效且无法自动恢复。

### 7.1 父页要实现的两条消息

| 方向 | 消息 | 父页职责 |
| --- | --- | --- |
| 父 → 子 | `embed:auth` | **首次握手必发**。把「渠道 JWT」下发给子页，子页据此调 `/api/tob/auth/verify` 完成登录 |
| 父 → 子 | `embed:token-refresh` | **收到子页 `embed:auth-required` 后必回**。下发一个**新的渠道 JWT**，子页重新 verify 拿到新 accessToken |
| 子 → 父 | `embed:auth-required` | 子页主动发出（token 过期 / 失效 / 缺失，或用户在未登录时点了下单）。父页**监听**它并触发上面的 `embed:token-refresh` |

> 渠道 JWT ≠ 本系统 accessToken。父页全程只下发**渠道 JWT**；accessToken 是子页 verify 后自己持有的，父页不感知、也不要传。

### 7.2 父页参考实现（可直接照抄）

```js
const iframe = document.getElementById("yesono-embed");
// 必须是 embed 应用自身的 origin（即 iframe src 的源），不要用 "*"
const EMBED_ORIGIN = "https://embed.yesono.trade";

function postToEmbed(msg) {
  iframe.contentWindow?.postMessage({ v: 1, ts: Date.now(), ...msg }, EMBED_ORIGIN);
}

// —— 1. 首次握手：iframe 加载后下发渠道 JWT ——
// 建议等子页发来 embed:ready 后再发，确保子页 bridge 已就绪
async function sendAuth() {
  const channelJwt = await fetchFreshChannelJwt(); // ← 父页自己的取 token 逻辑
  postToEmbed({
    type: "embed:auth",
    token: channelJwt,
    expiresAt: Date.now() + 15 * 60 * 1000, // 可选：渠道 JWT 过期时间(epoch ms)
    userCode: "...",   // 可选
    channel: "...",    // 可选
    locale: "zh-CN",   // 可选
    theme: "dark",     // 可选
  });
}

// —— 2. 监听子页的续期请求，回发新的渠道 JWT ——
window.addEventListener("message", async (ev) => {
  // 只信任 embed 的 origin，丢弃其它来源
  if (ev.origin !== EMBED_ORIGIN) return;
  const data = ev.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "embed:ready") {
    sendAuth(); // 子页就绪 → 首次握手
    return;
  }

  if (data.type === "embed:auth-required") {
    // data.reason: "expired" | "invalid" | "missing"
    // 关键：尽快（建议 < 10s）拿到一个新的渠道 JWT 回发
    const channelJwt = await fetchFreshChannelJwt();
    postToEmbed({ type: "embed:token-refresh", token: channelJwt });
  }
});
```

### 7.3 时效要求（影响「无感」程度）

子页这边有两个等待窗口，父页响应越快体验越无感：

- **401 自动重放**：业务请求 401 后，子页 `auth-queue` 等父页回 `token-refresh`，**默认 15s** 超时。父页在窗口内回 → 失败的请求自动重放，用户完全无感。
- **下单自动续单**：用户点下单时若未登录 / token 失效，子页记录这一单的意图并发 `embed:auth-required`，**90s 内**拿到新 token 就**自动把那一单补发**；超时则放弃（按钮从「等待登录」恢复，不会延迟很久突然成交）。

### 7.4 不实现的后果

- 不发 `embed:auth`：子页永远匿名，所有需要登录的操作（下单、持仓、创建市场、审核记录）不可用。
- 不回 `embed:token-refresh`：token 一过期，列表静默变空、下单失败且**无法自动恢复**；子页等满超时后只能提示用户。

### 7.5 自检清单

1. iframe `src` 的 origin 已加入子页白名单 env `NEXT_PUBLIC_EMBED_ALLOWED_PARENT_ORIGINS`（生产不允许 `*`）。
2. 父页 `postMessage` 的 `targetOrigin` 用的是 embed 的具体 origin，不是 `"*"`。
3. 收到 `embed:auth-required` 能在 ~10s 内回 `embed:token-refresh`。
4. 渠道 JWT 每次都取**新鲜**的（过期的 JWT 会让子页 verify 继续 401，陷入反复续期）。
