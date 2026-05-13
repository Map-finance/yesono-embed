# TOB 鉴权并登录接口

本文档对应 `LoginController#verifyTobAuth`：`GET /api/tob/auth/verify`。

## 概述

使用渠道侧签发的 JWT（Bearer）校验身份后，按 JWT 中的 `userCode`、`siteCode` 完成 TOB 用户查找或自动注册，并签发本系统的访问令牌。成功时通过 **HttpOnly Cookie** 下发 `refreshToken`，响应 JSON 中的 `refreshToken` 会被清空。

## 基本信息

| 项 | 值 |
|----|-----|
| 方法 | `GET` |
| 路径 | `/api/tob/auth/verify` |
| Content-Type | 无请求体 |
| 鉴权 | 请求头 `Authorization: Bearer <token>`（必填，格式错误等同未携带） |

> 类上统一前缀为 `@RequestMapping("/api")`，与方法路径拼接为完整 URL。

## 请求头

| 名称 | 必填 | 说明 |
|------|------|------|
| `Authorization` | 是 | 必须为 `Bearer ` 前缀（大小写不敏感）+ JWT 字符串；否则返回 401。 |

## 渠道 JWT 要求

服务端对 JWT 做 **Base64URL** 解码（至少包含 `header.payload` 两段），从 **payload** JSON 中解析字段：

| 逻辑字段 | 可选 JSON 键（按优先级） | 说明 |
|----------|-------------------------|------|
| 用户编码 `userCode` | `userCode` → `user_code` → `sub` | 至少有一个非空 |
| 站点/渠道编码 `siteCode` | `siteCode` → `site_code` → `channel` | 至少有一个非空 |
| 过期时间 `exp` | `exp` | 必填；Unix **秒** 时间戳；当前时间 ≥ `exp` 视为过期 |

### 可选：上游校验

当配置 `tob.auth.verify.enable-upstream-check=true` 且 `tob.auth.verify.upstream-url` 非空时，服务会向该 URL 发起 `POST`，请求头携带相同 `Authorization`，请求体由实现决定（代码仅读响应 JSON 的 `code` 是否等于业务成功码 `200`）。超时时间由 `tob.auth.verify.timeout-ms` 控制（默认 3000 ms）。上游判定失败返回 401。

校验通过（或跳过上游）后，相同 token 的解析结果会按 `exp` 写入 Redis 缓存，减少重复解码与上游调用。

## 限流与登录失败

- 使用客户端 IP + 账号维度 `tob:{siteCode}:{userCode}` 做登录尝试防护（与常规登录共用 `LoginAttemptGuard`）。
- 若已被限流：HTTP 业务包装内 `code` 为 **429**，`msg` 为限流提示文案。
- 若 `tobLogin` 返回未授权（401）：会记录失败尝试，若因此触发限流则同样返回 **429**。

## 响应体结构

统一为 `R<LoginResponseDTO>`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | int | 业务码：`200` 成功；`401` 未授权；`429` 限流；其它见 `ResultCode` |
| `success` | boolean | `code == 200` 时为 `true` |
| `msg` | string | 提示信息 |
| `data` | object \| null | 成功时为 `LoginResponseDTO` |

### `LoginResponseDTO`（`data`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 业务成功标识 |
| `token` | object | 见下表 |
| `user` | object | 用户信息 `UserVO` |
| `isNewUser` | boolean | 是否本次为新注册用户 |
| `message` | string | 登录/注册文案 |

### `token`（`TokenResponseVO`）

| 字段 | 类型 | 说明 |
|------|------|------|
| `accessToken` | string | 本系统访问令牌 |
| `refreshToken` | string \| null | 成功写入 Cookie 后，响应体中会被置为 **null** |
| `tokenType` | string | 一般为 `Bearer` |
| `expiresIn` | long | 当前实现为 **access 过期时刻的毫秒时间戳**（非秒数） |
| `refreshExpiresIn` | long | 当前实现为 **refresh 过期时刻的毫秒时间戳** |

### `user`（`UserVO`）

`userId`、`username`、`displayName`、`email`、`avatarUrl`、`avatarGradient`、`bio`、`smartAccountAddress`、`walletAddress`、`joinedDate`、`profileViews` 等，以实际用户数据为准。

## Set-Cookie（成功时）

| 属性 | 值 |
|------|-----|
| 名称 | `refreshToken` |
| HttpOnly | `true` |
| Secure | `true` |
| SameSite | `None` |
| Path | `/` |
| Max-Age | 由 refresh 过期时间与当前时间差换算的秒数 |

后续刷新令牌可调用同模块 `POST /api/auth/refresh`，从 Cookie 读取 `refreshToken`。

## 常见错误码与含义

| `code` | 典型 `msg` / 场景 |
|--------|-------------------|
| 401 | `Missing or invalid Authorization header`：未带或不是 `Bearer` 格式 |
| 401 | `Invalid token payload`：无法解析 payload 或缺少 `userCode`/`siteCode`/`exp` |
| 401 | `Token expired`：`exp` 已过期 |
| 401 | `Token verification failed`：开启上游校验且上游未返回成功 |
| 401 | `Token cache unavailable`：登录成功但访问/刷新令牌写入 Redis 缓存失败 |
| 401 | 其它来自 `tobLogin` 的未授权类结果（如业务拒绝） |
| 429 | 登录尝试防护触发（文案由 `LoginAttemptGuard` 决定） |
| 500 | TOB 登录内部异常（如用户创建失败、Signer 未配置等） |

## 请求示例

```http
GET /api/tob/auth/verify HTTP/1.1
Host: <your-host>
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyQ29kZSI6InV4eCIsInNpdGVDb2RlIjoic2l0ZTEiLCJleHAiOjE5OTk5OTk5OTl9.xxx
```

## 成功响应示例（结构示意）

```json
{
  "code": 200,
  "success": true,
  "msg": "Login successful",
  "data": {
    "success": true,
    "token": {
      "accessToken": "<jwt>",
      "refreshToken": null,
      "tokenType": "Bearer",
      "expiresIn": 1735689600000,
      "refreshExpiresIn": 1736294400000
    },
    "user": { },
    "isNewUser": false,
    "message": "Login successful"
  }
}
```

同时响应头包含 `Set-Cookie: refreshToken=...`。

## 实现位置

- 控制器：`prediction-market-service-login/src/main/java/com/pd/login/controller/LoginController.java`（`verifyTobAuth` 及相关私有方法）
- 业务登录：`AuthService#tobLogin`
