"use client";

/**
 * EmbedContext: 嵌入态全局状态 + bridge 接入点（FR-1 / FR-2 最小实现）
 *
 * - 持有 bridge 单例（首次挂载时创建）
 * - token 存内存 + sessionStorage（FR-9.5）；不写 localStorage
 * - 接收父页 auth / token-refresh / locale-change / theme-change
 * - 暴露 useEmbed() / getEmbedToken() 给业务层与 axios 拦截器
 *
 * 兼容性：保持原有 useEmbed/getEmbedToken 导出签名，
 * 业务代码（lib/api.ts、lib/request.ts）无需改动。
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AuthPayload,
  AuthRequiredReason,
  ChildMsgType,
  ParentMessage,
  ParentMsgType,
} from "./protocol";
import { Bridge, createBridge } from "./bridge";
import { normalizeLocale, normalizeTheme } from "./config";

type Status = "idle" | "ready" | "authed" | "error";

export interface EmbedUserInfo {
  userCode?: string;
  channel?: string;
}

interface EmbedState {
  /** 当前 SSO token（内存） */
  token: string | null;
  /** token 过期时间（epoch ms） */
  expiresAt: number;
  /** 鉴权握手状态 */
  status: Status;
  /** 父页注入的用户信息 */
  user: EmbedUserInfo | null;
  /** 已锁定的父页 origin（首次合法消息后） */
  trustedOrigin: string | null;
  /** 主动写 token（debug / 单测用） */
  setToken: (token: string | null, expiresAt?: number) => void;
  /** 请求父页续期 */
  requestAuthRefresh: (reason?: AuthRequiredReason) => void;
  /** 上报埋点 */
  trackMetric: (event: string, payload?: Record<string, unknown>) => void;
  /** 直接发送 child 消息（高级用法） */
  bridge: Bridge | null;
}

const SS_KEY = "yesono.embed.token.v1";
const TOKEN_NEAR_EXPIRY_MS = 5 * 60 * 1000;
const TOKEN_CHECK_INTERVAL_MS = 60 * 1000;

const EmbedContext = createContext<EmbedState>({
  token: null,
  expiresAt: 0,
  status: "idle",
  user: null,
  trustedOrigin: null,
  setToken: () => {},
  requestAuthRefresh: () => {},
  trackMetric: () => {},
  bridge: null,
});

/* ---------- 跨模块访问点（axios 拦截器用） ---------- */

let externalTokenGetter: () => string | null = () => null;
let externalRefreshTrigger: (reason?: AuthRequiredReason) => void = () => {};

export function getEmbedToken(): string | null {
  return externalTokenGetter();
}

/** 401 时调用：通知父页续期 */
export function requestEmbedAuthRefresh(reason: AuthRequiredReason = "expired") {
  externalRefreshTrigger(reason);
}

/* ---------- session 存取（FR-9.5） ---------- */

function readSessionToken(): { token: string; expiresAt: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { token?: string; expiresAt?: number };
    if (!p.token) return null;
    if (p.expiresAt && p.expiresAt < Date.now()) return null;
    return { token: p.token, expiresAt: p.expiresAt ?? 0 };
  } catch {
    return null;
  }
}

function writeSessionToken(token: string | null, expiresAt: number) {
  if (typeof window === "undefined") return;
  try {
    if (!token) {
      window.sessionStorage.removeItem(SS_KEY);
    } else {
      window.sessionStorage.setItem(
        SS_KEY,
        JSON.stringify({ token, expiresAt })
      );
    }
  } catch {
    // sessionStorage 可能在某些场景被禁用；忽略
  }
}

/* ---------- Provider ---------- */

export function EmbedProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [status, setStatus] = useState<Status>("idle");
  const [user, setUser] = useState<EmbedUserInfo | null>(null);
  const [trustedOrigin, setTrustedOrigin] = useState<string | null>(null);

  const bridgeRef = useRef<Bridge | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);

  // 用 ref 镜像 token，避免闭包陈旧
  const tokenRef = useRef<string | null>(null);
  const expiresAtRef = useRef<number>(0);
  useEffect(() => {
    tokenRef.current = token;
    expiresAtRef.current = expiresAt;
    externalTokenGetter = () => tokenRef.current;
  }, [token, expiresAt]);

  const setToken = useCallback((t: string | null, exp = 0) => {
    setTokenState(t);
    setExpiresAt(exp);
    writeSessionToken(t, exp);
  }, []);

  const requestAuthRefresh = useCallback(
    (reason: AuthRequiredReason = "expired") => {
      const b = bridgeRef.current;
      if (!b) return;
      b.send({ type: ChildMsgType.AuthRequired, reason });
    },
    []
  );

  const trackMetric = useCallback(
    (event: string, payload?: Record<string, unknown>) => {
      const b = bridgeRef.current;
      if (!b) return;
      b.send({ type: ChildMsgType.Metric, event, payload });
    },
    []
  );

  // 暴露 refresh trigger 给非 React 模块
  useEffect(() => {
    externalRefreshTrigger = requestAuthRefresh;
  }, [requestAuthRefresh]);

  /* ---------- 1. 初始化 bridge + 恢复 sessionStorage ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 恢复 sessionStorage（页面刷新场景）
    const restored = readSessionToken();
    if (restored) {
      setTokenState(restored.token);
      setExpiresAt(restored.expiresAt);
    }

    const bridge = createBridge();
    bridgeRef.current = bridge;
    setBridgeReady(true);

    /* 父→子：auth */
    bridge.on(ParentMsgType.Auth, (msg) => {
      const m = msg as ParentMessage & AuthPayload;
      if (typeof m.token === "string" && m.token.length > 0) {
        setTokenState(m.token);
        const exp = typeof m.expiresAt === "number" ? m.expiresAt : 0;
        setExpiresAt(exp);
        writeSessionToken(m.token, exp);
      }
      setUser({
        userCode: m.userCode,
        channel: m.channel,
      });
      setStatus("authed");
      setTrustedOrigin(bridge.getTrustedOrigin());

      // 同步 locale / theme（白名单校验）
      const loc = normalizeLocale((m as AuthPayload).locale);
      if (loc) applyLocale(loc);
      const th = normalizeTheme((m as AuthPayload).theme);
      if (th) applyTheme(th);
    });

    /* 父→子：token-refresh */
    bridge.on(ParentMsgType.TokenRefresh, (msg) => {
      const m = msg as ParentMessage & {
        token: string;
        expiresAt?: number;
      };
      if (typeof m.token === "string" && m.token.length > 0) {
        const exp = typeof m.expiresAt === "number" ? m.expiresAt : 0;
        setTokenState(m.token);
        setExpiresAt(exp);
        writeSessionToken(m.token, exp);
      }
    });

    /* 父→子：locale-change */
    bridge.on(ParentMsgType.LocaleChange, (msg) => {
      const loc = normalizeLocale((msg as { locale?: unknown }).locale);
      if (loc) applyLocale(loc);
    });

    /* 父→子：theme-change */
    bridge.on(ParentMsgType.ThemeChange, (msg) => {
      const th = normalizeTheme((msg as { theme?: unknown }).theme);
      if (th) applyTheme(th);
    });

    /* 父→子：ping → 回 pong（健康检查） */
    bridge.on(ParentMsgType.Ping, (msg) => {
      bridge.send({
        type: ChildMsgType.Pong,
        nonce: (msg as { nonce?: string }).nonce ?? "",
      });
    });

    setStatus("ready");

    /* ---------- 2. token 临近过期主动续期（FR-2.4） ---------- */
    const timer = window.setInterval(() => {
      const exp = expiresAtRef.current;
      if (!exp) return;
      const left = exp - Date.now();
      if (left > 0 && left < TOKEN_NEAR_EXPIRY_MS) {
        bridge.send({ type: ChildMsgType.AuthRequired, reason: "expired" });
      }
    }, TOKEN_CHECK_INTERVAL_MS);

    /* ---------- 3. 卸载清理（FR-9.5） ---------- */
    const onUnload = () => {
      writeSessionToken(null, 0);
    };
    window.addEventListener("pagehide", onUnload);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("pagehide", onUnload);
      bridge.dispose();
      bridgeRef.current = null;
      setBridgeReady(false);
    };
  }, []);

  /* ---------- 4. 兼容旧路径：?token= 仅在 dev 启用 ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV === "production") return;
    const url = new URL(window.location.href);
    const queryToken = url.searchParams.get("token");
    if (queryToken && !tokenRef.current) {
      console.warn(
        "[embed] using ?token= from URL (dev only). Production should use postMessage."
      );
      setToken(queryToken);
    }
  }, [setToken]);

  const value = useMemo<EmbedState>(
    () => ({
      token,
      expiresAt,
      status,
      user,
      trustedOrigin,
      setToken,
      requestAuthRefresh,
      trackMetric,
      bridge: bridgeReady ? bridgeRef.current : null,
    }),
    [
      token,
      expiresAt,
      status,
      user,
      trustedOrigin,
      setToken,
      requestAuthRefresh,
      trackMetric,
      bridgeReady,
    ]
  );

  return <EmbedContext.Provider value={value}>{children}</EmbedContext.Provider>;
}

export function useEmbed() {
  return useContext(EmbedContext);
}

/* ---------- locale / theme apply ---------- */

function applyLocale(locale: string) {
  if (typeof document === "undefined") return;
  try {
    document.documentElement.lang = locale;
    document.cookie = `locale=${encodeURIComponent(locale)}; path=/; max-age=31536000; SameSite=Lax`;
    // 通知 I18nProvider；后者通过自定义事件订阅（向后兼容做法）
    window.dispatchEvent(
      new CustomEvent("yesono:embed-locale-change", { detail: { locale } })
    );
  } catch {
    /* ignore */
  }
}

function applyTheme(theme: "light" | "dark") {
  if (typeof document === "undefined") return;
  try {
    document.documentElement.dataset.theme = theme;
    document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    window.dispatchEvent(
      new CustomEvent("yesono:embed-theme-change", { detail: { theme } })
    );
  } catch {
    /* ignore */
  }
}
