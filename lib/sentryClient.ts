// No-op telemetry stub. The embedded build does not ship Sentry — the host
// project is expected to instrument errors. We keep the same API surface so
// callers don't need to change.

export type User = {
  id: string;
  email?: string;
  username?: string;
  role?: string;
};

export type LoginMethod =
  | "email"
  | "google"
  | "twitter"
  | "github"
  | "discord"
  | "wallet"
  | "unknown";

const noop = () => {};
const asyncNoop = async () => {};

export const identify = noop;
export const clearUser = noop;
export const setTelemetryContext = noop as (next: Record<string, any>) => void;
export const clearTelemetryContext = noop as (keys?: string[]) => void;
export const setPendingLoginAttempt = noop as (data: any) => void;
export const getPendingLoginAttempt = (): any => null;
export const clearPendingLoginAttempt = noop;
export const startLoginSession = noop as (loginMethod: LoginMethod) => void;
export const getLoginSession = (): any => null;
export const clearLoginSession = noop;
export const inferLoginMethod = (): LoginMethod => "unknown";
export const maskAddress = (value?: string | null): string => value ?? "";
export const maskTxHash = (value?: string | null): string => value ?? "";
export const maskEmail = (value?: string | null): string => value ?? "";
export const addBreadcrumb = noop as (opts: {
  category?: string;
  message?: string;
  level?: string;
  data?: Record<string, any>;
}) => void;

export const trackEvent = noop as (
  name: string,
  payload?: Record<string, any>
) => void;

export function openLoginModalWithTrack(opts: {
  login: () => unknown;
  triggerAction: string;
  triggerPage?: string;
}): unknown {
  return opts.login();
}

export const captureException = noop as (
  err: unknown,
  ctx?: {
    tags?: Record<string, string>;
    extra?: Record<string, any>;
    level?: "fatal" | "error" | "warning" | "log" | "info" | "debug";
  }
) => void;

export const startUserActiveSpan = async <T>(
  _opts: any,
  callback: (span: any) => Promise<T> | T
): Promise<T> => {
  return callback(null);
};

const sentryClient = {
  identify,
  clearUser,
  setTelemetryContext,
  clearTelemetryContext,
  setPendingLoginAttempt,
  getPendingLoginAttempt,
  clearPendingLoginAttempt,
  startLoginSession,
  getLoginSession,
  clearLoginSession,
  inferLoginMethod,
  maskAddress,
  maskTxHash,
  maskEmail,
  addBreadcrumb,
  trackEvent,
  openLoginModalWithTrack,
  captureException,
};

export default sentryClient;
