import { isProduction } from "@/lib/config";
import { isAllowedImageHost, parseAllowedImageHosts } from "@/lib/utils/imageProxyPolicy";

function isImageProxyEnabled(): boolean {
  const forced = process.env.NEXT_PUBLIC_ENABLE_IMAGE_PROXY;
  if (forced === "true") return true;
  if (forced === "false") return false;
  return isProduction();
}

function getImageProxyBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_IMAGE_PROXY_BASE_URL?.trim();
  if (!configured) return "/i";
  return configured;
}

function getAllowedImageHosts(): string[] {
  return parseAllowedImageHosts(process.env.NEXT_PUBLIC_IMAGE_PROXY_ALLOWED_HOSTS);
}

function normalizeUrlForProxy(u: URL): URL | null {
  if (u.protocol === "https:") return u;
  if (u.protocol === "http:") {
    const upgraded = new URL(u.toString());
    upgraded.protocol = "https:";
    return upgraded;
  }
  return null;
}

export function extractOriginalImageUrl(input: string): string {
  if (!input) return input;

  try {
    const u = new URL(input);
    if (u.hostname !== "polymarket.com" || !u.pathname.startsWith("/_next/image")) {
      return input;
    }

    const raw = u.searchParams.get("url");
    if (!raw) return input;

    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith("http://") && !decoded.startsWith("https://")) {
      return input;
    }

    return decoded;
  } catch (e) {
    console.debug("[imageProxy] Failed to extract original image URL, using input as-is", e);
    return input;
  }
}

export function shouldProxyImageUrl(input: string): boolean {
  if (!input) return false;
  if (!isImageProxyEnabled()) return false;

  const original = extractOriginalImageUrl(input);

  let u: URL;
  try {
    u = new URL(original);
  } catch (e) {
    console.debug("[imageProxy] Failed to parse URL for proxying, using original input", e);
    return false;
  }

  const normalized = normalizeUrlForProxy(u);
  if (!normalized) return false;

  return isAllowedImageHost(normalized.hostname, getAllowedImageHosts());
}

export function getProxiedImageUrl(input: string): string {
  if (!shouldProxyImageUrl(input)) return input;

  const normalized = normalizeUrlForProxy(new URL(extractOriginalImageUrl(input)));
  if (!normalized) return input;

  const params = new URLSearchParams();
  params.set("url", normalized.toString());

  return `${getImageProxyBaseUrl()}?${params.toString()}`;
}
