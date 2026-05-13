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
