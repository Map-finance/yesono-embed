"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function IframeBridge() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.parent === window) return;

    const post = (type: string, payload?: Record<string, unknown>) => {
      try {
        window.parent.postMessage({ type, ...(payload || {}) }, "*");
      } catch (e) {
        console.warn("[embed] postMessage failed", e);
      }
    };

    post("yesono-embed:ready", { path: pathname });

    let lastHeight = 0;
    const sendHeight = () => {
      const h = Math.max(
        document.documentElement.scrollHeight,
        document.body?.scrollHeight ?? 0
      );
      if (h && Math.abs(h - lastHeight) > 4) {
        lastHeight = h;
        post("yesono-embed:resize", { height: h });
      }
    };

    sendHeight();
    const observer = new ResizeObserver(() => sendHeight());
    observer.observe(document.documentElement);
    if (document.body) observer.observe(document.body);

    return () => {
      observer.disconnect();
    };
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.parent === window) return;
    try {
      window.parent.postMessage(
        { type: "yesono-embed:navigate", path: pathname },
        "*"
      );
    } catch {
      // ignore
    }
  }, [pathname]);

  return null;
}
