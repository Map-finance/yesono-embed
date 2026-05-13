/**
 * Embed 配置：父页 origin 白名单 + locale/theme 白名单。
 *
 * 关联：docs/tob_frontend.md §FR-1.4 / FR-9 / FR-11
 */

/**
 * 从环境变量读取允许的父页 origin。
 * - 多个 origin 用空格或逗号分隔
 * - 例：`https://channel-a.example.com https://channel-b.example.com`
 * - 仅识别 https/http scheme + host[:port]，不允许 `*`（除 dev）
 */
function parseOriginsFromEnv(): string[] {
  const raw =
    (process.env.NEXT_PUBLIC_EMBED_ALLOWED_PARENT_ORIGINS ||
      // 兼容已有的 frame-ancestors 配置（仅当其值是具体 origin 时复用）
      process.env.NEXT_PUBLIC_EMBED_FRAME_ANCESTORS ||
      "") as string;

  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "*")
    .map((s) => {
      // 兼容用户填了带尾斜杠的写法
      try {
        const u = new URL(s);
        return `${u.protocol}//${u.host}`;
      } catch {
        return s;
      }
    });
}

export const ALLOWED_PARENT_ORIGINS: readonly string[] = parseOriginsFromEnv();

/** 是否处于开发模式（用于本地 mock 父页测试，放宽 origin） */
export const IS_DEV =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_APP_ENV === "development";

/**
 * 严格的 origin 校验。
 * - 若 ALLOWED_PARENT_ORIGINS 非空：仅放行白名单内的 origin
 * - 若为空且处于 dev：放行 same-origin / localhost / 127.0.0.1
 * - 若为空且生产：一律拒绝（fail-closed）
 */
export function isParentOriginAllowed(origin: string): boolean {
  if (!origin || origin === "null") {
    // file:// 或 sandbox iframe 的 origin 可能是 'null'。生产严格拒绝。
    return false;
  }

  if (ALLOWED_PARENT_ORIGINS.length > 0) {
    return ALLOWED_PARENT_ORIGINS.includes(origin);
  }

  if (IS_DEV) {
    try {
      const u = new URL(origin);
      const isLoopback =
        u.hostname === "localhost" ||
        u.hostname === "127.0.0.1" ||
        u.hostname === "0.0.0.0" ||
        u.hostname.endsWith(".localhost");
      const isSameOrigin =
        typeof window !== "undefined" && origin === window.location.origin;
      return isLoopback || isSameOrigin;
    } catch {
      return false;
    }
  }

  return false;
}

/** locale 白名单，避免父页注入未支持的值 */
export const ALLOWED_LOCALES = new Set<string>([
  "en",
  "zh",
  "zh-cn",
  "zh-tw",
  "ja",
  "ko",
  "es",
  "pt",
  "fr",
  "de",
  "it",
  "ru",
  "ar",
  "tr",
  "vi",
  "th",
  "id",
  "el",
]);

export function normalizeLocale(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const v = input.trim().toLowerCase();
  return ALLOWED_LOCALES.has(v) ? v : null;
}

export const ALLOWED_THEMES = new Set<string>(["light", "dark"]);

export function normalizeTheme(input: unknown): "light" | "dark" | null {
  if (typeof input !== "string") return null;
  const v = input.trim().toLowerCase();
  return v === "light" || v === "dark" ? v : null;
}
