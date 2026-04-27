const DEFAULT_IMAGE_PROXY_ALLOWED_HOSTS = [
  "c.qf318.com",
  "cdn.jsdelivr.net",
  "cryptologos.cc",
  "images.unsplash.com",
  "img.logo.dev",
  "picsum.photos",
  "polymarket-upload.s3.us-east-2.amazonaws.com",
  "robohash.org",
  "via.placeholder.com",
] as const;

function normalizeHostRule(rule: string): string | null {
  const normalized = rule.trim().toLowerCase();
  if (!normalized) return null;

  const withoutScheme = normalized.replace(/^https?:\/\//, "");
  const host = withoutScheme.split("/")[0]?.replace(/\.+$/, "") ?? "";
  return host || null;
}

export function parseAllowedImageHosts(
  rawValue?: string | null,
  extras: readonly string[] = [],
): string[] {
  const configured = (rawValue ?? "")
    .split(",")
    .map(normalizeHostRule)
    .filter((value): value is string => Boolean(value));

  const merged = [...DEFAULT_IMAGE_PROXY_ALLOWED_HOSTS, ...extras, ...configured];
  return Array.from(new Set(merged.map((value) => value.toLowerCase())));
}

export function isAllowedImageHost(hostname: string, allowedHosts: readonly string[]): boolean {
  const normalizedHostname = hostname.trim().toLowerCase();
  if (!normalizedHostname) return false;

  return allowedHosts.some((rule) => {
    if (rule.startsWith("*.")) {
      const suffix = rule.slice(1);
      return normalizedHostname.endsWith(suffix) && normalizedHostname.length > suffix.length - 1;
    }
    return normalizedHostname === rule;
  });
}

export { DEFAULT_IMAGE_PROXY_ALLOWED_HOSTS };
