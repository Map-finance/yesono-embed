/**
 * TOB 鉴权登录服务
 *
 * 对应后端 `LoginController#verifyTobAuth`：`GET /api/tob/auth/verify`
 *
 * 输入：渠道侧（父页）签发的 JWT
 * 输出：本系统 accessToken（后续业务接口的 Bearer）
 *
 * 说明：
 * - 不通过 lib/request.ts，避免触发其 401 拦截/续期循环（verify 本身就是登录）。
 * - **不开 withCredentials**：embed 是跨源 iframe，第三方 Cookie 被现代浏览器默认拦截
 *   （Chrome 3PC / Safari ITP），refreshToken httpOnly cookie 在 embed 场景几乎一定写不进来。
 *   且后端 CORS 允许通配 `Access-Control-Allow-Origin: *`，与 credentials 不兼容。
 *   embed 的刷新流程靠 父页 `embed:token-refresh` 重新下发渠道 JWT 再 verify，不依赖 cookie。
 * - mock 模式下原样把渠道 JWT 当 accessToken 透传，便于本地联调。
 */

import axios, { AxiosError } from "axios";

export interface TobAuthUser {
  userId?: string;
  username?: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  walletAddress?: string;
  smartAccountAddress?: string;
  [k: string]: unknown;
}

export interface TobAuthResult {
  accessToken: string;
  /** 过期时刻（epoch ms）。文档明确 `expiresIn` 是毫秒时间戳，不是相对秒数。 */
  expiresAt: number;
  user: TobAuthUser | null;
  isNewUser: boolean;
}

export class TobAuthError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly retriable = false
  ) {
    super(message);
    this.name = "TobAuthError";
  }
}

const DEFAULT_BASE_URL =
  (typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_TOB_API_BASE_URL) ||
  "";

const USE_MOCK =
  typeof process !== "undefined" &&
  process.env.NEXT_PUBLIC_TOB_USE_MOCK === "1";

const verifyClient = axios.create({
  timeout: 10_000,
  // 不带 cookie：见文件顶部注释
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

interface RawResp {
  code?: number;
  success?: boolean;
  msg?: string;
  message?: string;
  data?: {
    success?: boolean;
    token?: {
      accessToken?: string;
      refreshToken?: string | null;
      tokenType?: string;
      expiresIn?: number;
      refreshExpiresIn?: number;
    };
    user?: TobAuthUser | null;
    isNewUser?: boolean;
    message?: string;
  };
}

/**
 * 调用 `/api/tob/auth/verify` 完成 TOB 登录。
 * @param channelToken 父页通过 postMessage 下发的渠道 JWT（不含 "Bearer " 前缀）
 * @param baseUrl 可选覆盖；默认读取 NEXT_PUBLIC_TOB_API_BASE_URL
 */
export async function verifyTobAuth(
  channelToken: string,
  baseUrl: string = DEFAULT_BASE_URL
): Promise<TobAuthResult> {
  if (!channelToken) {
    throw new TobAuthError(401, "Missing channel token");
  }

  // mock：跳过真实接口，便于 mock-parent.html 联调
  if (USE_MOCK) {
    return {
      accessToken: channelToken,
      expiresAt: Date.now() + 30 * 60 * 1000,
      user: null,
      isNewUser: false,
    };
  }

  const url = `${baseUrl.replace(/\/$/, "")}/api/tob/auth/verify`;

  let resp: RawResp;
  try {
    const r = await verifyClient.get<RawResp>(url, {
      headers: { Authorization: `Bearer ${channelToken}` },
    });
    resp = r.data;
  } catch (err) {
    const e = err as AxiosError<RawResp>;
    const status = e.response?.status ?? 0;
    const body = e.response?.data;
    const msg =
      body?.msg || body?.message || e.message || "Network error during verify";
    // 429 视作可重试（后端限流），其它默认不可重试
    throw new TobAuthError(body?.code ?? status ?? 500, msg, status === 429);
  }

  if (!resp || resp.code !== 200 || !resp.data?.token?.accessToken) {
    const code = resp?.code ?? 500;
    const msg = resp?.msg || resp?.message || "Verify response invalid";
    throw new TobAuthError(code, msg, code === 429);
  }

  const tk = resp.data.token!;
  return {
    accessToken: tk.accessToken!,
    // 文档：expiresIn 是 access 过期"时刻"的毫秒时间戳；兜底当成相对毫秒
    expiresAt:
      typeof tk.expiresIn === "number"
        ? tk.expiresIn > 1e12
          ? tk.expiresIn
          : Date.now() + tk.expiresIn
        : 0,
    user: resp.data.user ?? null,
    isNewUser: !!resp.data.isNewUser,
  };
}
