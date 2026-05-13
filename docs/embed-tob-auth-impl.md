# TOB 鉴权登录 (`/api/tob/auth/verify`) 接入实现

> 关联接口文档：`docs/API_TOB_AUTH_VERIFY.md`
> 关联协议文档：`docs/embed-fr1-impl.md`（FR-1 父子通信）、FR-2 SSO Token

## 1. 流程总览

```
父页（渠道）                       子页（yesono-embed）                后端
   │                                    │                              │
   │ embed:auth { token=渠道JWT }────────▶                              │
   │                                    │ status="verifying"            │
   │                                    │ GET /api/tob/auth/verify ────▶│
   │                                    │   Authorization: Bearer <JWT> │
   │                                    │  (withCredentials)            │
   │                                    │                               │
   │                                    │◀──── R<LoginResponseDTO> + Set-Cookie(refreshToken)
   │                                    │ 写入 accessToken / expiresAt  │
   │                                    │ status="authed"               │
   │                                    │                               │
   │                                    │ 业务请求 Authorization: Bearer <accessToken>
   │                                    │
   │ embed:auth-required(invalid)◀──── verify 失败时回报，由父页决定下一步
```

**核心变化**：父页下发的 `token` 在新协议下被理解为 **渠道 JWT**，不再直接用作业务接口的 Bearer。子页内部需多走一步 `/api/tob/auth/verify` 完成 TOB 登录，拿到本系统 `accessToken` 后再使用。

## 2. 落地变更

| 文件 | 变更 |
| --- | --- |
| `lib/embed/tobAuth.ts` | **新增**。封装 `verifyTobAuth(channelToken)`，独立 axios 实例（`withCredentials=true`、不走 `lib/request.ts` 的 401 拦截器），支持 mock 模式直通。 |
| `lib/embed/EmbedContext.tsx` | 改造 `embed:auth` / `embed:token-refresh` 处理：父页下发的渠道 JWT → 调 verify → 把返回的 `accessToken` / `expiresAt` 写入 token 状态。verify 失败时 `status='error'` 并向父页回报 `auth-required(invalid)` + 限流时附 `error(tob_auth_rate_limited)`。新增 `verifying` 状态。 |
| `EmbedUserInfo` | 新增 `profile` 字段，承载 verify 返回的 `UserVO`。 |

业务侧零改动：
- `lib/request.ts` 仍读取 `getEmbedToken()` 注入 Bearer，**值已自动变成 accessToken**。
- 401 重放队列（`auth-queue` + FR-2.3）仍生效：accessToken 过期 → 通知父页 → 父页下发新渠道 JWT → 子页再次 verify → 队列释放重放。

## 3. 关键实现细节

- **`expiresIn` 解释**：文档明确为「过期时刻的毫秒时间戳」，非剩余时长。`tobAuth.ts` 兼容容错——`expiresIn > 1e12` 视为绝对时间戳，否则当作相对毫秒兜底。
- **HttpOnly Cookie**：成功响应的 `Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=None`。verify 客户端开启 `withCredentials: true` 让浏览器持久化该 cookie，便于后续走 `POST /api/auth/refresh`（**本期未实现，仅留通道**）。
- **避免循环**：verify 不复用 `lib/request.ts` —— 那个实例的 401 拦截器会再次触发 `requestEmbedAuthRefresh()`，与登录场景冲突。
- **mock 路径**：`NEXT_PUBLIC_TOB_USE_MOCK=1` 时跳过真实接口，直接把渠道 JWT 当 accessToken 透传，30 分钟过期；用于 `mock-parent.html` 联调。
- **错误码到 protocol 的映射**：
  - `401` → `auth-required(invalid)`；
  - `429` → `error(tob_auth_rate_limited)` + `auth-required(invalid)`；
  - 网络/5xx → `auth-required(invalid)`，子页 `status='error'`、`error` 字段带原因。

## 4. 与既有文档的兼容点

`EmbedContext` 之前注释写过「v1.1：不调 `/auth/verify`」，本期协议升级后该注释已替换为新流程说明。FR-2 重放队列、sessionStorage 存取、`?token=` dev-only 兜底等其它机制保持不变。

## 5. 联调步骤（本地）

1. `.env.local`：
   ```
   NEXT_PUBLIC_TOB_USE_MOCK=0
   NEXT_PUBLIC_TOB_API_BASE_URL=https://<your-tob-host>
   NEXT_PUBLIC_EMBED_ALLOWED_PARENT_ORIGINS=http://localhost:3001
   ```
2. 父页通过 `mock-parent.html` 或自家集成代码 postMessage：
   ```js
   iframe.contentWindow.postMessage(
     { type: "embed:auth", v: 1, token: "<channel-jwt>", userCode: "u1", channel: "site1" },
     "<iframe-origin>"
   );
   ```
3. 浏览器 Network 应看到一次 `GET /api/tob/auth/verify`，请求头 `Authorization: Bearer <channel-jwt>`，响应 `Set-Cookie: refreshToken=...`。
4. 后续业务请求的 `Authorization` 应已切换为 `<accessToken>`（与渠道 JWT 不同）。
5. 把渠道 JWT 设置为已过期 → 业务请求 401 → 子页发 `auth-required(expired)` → 父页通过 `embed:token-refresh` 重新下发新渠道 JWT → 子页再次 verify → 业务请求重放成功。

## 6. 后续 TODO（本期未做）

- `POST /api/auth/refresh`：cookie-based 自助续期。当前仍走「父页重发渠道 JWT」的路径；若后端确认前端可以走 refresh，则在 `tobAuth.ts` 增加 `refreshAccessToken()`，并在 401 拦截器先尝试它，失败再回退父页 re-auth。
- 缓存 verify 结果：当前每次父页 `auth` / `token-refresh` 都会真实调一次 verify。后端已对相同 token 做 Redis 缓存，前端目前没有再加一层缓存的必要；如果父页频繁重发同一 JWT，可在子页加 `lastVerifiedJwt` 短路。
- 用户信息消费点：verify 成功后 `EmbedUserInfo.profile` 已有 `walletAddress` 等数据，但当前业务侧仍走 `useAuthStore`（占位实现）。后续如需打通，可在 `EmbedContext` 同时刷新 authStore。
