/**
 * embedFetch —— 原生 fetch 的薄封装，让「不走 axios（lib/request.ts）」的服务
 * 也能享受 FR-2.3 的无感续期：
 *
 *   401 → 通知父页续期（requestEmbedAuthRefresh）→ 等父页回 token-refresh
 *        （authQueue.waitForRefresh，最多 15s）→ 用新 token 重建鉴权头重放一次
 *
 * 背景：homeService / aiService / authFetch 用的是原生 fetch，不经过 axios 的
 * 401 拦截器；token 过期时这些读接口只会静默返回空（列表变空但不报错）。
 * 接入这里后，它们与 axios 层共享同一条续期通道，自愈而无需用户重试。
 *
 * 注意：续期后 EmbedContext 里的 token 已更新，但调用方传入的 init.headers 仍是
 * 旧 token。所以重放前必须重建鉴权头 —— 通过 rebuildHeaders 回调重新解析。
 */

import { requestEmbedAuthRefresh } from "@/lib/embed/EmbedContext";
import { authQueue } from "@/lib/embed/auth-queue";

export interface EmbedFetchOptions extends RequestInit {
  /**
   * 401 重放前重建请求头的回调（须返回带「新」token 的 headers）。
   * 典型传入服务自己的 getCommonHeaders / getAIHeaders。
   * 不传则重放时沿用原 headers（仅适合无鉴权头或调用方自行处理的场景）。
   */
  rebuildHeaders?: () => Promise<HeadersInit> | HeadersInit;
}

export async function embedFetch(
  input: string,
  options: EmbedFetchOptions = {}
): Promise<Response> {
  const { rebuildHeaders, ...init } = options;

  const resp = await fetch(input, init);
  if (resp.status !== 401) return resp;

  // SSR：服务端没有父页可续期，waitForRefresh 会白等 15s 才超时；直接返回原 401
  if (typeof window === "undefined") return resp;

  // 401：通知父页续期并等待新 token（去重由 authQueue.markRequesting 控制）
  try {
    requestEmbedAuthRefresh("expired");
    await authQueue.waitForRefresh();
  } catch {
    // 续期超时 / 父页未响应 → 返回原 401，让调用方按未授权处理
    return resp;
  }

  // 用新 token 重建鉴权头后重放一次
  const headers = rebuildHeaders ? await rebuildHeaders() : init.headers;
  return fetch(input, { ...init, headers });
}
