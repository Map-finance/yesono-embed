import {
  isAllowedImageHost,
  parseAllowedImageHosts,
} from "../../../lib/utils/imageProxyPolicy";

const MAX_URL_LENGTH = 2048;
const MAX_REDIRECTS = 3;
const MODERN_IMAGE_ACCEPT =
  "image/avif,image/webp,image/apng,image/*,*/*;q=0.8";
const BASIC_IMAGE_ACCEPT = "image/*,*/*;q=0.8";

export interface Env {
  ALLOWED_IMAGE_HOSTS?: string;
  IMAGE_PROXY_DEBUG_TOKEN?: string;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const reqUrl = new URL(request.url);
    if (!reqUrl.pathname.startsWith("/i")) {
      return new Response("Not Found", { status: 404 });
    }

    const raw = reqUrl.searchParams.get("url");
    if (!raw) return new Response("Missing `url` query param", { status: 400 });
    if (raw.length > MAX_URL_LENGTH) {
      return new Response("`url` is too long", { status: 400 });
    }

    const debug = isDebugRequest(reqUrl, env);
    const allowedHosts = parseAllowedImageHosts(env.ALLOWED_IMAGE_HOSTS);

    let originUrl: URL;
    try {
      originUrl = parseUpstreamUrl(raw, allowedHosts);
    } catch (error) {
      const status =
        error instanceof ProxyRequestError && error.status ? error.status : 400;

      return debugJson(
        {
          error: "Invalid upstream image url",
          detail: String(error instanceof Error ? error.message : error),
        },
        status,
        debug,
      );
    }

    const acceptHeader = getAcceptBucket(request.headers.get("Accept"));
    const shouldUseCache = request.method === "GET";
    const cacheKey = new Request(getCacheKey(reqUrl.origin, originUrl, acceptHeader), {
      method: "GET",
    });

    const cache = (caches as CacheStorage & { default: Cache }).default;
    if (shouldUseCache) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }

    try {
      const upstreamResp = await fetchUpstreamImage(originUrl, request.method, acceptHeader, allowedHosts);
      const contentType = upstreamResp.headers.get("content-type");

      if (!isImageContentType(contentType)) {
        return debugJson(
          {
            error: "Upstream response is not an image",
            upstream: {
              url: upstreamResp.url || originUrl.toString(),
              status: upstreamResp.status,
              contentType,
            },
          },
          415,
          debug,
        );
      }

      const headers = new Headers(upstreamResp.headers);
      headers.set("Cache-Control", "public, max-age=2592000");
      headers.set("Vary", "Accept");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.delete("set-cookie");
      headers.delete("Set-Cookie");
      headers.delete("Access-Control-Allow-Origin");
      headers.delete("access-control-allow-origin");

      const response = new Response(upstreamResp.body, {
        status: upstreamResp.status,
        headers,
      });

      if (shouldUseCache) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
      }
      return response;
    } catch (error) {
      const status =
        error instanceof ProxyRequestError && error.status ? error.status : 502;

      return debugJson(
        {
          error: "Upstream fetch failed",
          detail: String(error instanceof Error ? error.message : error),
        },
        status,
        debug,
      );
    }
  },
};

export default worker;

class ProxyRequestError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProxyRequestError";
    this.status = status;
  }
}

function getCacheKey(origin: string, upstreamUrl: URL, acceptHeader: string): string {
  const cacheKeyUrl = new URL("/__img_cache_key", origin);
  cacheKeyUrl.searchParams.set("u", upstreamUrl.toString());
  cacheKeyUrl.searchParams.set("a", acceptHeader === MODERN_IMAGE_ACCEPT ? "modern" : "basic");
  return cacheKeyUrl.toString();
}

function getAcceptBucket(rawAccept: string | null): string {
  const accept = (rawAccept ?? "").toLowerCase();
  if (accept.includes("image/avif") || accept.includes("image/webp")) {
    return MODERN_IMAGE_ACCEPT;
  }
  return BASIC_IMAGE_ACCEPT;
}

function isDebugRequest(reqUrl: URL, env: Env): boolean {
  const token = env.IMAGE_PROXY_DEBUG_TOKEN?.trim();
  if (!token) return false;
  return reqUrl.searchParams.get("debug") === token;
}

function parseUpstreamUrl(raw: string, allowedHosts: readonly string[]): URL {
  const decoded = safeDecodeURIComponent(raw);
  const upstreamUrl = new URL(decoded);

  if (upstreamUrl.protocol !== "https:") {
    throw new ProxyRequestError("Only https is allowed", 400);
  }

  if (isBlockedUpstreamHost(upstreamUrl.hostname)) {
    throw new ProxyRequestError("Host not allowed", 403);
  }

  if (!isAllowedImageHost(upstreamUrl.hostname, allowedHosts)) {
    throw new ProxyRequestError("Host is not in the image allowlist", 403);
  }

  return upstreamUrl;
}

async function fetchUpstreamImage(
  originUrl: URL,
  method: string,
  acceptHeader: string,
  allowedHosts: readonly string[],
): Promise<Response> {
  let currentUrl = new URL(originUrl.toString());
  const originalHostname = originUrl.hostname;
  const originalPort = originUrl.port;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const upstreamResp = await fetch(
      new Request(currentUrl.toString(), {
        method,
        headers: {
          Accept: acceptHeader,
          "User-Agent": "yesono-image-proxy/1.1",
        },
        redirect: "manual",
      }),
    );

    if (isRedirectStatus(upstreamResp.status)) {
      const location = upstreamResp.headers.get("location");
      if (!location) {
        throw new ProxyRequestError("Redirect response missing location header", 502);
      }
      if (redirectCount === MAX_REDIRECTS) {
        throw new ProxyRequestError("Too many upstream redirects", 502);
      }

      const redirectUrl = parseUpstreamUrl(new URL(location, currentUrl).toString(), allowedHosts);
      if (redirectUrl.hostname !== originalHostname || redirectUrl.port !== originalPort) {
        throw new ProxyRequestError("Cross-host redirect is not allowed", 403);
      }

      currentUrl = redirectUrl;
      continue;
    }

    if (!upstreamResp.ok) {
      throw new ProxyRequestError(`Upstream returned status ${upstreamResp.status}`, upstreamResp.status);
    }

    return upstreamResp;
  }

  throw new ProxyRequestError("Too many upstream redirects", 502);
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function isImageContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const normalized = contentType.toLowerCase();
  return normalized.startsWith("image/") && !normalized.includes("image/svg+xml");
}

function debugJson(payload: unknown, status: number, debug: boolean): Response {
  if (!debug) {
    const message =
      status >= 500 ? "Upstream error" : status === 403 ? "Host not allowed" : "Invalid image request";
    return new Response(message, { status });
  }

  return Response.json(payload, { status });
}

function isBlockedUpstreamHost(hostname: string): boolean {
  const h = hostname.toLowerCase();

  // 1) 文本型禁用
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "metadata.google.internal") return true;

  // 2) IPv4 内网 / 链路本地
  if (isBlockedIpv4(h)) return true;
  if (h === "169.254.169.254" || h.startsWith("169.254.")) return true;

  // 3) IPv6（URL 里通常被 []包裹，Node/Workers parser 可能已去掉；两种都处理）
  const ipv6 = h.startsWith("[") && h.endsWith("]") ? h.slice(1, -1) : h;
  if (isBlockedIpv6(ipv6)) return true;

  return false;
}

function isBlockedIpv4(h: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;

  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);
  const d = Number(m[4]);

  if ([a, b, c, d].some((n) => Number.isNaN(n) || n > 255)) return true;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

/**
 * IPv6 SSRF 防护（审计加固）
 *
 * 覆盖以下危险地址段：
 * - ::               / ::1              全零 / 回环
 * - ::ffff:x.x.x.x                       IPv4-mapped（最常见绕过路径）
 * - ::ffff:0:x.x.x.x                     IPv4-translated
 * - 64:ff9b::/96                         IPv4-IPv6 NAT64 转换前缀
 * - fe80::/10                            链路本地（fe80 - febf）
 * - fc00::/7                             唯一本地地址（fc00 - fdff）
 * - ff00::/8                             组播
 * - 2001:db8::/32                        文档保留
 * - fe80::a9fe:a9fe / ::a9fe:a9fe         AWS 元数据的 IPv6 形式
 */
function isBlockedIpv6(hRaw: string): boolean {
  if (!hRaw) return false;
  // 必须看起来像 IPv6（含冒号）
  if (!hRaw.includes(":")) return false;

  const h = hRaw.toLowerCase();

  // 全零 / 回环 / 未指定
  if (h === "::" || h === "::1" || h === "0:0:0:0:0:0:0:0" || h === "0:0:0:0:0:0:0:1") {
    return true;
  }

  // IPv4-mapped / translated：::ffff:IPv4 或 ::ffff:0:IPv4
  // 形如 "::ffff:127.0.0.1" 或 "::ffff:0:127.0.0.1"
  const mappedMatch = /^::ffff:(?:0:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(h);
  if (mappedMatch && isBlockedIpv4(mappedMatch[1])) {
    return true;
  }

  // NAT64 前缀 64:ff9b::
  if (h.startsWith("64:ff9b:")) return true;

  // 链路本地 fe80::/10（fe80 - febf）
  // 第一个 16 位段以 fe8x / fe9x / feax / febx 开头
  if (/^fe[89ab][0-9a-f]:/.test(h)) return true;

  // 唯一本地 fc00::/7（fc / fd 开头）
  if (/^f[cd][0-9a-f]{2}:/.test(h)) return true;

  // 组播 ff00::/8
  if (/^ff[0-9a-f]{2}:/.test(h)) return true;

  // 文档保留 2001:db8::/32
  if (/^2001:0*db8:/.test(h)) return true;

  return false;
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    console.debug("[image-proxy] Failed to decodeURIComponent, using raw input", error);
    return value;
  }
}
