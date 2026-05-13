/**
 * 401 续期重试队列（FR-2.3）
 *
 * 场景：业务请求拿到 401 → 子页发 `embed:auth-required` 给父页 →
 *   等待 `embed:token-refresh` 到达后用新 token 重放原请求。
 *
 * 设计：
 *   - 单例（不依赖 React），request.ts 拦截器 与 EmbedContext 都能直接 import。
 *   - waitForRefresh() 返回 Promise；EmbedContext 收到 token-refresh 时 resolveAll。
 *   - 同一时段多个 401 共用同一次"等待"，避免风暴。
 *   - 超时（默认 15s）后 reject，调用方按普通 401 处理（向上抛）。
 */

const DEFAULT_TIMEOUT_MS = 15_000;

interface Waiter {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: number | NodeJS.Timeout;
}

class AuthQueue {
  private waiters: Set<Waiter> = new Set();
  private requesting = false;

  /** 由 request.ts 调用：等待父页发来新 token */
  waitForRefresh(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
    return new Promise((resolve, reject) => {
      const w: Waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters.delete(w);
          reject(new Error("auth refresh timeout"));
        }, timeoutMs) as unknown as number,
      };
      this.waiters.add(w);
    });
  }

  /** 标记"已发出 auth-required"，避免短时间内重复发 */
  markRequesting(): boolean {
    if (this.requesting) return false;
    this.requesting = true;
    return true;
  }

  /** EmbedContext 收到 token-refresh 时调用，唤醒所有等待者 */
  resolveAll(): void {
    this.requesting = false;
    const ws = Array.from(this.waiters);
    this.waiters.clear();
    ws.forEach((w) => {
      clearTimeout(w.timer as number);
      w.resolve();
    });
  }

  /** EmbedContext 在错误状态（如父页明确拒绝续期）时调用 */
  rejectAll(reason: string): void {
    this.requesting = false;
    const ws = Array.from(this.waiters);
    this.waiters.clear();
    ws.forEach((w) => {
      clearTimeout(w.timer as number);
      w.reject(new Error(reason));
    });
  }

  pendingCount(): number {
    return this.waiters.size;
  }
}

export const authQueue = new AuthQueue();
