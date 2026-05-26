import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import {
  getEmbedToken,
  requestEmbedAuthRefresh,
} from "@/lib/embed/EmbedContext";
import { authQueue } from "@/lib/embed/auth-queue";
import { captureException } from "@/lib/sentryClient";

interface RequestConfig extends AxiosRequestConfig {
  showLoading?: boolean;
  showError?: boolean;
  retry?: number;
  retryDelay?: number;
}

interface ApiResponse<T = any> {
  code: number;
  message: string;
  msg?: string;
  data: T;
  success: boolean;
}

/**
 * 默认 60s 超时：UMA 市场创建会触发后端链上初始化，单请求耗时较长，10s 不够用。
 * 可通过 env `NEXT_PUBLIC_HTTP_TIMEOUT_MS` 覆盖。
 */
const DEFAULT_TIMEOUT_MS = (() => {
  const raw = process.env.NEXT_PUBLIC_HTTP_TIMEOUT_MS;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 60_000;
})();

const request: AxiosInstance = axios.create({
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

const WARNING_SAMPLE_RATE = 0.2;

type ApiErrorKind = "api_business_error" | "api_http_error" | "api_auth_error";
type ApiReportLevel = "drop" | "warning" | "error";

/**
 * 提取 URL pathname 并对敏感片段做归一化（审计 M-04）：
 *  - 0x 开头的钱包地址 → :addr
 *  - 长数字（≥6 位）→ :id
 *  - 长十六进制 / hash（≥32 字符）→ :hash
 * 防止 userId / marketId / 钱包地址等出现在 Cloudflare Logs 全量采样中。
 */
function getSafeUrl(rawUrl?: string): string {
  if (!rawUrl) return "unknown";
  let pathname: string;
  try {
    const base =
      typeof window !== "undefined" ? window.location.origin : "http://x";
    pathname = new URL(rawUrl, base).pathname;
  } catch {
    pathname = (rawUrl.split("?")[0] || "unknown").trim();
  }
  if (!pathname) return "unknown";
  return pathname
    .replace(/0x[a-fA-F0-9]{6,}/g, ":addr")
    .replace(/[a-f0-9-]{32,}/g, ":hash")
    .replace(/\b\d{6,}\b/g, ":id");
}

function captureApiException(
  err: unknown,
  params: {
    kind: ApiErrorKind;
    method?: string;
    url?: string;
    status?: number;
    backendCode?: number | string;
    backendMessage?: string;
  }
): void {
  const reportLevel = resolveApiReportLevel(params);
  if (reportLevel === "drop") {
    return;
  }

  if (reportLevel === "warning" && Math.random() > WARNING_SAMPLE_RATE) {
    return;
  }

  captureException(err, {
    tags: {
      telemetry_scope: "api_error",
      report_level: reportLevel,
      error_kind: params.kind,
      http_method: params.method || "unknown",
      api_path: getSafeUrl(params.url),
      http_status:
        params.status !== undefined ? String(params.status) : "unknown",
      backend_code:
        params.backendCode !== undefined
          ? String(params.backendCode)
          : "unknown",
    },
    extra: {
      backend_message: params.backendMessage,
    },
    level: reportLevel,
  });
}

function resolveApiReportLevel(params: {
  kind: ApiErrorKind;
  status?: number;
}): ApiReportLevel {
  const { kind, status } = params;

  if (kind === "api_auth_error") {
    return "drop";
  }

  if (status === 401 || status === 403 || status === 404 || status === 422) {
    return "drop";
  }

  if (status === 400 || status === 409 || status === 429) {
    return "warning";
  }

  if (kind === "api_business_error") {
    return "warning";
  }

  return "error";
}

request.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getEmbedToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.headers) {
      let currentLang = "en";
      if (typeof window !== "undefined") {
        try {
          currentLang = localStorage.getItem("locale") || "en";
        } catch {
          // ignore
        }
      }
      config.headers["Accept-Language"] = currentLang;
    }

    return config;
  },
  (error: AxiosError) => {
    console.error("Request Error:", error);
    return Promise.reject(error);
  }
);

request.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const { data } = response;
    const hasCodeField =
      data && Object.prototype.hasOwnProperty.call(data, "code");
    if (hasCodeField && data.code !== 200 && data.code !== 0) {
      // 业务码非 200 时优先 message,缺失则 msg(后端有的接口只填 msg,如限流响应)
      const error = new Error(data.message || data.msg || "Request failed");
      (error as any).code = data.code;
      (error as any).response = response;

      captureApiException(error, {
        kind: "api_business_error",
        method: response.config?.method?.toUpperCase(),
        url: response.config?.url,
        status: response.status,
        backendCode: data.code,
        backendMessage: data.message || data.msg,
      });

      return Promise.reject(error);
    }

    return response;
  },
  async (error: AxiosError) => {
    /* ---------- FR-2.3: 401 → 通知父页续期 → 拿到新 token 后重放 ---------- */
    if (
      error.response?.status === 401 &&
      error.config &&
      !(error.config as any).__embedAuthRetried
    ) {
      const cfg = error.config as InternalAxiosRequestConfig & {
        __embedAuthRetried?: boolean;
      };
      cfg.__embedAuthRetried = true;
      try {
        // 通知父页（去重由 authQueue.markRequesting 控制）
        requestEmbedAuthRefresh("expired");
        await authQueue.waitForRefresh();
        // 等待期间 EmbedContext 已写新 token；request 拦截器会自动注入新 Bearer
        return await request.request(cfg);
      } catch (e) {
        // 续期超时/失败 → 按原 401 抛出
        console.warn("[request] 401 retry failed:", e);
      }
    }

    if (error.response) {
      const { status, data } = error.response;

      captureApiException(error, {
        kind: "api_http_error",
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        status,
        backendCode: (data as any)?.code,
        backendMessage: (data as any)?.message || (data as any)?.msg,
      });
    } else if (error.request) {
      captureApiException(error, {
        kind: "api_http_error",
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
      });
    } else {
      captureApiException(error, {
        kind: "api_http_error",
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
      });
    }

    return Promise.reject(error);
  }
);

const retryRequest = async (
  config: RequestConfig,
  retryCount: number = 0
): Promise<any> => {
  const maxRetries = config.retry || 3;
  const retryDelay = config.retryDelay || 1000;

  try {
    return await request(config);
  } catch (error) {
    if (retryCount < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return retryRequest(config, retryCount + 1);
    }
    throw error;
  }
};

export const http = {
  get: <T = any>(url: string, config?: RequestConfig): Promise<ApiResponse<T>> => {
    return request.get(url, config);
  },

  post: <T = any>(
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> => {
    return request.post(url, data, config);
  },

  put: <T = any>(
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> => {
    return request.put(url, data, config);
  },

  delete: <T = any>(
    url: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> => {
    return request.delete(url, config);
  },

  patch: <T = any>(
    url: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> => {
    return request.patch(url, data, config);
  },

  retry: <T = any>(config: RequestConfig): Promise<ApiResponse<T>> => {
    return retryRequest(config);
  },

  upload: <T = any>(
    url: string,
    file: File,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> => {
    const formData = new FormData();
    formData.append("file", file);

    return request.post(url, formData, {
      ...config,
      headers: {
        "Content-Type": "multipart/form-data",
        ...config?.headers,
      },
    });
  },

  download: (
    url: string,
    filename?: string,
    config?: RequestConfig
  ): Promise<void> => {
    return request
      .get(url, {
        ...config,
        responseType: "blob",
      })
      .then((response) => {
        const blob = new Blob([response.data]);
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = filename || "download";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      });
  },
};

export { request as axios };
export type { RequestConfig, ApiResponse };
