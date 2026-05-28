"use client";

// 调试开关:URL 加 ?wsDebug=1 或 localStorage.setItem('wsDebug', '1') 打开
// 打开后会在 safeCloseWebSocket 的每个分支打 trace,定位"closed before established"来源
export const isWsDebug = (): boolean => {
  if (typeof window === "undefined") return false;
  try {
    if (window.location.search.includes("wsDebug=1")) return true;
    return window.localStorage?.getItem("wsDebug") === "1";
  } catch {
    return false;
  }
};

// 自增 WS 实例 id,用于关联同一 ws 在 console 里多条日志
let wsInstanceCounter = 0;
export const nextWsId = (tag: string): string => `${tag}#${++wsInstanceCounter}`;

/** 统一的 WS 生命周期日志,wsDebug 开关下才输出 */
export function wsLog(id: string, phase: string, extra?: any): void {
  if (!isWsDebug()) return;
  if (extra !== undefined) {
     
    console.log(`[ws ${id}] ${phase}`, extra);
  } else {
     
    console.log(`[ws ${id}] ${phase}`);
  }
}

/**
 * 安全关闭 WebSocket
 *
 * 浏览器在 `readyState === CONNECTING` 时直接 `close()` 会输出
 * "WebSocket is closed before the connection is established" 警告,
 * 且后续 `onopen` 永远不会触发 —— 这意味着挂在 onopen 里的订阅消息
 * 会永久丢失,客户端连上后却收不到数据。
 *
 * 本工具按 readyState 分支处理:
 *   - OPEN     → 直接 close
 *   - CONNECTING → 挂 onopen,等握手完成后再 close;同时把 onerror/onclose
 *                  接管,握手失败时无声释放(避免触发上层重连)
 *   - CLOSING / CLOSED → no-op
 *
 * 不再做 5s 兜底强 close —— 兜底本身就会触发警告(异常路径)。
 * 让浏览器自然超时(~30s)走 onerror/onclose,我们什么都不做。
 *
 * 调用前通常先把外部 `ws.onclose = null` 设掉,避免触发上层的自动重连;
 * 本函数内部也会再 null 一次以防误调用顺序。
 *
 * @param ws    被关闭的 WebSocket(允许 null/undefined)
 * @param code  关闭码,默认 1000(正常关闭)
 * @param reason 可选关闭原因
 */
export function safeCloseWebSocket(
  ws: WebSocket | null | undefined,
  code: number = 1000,
  reason?: string
): void {
  if (!ws) return;

  const readyState = ws.readyState;
  if (readyState === WebSocket.CLOSED || readyState === WebSocket.CLOSING) {
    if (isWsDebug()) {
      console.log("[safeCloseWs] no-op (already CLOSED/CLOSING)", { code, reason });
    }
    return;
  }

  if (readyState === WebSocket.OPEN) {
    if (isWsDebug()) {
      console.log("[safeCloseWs] close in OPEN — clean", { code, reason });
    }
    try {
      ws.close(code, reason);
    } catch {
      /* ignore */
    }
    return;
  }

  // CONNECTING:挂 onopen,握手完成后立刻 close。
  // 同时接管 onerror/onclose,握手失败时无声丢弃,不触发上层重连。
  if (isWsDebug()) {
    console.log("[safeCloseWs] hang on CONNECTING — will close on open or abort", {
      code,
      reason,
    });
     
    console.trace?.();
  }
  const origOnOpen = ws.onopen;
  ws.onopen = (ev) => {
    try {
      origOnOpen?.call(ws, ev);
    } catch {
      /* ignore */
    }
    try {
      ws.close(code, reason);
    } catch {
      /* ignore */
    }
  };
  // 握手失败 / 浏览器 abort:静默处理,不让上层重连链触发
  ws.onerror = null;
  ws.onclose = null;
  // 不再做 5s 兜底强 close;让浏览器自然超时(~30s)处理 CONNECTING 状态。
  // 强 close 在 CONNECTING 必然触发 "closed before connection established"
  // 警告,而这正是我们要消除的目标。
}

/**
 * 退避抖动:在指数退避 delay 上加 ±30% 抖动,避免多个客户端同时重连风暴。
 * 例如 baseDelay=3000ms → 实际 [2100, 3900] ms 区间随机一个值。
 */
export function jitterDelay(baseMs: number, ratio: number = 0.3): number {
  const min = 1 - ratio;
  const max = 1 + ratio;
  return Math.round(baseMs * (min + Math.random() * (max - min)));
}
