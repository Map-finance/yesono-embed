/**
 * 带客户端超时的 fetch。
 *
 * 背景:列表类接口(events / crypto / tag)是裸 fetch、无超时,后端尾延迟时会挂到浏览器/网关
 * 超时(实测见过 46s / 504@60s),期间页面 loading 卡死。这里用 AbortController 在 timeoutMs
 * 后主动 abort —— 请求快速失败,调用方现有 try/catch 走空数据兜底,UI 立刻翻"无数据/重试",
 * 而不是干等几十秒。
 *
 * 注意:超时会覆盖 init.signal(这些调用方都不传 signal)。abort 后 fetch 抛 AbortError,
 * 由调用方 catch 处理。
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  // 合并调用方传入的 signal(如导航/卸载取消):任一触发都 abort 本次 fetch。
  const callerSignal = init.signal ?? undefined;
  const onCallerAbort = () => timeoutController.abort();
  if (callerSignal) {
    if (callerSignal.aborted) timeoutController.abort();
    else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
  }

  try {
    return await fetch(input, { ...init, signal: timeoutController.signal });
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}
