/**
 * Embed Bridge: 父子 postMessage 通信封装（FR-1）
 *
 * 设计要点：
 * - 与 React 解耦：纯 TS，便于单测
 * - origin 严格校验（FR-1.4）：参见 lib/embed/config.ts
 * - 信任 origin：首次收到合法消息后锁定 trustedParentOrigin，
 *   后续 postMessage 一律使用该 origin（不再使用 '*'，避免泄漏）
 * - ready 阶段：尚未确认 trustedParentOrigin 时，根据 document.referrer
 *   推断；若仍不在白名单内，回退到 '*'（ready 不含敏感数据）
 */

import {
  BaseMsg,
  ChildMessage,
  ChildMsgType,
  ChildMsgTypeValue,
  EMBED_PROTOCOL_VERSION,
  ParentMessage,
  ParentMsgTypeValue,
  isParentMsgType,
} from "./protocol";
import { isParentOriginAllowed } from "./config";

export type ParentMessageHandler = (
  msg: ParentMessage,
  meta: { origin: string; source: MessageEventSource | null }
) => void;

export interface BridgeOptions {
  /** 调试日志开关（默认 dev=true） */
  debug?: boolean;
  /** 收到非法 origin 时的回调（用于上报告警） */
  onRejected?: (info: {
    origin: string;
    reason: "origin" | "shape" | "type";
    raw: unknown;
  }) => void;
}

/** 让 Omit 在联合类型上分发（不会把判别字段塌成交集） */
type DistributiveOmit<T, K extends keyof any> = T extends unknown
  ? Omit<T, K>
  : never;

export type ChildMessageInput = DistributiveOmit<ChildMessage, "v" | "ts">;

export interface Bridge {
  /** 发送一条 child→parent 消息（无需填 v/ts，会自动注入） */
  send: (msg: ChildMessageInput) => void;
  /** 注册指定类型的处理器；返回解绑函数 */
  on: (type: ParentMsgTypeValue, handler: ParentMessageHandler) => () => void;
  /** 注册任意类型处理器 */
  onAny: (handler: ParentMessageHandler) => () => void;
  /** 当前已锁定的父页 origin（首次合法消息后非空） */
  getTrustedOrigin: () => string | null;
  /** 是否运行在 iframe 中 */
  isEmbedded: () => boolean;
  /** 销毁监听 */
  dispose: () => void;
}

function inferReferrerOrigin(): string | null {
  if (typeof document === "undefined") return null;
  const ref = document.referrer;
  if (!ref) return null;
  try {
    const u = new URL(ref);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

export function createBridge(options: BridgeOptions = {}): Bridge {
  const debug =
    options.debug ?? process.env.NODE_ENV !== "production";
  const log = (...a: unknown[]) =>
    debug && console.debug("[embed-bridge]", ...a);

  let trustedParentOrigin: string | null = null;
  const handlers = new Map<ParentMsgTypeValue, Set<ParentMessageHandler>>();
  const anyHandlers = new Set<ParentMessageHandler>();

  const isEmbedded = () =>
    typeof window !== "undefined" && window.parent !== window;

  const targetOriginForSend = (): string => {
    if (trustedParentOrigin) return trustedParentOrigin;
    // ready 之前：根据 referrer 推断；若 referrer 在白名单内可直接使用
    const ref = inferReferrerOrigin();
    if (ref && isParentOriginAllowed(ref)) return ref;
    // 否则只能 '*'（仅 ready 阶段，无敏感数据）
    return "*";
  };

  const send: Bridge["send"] = (msg) => {
    if (typeof window === "undefined") return;
    if (!isEmbedded()) {
      log("not in iframe; skip send", msg);
      return;
    }
    const payload = {
      ...(msg as Record<string, unknown>),
      v: EMBED_PROTOCOL_VERSION,
      ts: Date.now(),
    } as ChildMessage;
    const target = targetOriginForSend();
    try {
      window.parent.postMessage(payload, target);
      log("→ parent", target, payload);
    } catch (e) {
      console.warn("[embed-bridge] postMessage failed", e);
    }
  };

  const onMessage = (ev: MessageEvent) => {
    // 1. 形状校验
    const data = ev.data;
    if (!data || typeof data !== "object") return;
    const type = (data as { type?: unknown }).type;
    if (!isParentMsgType(type)) return;

    // 2. origin 校验（FR-1.4）
    if (!isParentOriginAllowed(ev.origin)) {
      console.warn(
        "[embed-bridge] rejected message from origin:",
        ev.origin,
        type
      );
      options.onRejected?.({ origin: ev.origin, reason: "origin", raw: data });
      return;
    }

    // 3. source 校验：必须来自 window.parent，避免内嵌 iframe 伪造
    if (ev.source !== window.parent) {
      log("rejected: source !== window.parent");
      options.onRejected?.({ origin: ev.origin, reason: "shape", raw: data });
      return;
    }

    // 4. 协议版本（向后兼容：未来 v>1 时可在此协商）
    const version = (data as BaseMsg).v;
    if (typeof version === "number" && version > EMBED_PROTOCOL_VERSION) {
      log("higher protocol version received:", version);
      // 不拒绝，尝试按当前 schema 处理（fail-open 仅限版本号）
    }

    // 5. 锁定 trusted origin（一旦确认就不再变更）
    if (!trustedParentOrigin) {
      trustedParentOrigin = ev.origin;
      log("trusted parent origin locked:", trustedParentOrigin);
    } else if (trustedParentOrigin !== ev.origin) {
      console.warn(
        "[embed-bridge] origin mismatch after lock; rejecting",
        ev.origin
      );
      return;
    }

    log("← parent", ev.origin, data);
    const meta = { origin: ev.origin, source: ev.source };
    const msg = data as ParentMessage;

    anyHandlers.forEach((h) => {
      try {
        h(msg, meta);
      } catch (e) {
        console.error("[embed-bridge] handler threw", e);
      }
    });
    const set = handlers.get(type);
    if (set) {
      set.forEach((h) => {
        try {
          h(msg, meta);
        } catch (e) {
          console.error("[embed-bridge] handler threw", e);
        }
      });
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("message", onMessage);
  }

  const on: Bridge["on"] = (type, handler) => {
    let set = handlers.get(type);
    if (!set) {
      set = new Set();
      handlers.set(type, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
    };
  };

  const onAny: Bridge["onAny"] = (handler) => {
    anyHandlers.add(handler);
    return () => anyHandlers.delete(handler);
  };

  const dispose = () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("message", onMessage);
    }
    handlers.clear();
    anyHandlers.clear();
  };

  return {
    send,
    on,
    onAny,
    getTrustedOrigin: () => trustedParentOrigin,
    isEmbedded,
    dispose,
  };
}

/** 便捷 helper：发送 child 消息（不强类型，给文档/测试用） */
export function buildChildMessage<K extends ChildMsgTypeValue>(
  type: K,
  payload: Record<string, unknown> = {}
): ChildMessage {
  return {
    v: EMBED_PROTOCOL_VERSION,
    ts: Date.now(),
    type,
    ...payload,
  } as ChildMessage;
}

export { ChildMsgType };
