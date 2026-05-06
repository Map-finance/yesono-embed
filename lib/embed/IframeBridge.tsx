"use client";

/**
 * IframeBridge: 子页主动通知父页（ready / resize / nav / metric）
 *
 * 入站消息由 EmbedContext 处理。本组件只负责出站事件：
 * - 挂载时发 embed:ready（含 path / href / 协议版本）
 * - ResizeObserver 监听内容高度，节流后发 embed:resize
 * - 路由变化发 embed:nav
 *
 * 设计：复用 EmbedContext.bridge（避免重复创建）。
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useEmbed } from "./EmbedContext";
import { ChildMsgType, EMBED_PROTOCOL_VERSION } from "./protocol";

const RESIZE_MIN_DELTA_PX = 4;
const RESIZE_THROTTLE_MS = 100;

export default function IframeBridge() {
  const pathname = usePathname();
  const { bridge } = useEmbed();
  const lastHeightRef = useRef(0);
  const lastSentAtRef = useRef(0);
  const pendingTimerRef = useRef<number | null>(null);

  /* ---------- ready + resize ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!bridge || !bridge.isEmbedded()) return;

    bridge.send({
      type: ChildMsgType.Ready,
      path: pathname ?? undefined,
      href: window.location.href,
      protocolVersion: EMBED_PROTOCOL_VERSION,
    });

    const sendHeight = () => {
      const h = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0
      );
      if (!h) return;
      if (Math.abs(h - lastHeightRef.current) < RESIZE_MIN_DELTA_PX) return;

      const now = Date.now();
      const elapsed = now - lastSentAtRef.current;
      const fire = () => {
        lastHeightRef.current = h;
        lastSentAtRef.current = Date.now();
        bridge.send({ type: ChildMsgType.Resize, height: h });
      };

      if (elapsed >= RESIZE_THROTTLE_MS) {
        if (pendingTimerRef.current) {
          window.clearTimeout(pendingTimerRef.current);
          pendingTimerRef.current = null;
        }
        fire();
      } else if (!pendingTimerRef.current) {
        pendingTimerRef.current = window.setTimeout(() => {
          pendingTimerRef.current = null;
          fire();
        }, RESIZE_THROTTLE_MS - elapsed);
      }
    };

    sendHeight();
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.documentElement);
    if (document.body) observer.observe(document.body);

    return () => {
      observer.disconnect();
      if (pendingTimerRef.current) {
        window.clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
    // ready 消息只在 bridge 就绪后发一次；pathname 变化由下面单独 effect 通知
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge]);

  /* ---------- 路由变化 ---------- */
  useEffect(() => {
    if (!bridge || !bridge.isEmbedded()) return;
    bridge.send({ type: ChildMsgType.Nav, path: pathname ?? "" });
  }, [bridge, pathname]);

  return null;
}
