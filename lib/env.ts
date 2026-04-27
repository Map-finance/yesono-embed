export type AppEnvironment = "development" | "production" | "test";

export function getAppEnvironment(): AppEnvironment {
  const rawEnv =
    process.env.NEXT_PUBLIC_APP_ENV ??
    process.env.APP_ENV ??
    process.env.NEXT_PUBLIC_NODE_ENV ??
    process.env.NODE_ENV ??
    "development";

  if (rawEnv === "production") return "production";
  if (rawEnv === "test") return "test";
  return "development";
}

export function isProductionAppEnv(): boolean {
  return getAppEnvironment() === "production";
}

// Local dev server (next dev) should not report telemetry.
export function isLocalDevelopmentRuntime(): boolean {
  return process.env.NODE_ENV === "development";
}
