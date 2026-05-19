// Polymarket CLOB 代理：把前端对 clob.polymarket.com 的直连走服务端转发。
//
// 目的：
// - 避免浏览器直连暴露用户 IP / referer 给第三方
// - CSP connect-src 保持同源，不再给 polymarket.com 开口
// - 异常 / 改版时后端可兜底，用户不直接报错
//
// 安全约束：
// - endpoint 白名单，仅允许 book / prices-history
// - 参数名白名单 + 值字符集白名单（数字 / 字母 / 下划线 / 点 / 破折号）
// - 仅 GET，不放任何写方法
// - 上游响应只透传 body + content-type，其他 header 丢弃

type Endpoint = "book" | "prices-history";

const ALLOWED_ENDPOINTS = new Set<Endpoint>(["book", "prices-history"]);

const ENDPOINT_PARAMS: Record<Endpoint, Set<string>> = {
  "book": new Set(["token_id"]),
  "prices-history": new Set(["market", "startTs", "endTs", "fidelity", "interval"]),
};

// Polymarket 的参数都是数字 / 十六进制 / ASCII 标识符，不会有空格或特殊符号。
// 限死字符集就足以防注入到路径或 upstream 的查询。
const SAFE_VALUE = /^[A-Za-z0-9._-]+$/;

// upstream 超时，防止慢上游拖垮 worker
const UPSTREAM_TIMEOUT_MS = 8000;

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json",
      // 错误响应不缓存
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  let incoming: URL;
  try {
    incoming = new URL(req.url);
  } catch {
    return jsonError("Invalid URL", 400);
  }

  const endpoint = incoming.searchParams.get("endpoint");
  if (!endpoint || !ALLOWED_ENDPOINTS.has(endpoint as Endpoint)) {
    return jsonError("Invalid or unsupported endpoint", 400);
  }
  const typedEndpoint = endpoint as Endpoint;
  const allowedParams = ENDPOINT_PARAMS[typedEndpoint];

  const outgoing = new URLSearchParams();
  for (const [key, value] of incoming.searchParams) {
    if (key === "endpoint") continue;
    if (!allowedParams.has(key)) {
      return jsonError(`Unexpected query param: ${key}`, 400);
    }
    if (!SAFE_VALUE.test(value)) {
      return jsonError(`Invalid value for ${key}`, 400);
    }
    outgoing.set(key, value);
  }

  const upstreamUrl = `https://clob.polymarket.com/${typedEndpoint}?${outgoing.toString()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });
    const text = await upstream.text();
    if (!upstream.ok) {
      // 不透传上游错误详情，避免把 upstream 的内部信息泄给浏览器
      return jsonError("Upstream error", upstream.status);
    }
    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/json",
        // 短缓存 —— book 变得快所以只缓存几秒；prices-history 可稍长
        "Cache-Control":
          typedEndpoint === "book"
            ? "public, max-age=2, s-maxage=2"
            : "public, max-age=30, s-maxage=30",
      },
    });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      return jsonError("Upstream timeout", 504);
    }
    console.error("Polymarket proxy error:", (error as Error)?.message);
    return jsonError("Proxy error", 502);
  } finally {
    clearTimeout(timer);
  }
}
