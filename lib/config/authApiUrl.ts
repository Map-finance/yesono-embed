const AUTH_API_HOST = process.env.NEXT_PUBLIC_AUTH_API_URL || "";

export function getAuthApiHost(): string {
  return AUTH_API_HOST;
}

export function getAuthApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${AUTH_API_HOST}${normalizedPath}`;
}

export function getAuthApiV1Url(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return getAuthApiUrl(`/api${normalizedPath}`);
}