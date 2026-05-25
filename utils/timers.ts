/**
 * 原生 setTimeout 的延迟参数是 32 位有符号整数,超过 ~24.8 天(2^31-1 ms)会溢出
 * 并立即触发 —— 例如把"几个月后到期"的回调挂上去,会被当场执行。
 *
 * setLongTimeout 把超长延迟分段重排:每次最多挂 MAX_TIMEOUT,每段到期后按"绝对目标
 * 时刻"重新计算剩余时间再续期(避免分段累积漂移),直到真正到时才执行 callback。
 *
 * 返回一个 cancel 函数(语义同 clearTimeout),在 React effect 的 cleanup 里直接 return 即可:
 *   useEffect(() => setLongTimeout(fn, delayMs), [deps]);
 */
const MAX_TIMEOUT = 2147483647; // 2^31 - 1

export function setLongTimeout(
  callback: () => void,
  delayMs: number,
): () => void {
  const target = Date.now() + Math.max(0, delayMs);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const tick = () => {
    const remaining = target - Date.now();
    if (remaining <= 0) {
      callback();
      return;
    }
    timer = setTimeout(tick, Math.min(remaining, MAX_TIMEOUT));
  };

  tick();

  return () => {
    if (timer !== undefined) clearTimeout(timer);
  };
}
