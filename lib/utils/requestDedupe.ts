/**
 * 请求 in-flight 去重(不缓存,保证实时)。
 *
 * 背景:categories / tag 这类"所有组件共享"的接口,之前裸 fetch 无去重 —— 每个组件挂载、
 * 每次切 tab、dev StrictMode 双发,都各打一份,造成几十个重复请求的风暴。
 *
 * 这里只做"并发同 key 共享同一个在途 Promise":把同一时刻并发的相同请求坍缩成一个真实请求,
 * 在途请求一旦完成(或失败)即从表中移除,下次调用会重新发起 —— 不缓存结果,数据始终最新。
 */
const inflight = new Map<string, Promise<unknown>>();

export async function dedupe<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const p = (async () => {
    try {
      return await fetcher();
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}
