# FR-2 SSO Token 管理 / FR-4 余额展示 · 实现说明

> 范围：本文档对应 [tob_frontend.md §FR-2](./tob_frontend.md) / [§FR-4](./tob_frontend.md)，
> 并对照最新 [tob2.md](./tob2.md) 校准命名（dYdX → yesono 交易链）。
>
> 由于 tob 后端 (`prediction-market-service-tob`) 尚未对接，
> 通过 `NEXT_PUBLIC_TOB_USE_MOCK=1` 提供本地 mock，FR-2/FR-4 可独立联调闭环。

---

## 1. 关键文件

| 文件                                        | 作用                                                                 | 状态     |
| ------------------------------------------- | -------------------------------------------------------------------- | -------- |
| `lib/embed/auth-queue.ts`                   | 401 续期重试队列（单例，不依赖 React）                               | **新增** |
| `lib/services/tobApi.ts`                    | tob 后端 HTTP 客户端 + mock 模式（verify / refresh / balance / wallet） | **新增** |
| `lib/embed/EmbedContext.tsx`                | 接入 verify、token-refresh 唤醒队列、`auth-required` 去重            | **改动** |
| `lib/request.ts`                            | 401 响应拦截器：等待新 token → 重放原请求                             | **改动** |
| `lib/hooks/useTobBalance.ts`                | 余额拉取 hook：30s 轮询 + visibility 暂停 + 事件触发                  | **新增** |
| `components/embed/EmbedBalanceBadge.tsx`    | Header 上的"渠道为主、可展开三档"余额徽章                             | **新增** |
| `components/Header.tsx`                     | 桌面 / 移动端 Header 各挂一个 `<EmbedBalanceBadge />`                 | **改动** |
| `.env.example`                              | 新增 `NEXT_PUBLIC_TOB_API_BASE_URL` / `NEXT_PUBLIC_TOB_USE_MOCK`      | **改动** |

---

## 2. FR-2 SSO Token 管理

### 2.1 状态机

```
            embed:auth (token, userCode, channel)
   idle ─────────────────────────────────────────▶ verifying
                                                     │
                              POST /api/tob/auth/verify
                                                     │
                              ┌──── ok=true ────────┘
                              ▼                     ┌──── 失败 / 网络
                            authed                  ▼
                                                  error
                              ▲
                              │ embed:token-refresh + 401 重放成功
                              │
                            authed (新 token)
```

### 2.2 token 存储（FR-2.1）

复用 FR-1 实现：内存 + sessionStorage（`yesono.embed.token.v1`）；
不写 localStorage；`pagehide` 清空。

### 2.3 Bearer 注入（FR-2.2）

`lib/request.ts` 请求拦截器读 `getEmbedToken()` 注入：
```@/Users/kksthinkpad/res/code/js/yesono-embed/lib/request.ts:121-128
    const token = getEmbedToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
```
所有走 `lib/request.ts` 的业务调用（包括 `lib/services/tobApi.ts`）零改动获得 Bearer。

### 2.4 401 续期重试（FR-2.3）— **核心**

时序（业务请求拿到 401）：

```
业务请求 ──axios.post──▶ 服务端
       ◀── 401 ────────────
       │
   response interceptor
       │  __embedAuthRetried 标记防循环
       ▼
   requestEmbedAuthRefresh("expired")
       │  authQueue.markRequesting() 去重
       ▼
   bridge.send(embed:auth-required)  ─▶ 父页
                                          │
                                          ▼
   await authQueue.waitForRefresh(15s) ◀── embed:token-refresh
       │
   resolveAll()  → 唤醒所有等待者
       ▼
   request.request(cfg)  ──▶ （拦截器自动注入新 Bearer）─▶ 服务端 200
```

设计要点：
- **去重**：`authQueue.markRequesting()` 保证短时间内多个 401 共用一次"请父页续期"。
- **超时**：默认 15s 拿不到 `embed:token-refresh` 即 reject，原 401 抛给业务层。
- **重入保护**：`config.__embedAuthRetried` 标记，避免 cfg 进入二次循环。
- **临近过期主动**：`EmbedContext` 内每分钟巡检；`< 5min` 走同一个 `auth-required` 通道（也会触发 `markRequesting()` 去重）。

### 2.5 鉴权握手时序（FR-3）

```
1. 父页 src=/trending 加载 iframe
2. 子页挂载 → 发 embed:ready
3. 父页收到 ready → 发 embed:auth
4. 子页 EmbedContext.bridge.on('embed:auth')
   ├─ 立即把 token / userCode / channel 落地
   ├─ status='verifying'
   └─ POST /api/tob/auth/verify  ─▶ tob
5. tob 返回 { ok, userInfo, walletAddress: { bac, tradeChain } }
6. 子页 status='authed' → 业务层据此挂 BalanceBadge / 等等
```

mock 模式下，`verifyAuth()` 返回固定假数据（200ms 延迟）。

### 2.6 useEmbed() 新增字段

```ts
const {
  token, expiresAt,
  status,      // 'idle' | 'ready' | 'verifying' | 'authed' | 'error'
  user,        // { userId, userCode, channel, nickname }
  wallet,      // { bac, tradeChain } -- verify 后填充
  trustedOrigin,
  error,       // verify 失败原因
  bridge,
  setToken, requestAuthRefresh, trackMetric,
} = useEmbed();
```

---

## 3. FR-4 余额展示

### 3.1 数据模型

`/api/tob/balance` 返回三档（参 tob2.md §3.2 / §5.2）：
```ts
interface TobBalanceBreakdown {
  channel: number;       // 渠道账本（默认主显）
  bac: number;           // BAC 链 USDT
  tradeChain: number;    // yesono 交易链 freeCollateral
  recommended: number;   // 服务端建议主显金额
  currency: 'USDT';
  serverTime: number;
}
```

> 命名说明：tob2.md 把"dYdX collateral"统一改名为"yesono 交易链 freeCollateral"。
> 字段名采用 **`tradeChain`**（避免和老字段 `dydx` 混淆）；后端定字段名时可与之对齐。
> 状态机字段 `bridged_to_dydx` 按 tob2.md §3.3 注释保留作历史兼容。

### 3.2 展示策略（FR-4.2）

- **方案 A（默认）**：仅显示 `recommended`（实际是 `channel`），用户最熟悉。
- 点击徽章展开 → 方案 B：渠道 / BAC / 交易链 三档，advanced 用户可见。

UI 由 `@/Users/kksthinkpad/res/code/js/yesono-embed/components/embed/EmbedBalanceBadge.tsx` 实现，仅在 `status==='authed'` + 嵌入态下渲染（非 iframe 直接 `return null`，不影响 C 端主站体验）。

### 3.3 自动刷新（FR-4.3）

`useTobBalance` hook 行为：

| 触发器                          | 行为                            |
| ------------------------------- | ------------------------------- |
| `status` 变 `authed`             | 立即拉一次                      |
| 每 30s 周期                      | 静默刷新                        |
| `document.visibilitychange→visible` | 立即刷新（覆盖被隐藏期间错过的 tick） |
| `document.visibilitychange→hidden`  | 跳过 tick                       |
| 业务 `notifyEmbedBalanceRefresh()`  | 立即刷新（下单 / 取消后调用） |
| `status` 离开 `authed`              | 清空数据                        |

下单 / 取消处一行接入：
```ts
import { notifyEmbedBalanceRefresh } from "@/lib/hooks/useTobBalance";
// 下单成功 / 取消成功后：
notifyEmbedBalanceRefresh();
```

`useTobBalance` 用 `inFlight` 锁防并发：30s 轮询和事件刷新若同帧触发只发一个请求。

---

## 4. mock 模式详情

`@/Users/kksthinkpad/res/code/js/yesono-embed/lib/services/tobApi.ts:71` 起。

启用：`.env` 设 `NEXT_PUBLIC_TOB_USE_MOCK=1`。
- `verifyAuth()` → 返 `{ ok, userInfo, walletAddress }` 固定假数据，200ms 延迟。
- `getBalance()` → channel ≈ 1280 USDT，bac ≈ 12.5，tradeChain ≈ 87，每次小幅 jitter，方便观察"刚刷新"。
- `refreshAuthHttp()` → 假新 token，1h 过期。

切回真接口：把 `NEXT_PUBLIC_TOB_USE_MOCK` 删掉或设 0；同时设 `NEXT_PUBLIC_TOB_API_BASE_URL`（生产形态）。

---

## 5. 联调步骤

```bash
# 1. 启用 mock 后端
echo "NEXT_PUBLIC_TOB_USE_MOCK=1" >> .env.local

# 2. 启动 dev server
pnpm dev

# 3. 浏览器打开 mock 父页
open http://localhost:3000/mock-parent.html
```

预期观察点：

| 步骤                                            | 子页表现                                       |
| ----------------------------------------------- | ---------------------------------------------- |
| 加载完成                                        | 子页发 `embed:ready`，父页自动回 `embed:auth`  |
| `embed:auth` 到达                               | EmbedContext `status` 经 `verifying` → `authed` |
| `status==='authed'`                             | Header 出现 `$1280.42 USDT` 徽章               |
| 点击徽章                                        | 展开三档：Channel / BAC / yesono trade chain   |
| 点徽章 →"刷新"图标                              | 立即重拉，30s 计时归零                          |
| mock 父页 ⏱ "发 60s 即将过期 token"             | 子页 1 分钟内自发 `embed:auth-required`         |
| mock 父页 ⏱ "embed:token-refresh"               | 子页静默更新 token；正在等待的 401 请求恢复     |
| **测 401 重放**：临时把 mock 改 `getBalance` 抛 401 | 子页发 `auth-required`，父页 `token-refresh` 后请求自动重放 |

---

## 6. 与 tob2.md 的对齐

| tob2.md 调整                                | 本期对应改动                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `dYdX` → `yesono 交易链`                    | `TobBalanceBreakdown.tradeChain` 字段、UI 文案 `yesono trade chain`                       |
| `/api/tob/wallet/address` 返回 BAC + 交易链 | `EmbedWalletAddress { bac, tradeChain }`，verify 接口返同形                               |
| BAC chainId（测试网 66666 / 主网 723）      | 不在 FR-2/FR-4 范围；`scripts/extract-wrangler-vars.mjs` 等链上配置在做交互（FR-6+）时再校准 |
| `bridged_to_dydx` 字段保留作兼容            | TS 类型层未引入此字段，无影响                                                              |

---

## 7. 后续 TODO

1. **`/api/tob/auth/refresh` HTTP 路径**：tob.md §5.2 提供的 GET 续期，作为 postMessage 续期失败时的兜底（场景：父页临时不响应）。当前未启用；接入位置预留在 `tobApi.ts::refreshAuthHttp()`。
2. **失败态 UI**：`status==='error'` 目前只在控制台打印；FR-12 错误页落地时把 verify 失败导向 `/embed/error?code=AUTH_FAILED`。
3. **i18n**：`EmbedBalanceBadge` 文案当前硬编码英文，FR-11 可加翻译。
4. **下单 / 取消接入 `notifyEmbedBalanceRefresh`**：等 FR-7 下单流程落地时加一行调用即可。
5. **多渠道单元测试**：401 队列、verify 时序、轮询暂停 → 用 Vitest + jsdom 写最小可信测试集。

---

## 8. 已知局限

- mock 模式的 `verify` 与 `balance` 返回值固定形状；不模拟"渠道在某一秒余额变 0"等边界，需要联调真后端时验。
- `useTobBalance` 在标签长时间隐藏后再显示，会立即触发一次拉取；但若网络刚好抖动，UI 会停留在旧数据并标 `error`，下一次 30s tick 再恢复——可接受。
- `EmbedBalanceBadge` 不锁定父页 origin 一致性（不需要：余额数据由本子页 + tob 出，不来自父页）。
