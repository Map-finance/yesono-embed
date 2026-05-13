/**
 * Embed iframe postMessage protocol (FR-1)
 *
 * 父子通信协议定义，单一来源（types + 常量）。
 *
 * 命名约定：所有消息使用 `embed:` 前缀。
 * 协议版本：v1（写在每条消息的 `v` 字段，便于未来兼容升级）。
 *
 * 关联：docs/tob_frontend.md §FR-1
 */

export const EMBED_PROTOCOL_VERSION = 1 as const;

export const ParentMsgType = {
  Auth: "embed:auth",
  TokenRefresh: "embed:token-refresh",
  LocaleChange: "embed:locale-change",
  ThemeChange: "embed:theme-change",
  Ping: "embed:ping",
} as const;

export const ChildMsgType = {
  Ready: "embed:ready",
  AuthRequired: "embed:auth-required",
  Resize: "embed:resize",
  Nav: "embed:nav",
  Metric: "embed:metric",
  Pong: "embed:pong",
  Error: "embed:error",
} as const;

export type ParentMsgTypeValue =
  (typeof ParentMsgType)[keyof typeof ParentMsgType];
export type ChildMsgTypeValue =
  (typeof ChildMsgType)[keyof typeof ChildMsgType];

/* ========== 父→子 ========== */

export interface AuthPayload {
  token: string;
  expiresAt?: number; // epoch ms
  userCode?: string;
  channel?: string;
  locale?: string;
  theme?: "light" | "dark";
}

export interface TokenRefreshPayload {
  token: string;
  expiresAt?: number;
}

export interface LocaleChangePayload {
  locale: string;
}

export interface ThemeChangePayload {
  theme: "light" | "dark";
}

export interface PingPayload {
  nonce: string;
}

export type ParentMessage =
  | (BaseMsg & { type: typeof ParentMsgType.Auth } & AuthPayload)
  | (BaseMsg & {
      type: typeof ParentMsgType.TokenRefresh;
    } & TokenRefreshPayload)
  | (BaseMsg & { type: typeof ParentMsgType.LocaleChange } & LocaleChangePayload)
  | (BaseMsg & { type: typeof ParentMsgType.ThemeChange } & ThemeChangePayload)
  | (BaseMsg & { type: typeof ParentMsgType.Ping } & PingPayload);

/* ========== 子→父 ========== */

export interface ReadyPayload {
  path?: string;
  href?: string;
  // 子页支持的最高协议版本，便于父页协商
  protocolVersion: number;
}

export type AuthRequiredReason = "expired" | "invalid" | "missing";

export interface AuthRequiredPayload {
  reason: AuthRequiredReason;
}

export interface ResizePayload {
  height: number;
}

export interface NavPayload {
  path: string;
}

export interface MetricPayload {
  event: string;
  payload?: Record<string, unknown>;
}

export interface PongPayload {
  nonce: string;
}

export interface ErrorPayload {
  code: string;
  message?: string;
}

export type ChildMessage =
  | (BaseMsg & { type: typeof ChildMsgType.Ready } & ReadyPayload)
  | (BaseMsg & { type: typeof ChildMsgType.AuthRequired } & AuthRequiredPayload)
  | (BaseMsg & { type: typeof ChildMsgType.Resize } & ResizePayload)
  | (BaseMsg & { type: typeof ChildMsgType.Nav } & NavPayload)
  | (BaseMsg & { type: typeof ChildMsgType.Metric } & MetricPayload)
  | (BaseMsg & { type: typeof ChildMsgType.Pong } & PongPayload)
  | (BaseMsg & { type: typeof ChildMsgType.Error } & ErrorPayload);

/* ========== 通用 ========== */

export interface BaseMsg {
  /** 协议版本 */
  v: number;
  /** 消息 id（子→父请求/响应配对，可选） */
  id?: string;
  /** 时间戳 */
  ts?: number;
}

export function isParentMsgType(t: unknown): t is ParentMsgTypeValue {
  return (
    typeof t === "string" &&
    (Object.values(ParentMsgType) as string[]).includes(t)
  );
}

export function isChildMsgType(t: unknown): t is ChildMsgTypeValue {
  return (
    typeof t === "string" &&
    (Object.values(ChildMsgType) as string[]).includes(t)
  );
}
