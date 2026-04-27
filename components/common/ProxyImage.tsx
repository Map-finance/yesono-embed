/**
 * ProxyImage - 带“图片代理 + 失败回退”的通用图片组件
 *
 * 为什么需要它：
 * - 你们在 Cloudflare Pages 上跑 Next.js。
 * - 直接用第三方外链图片可能会慢、抖、或被对方限制（尤其跨区域）。
 * - 我们已经做了 `https://yesono.trade/i?url=...` 的图片代理 Worker，
 *   让图片走 Cloudflare 边缘缓存加速。
 *
 * 但现实中仍会出现“部分图片不显示”的情况，常见原因：
 * 1) 第三方源站某个对象不存在/未公开（S3 404/403）
 * 2) 源站偶发超时
 * 3) 上游源站拒绝访问或返回错误
 *
 * 为了让页面尽可能“有图可看”，本组件策略是：
 * - 优先加载：代理后的 URL（走 Cloudflare CDN）
 * - 如果代理加载失败：自动回退加载原始第三方 URL（前提是第三方允许直连）
 *
 * 这样即使代理端某张图失败，也不会直接出现大片空白。
 */

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getProxiedImageUrl } from "@/lib/utils/imageProxy";

export interface ProxyImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  /**
   * 中文注释：原始图片地址（第三方外链 / 相对路径 / data: 等都可以）
   */
  src: string;

  /**
   * 中文注释：当代理与原图都加载失败时，显示的兜底图片（可选）。
   * - 例如你们已有的 data:image/svg+xml;base64... 占位图
   */
  fallbackSrc?: string;

  /**
   * 中文注释：加载失败时是否完全隐藏图片（不渲染破图占位）。
   * - 默认行为：未提供 fallbackSrc 时，加载失败会自动隐藏
   * - 显式传 false：强制保留破图占位（罕见）
   * - 优先级低于 fallbackSrc：若同时提供，仍走 fallbackSrc
   */
  hideOnError?: boolean;
}

export default function ProxyImage({
  src,
  fallbackSrc,
  hideOnError,
  onError,
  referrerPolicy,
  loading,
  decoding,
  ...rest
}: ProxyImageProps) {
  // 中文注释：计算代理后的 URL（如果不需要/不允许代理，函数会返回原始 src）
  const proxied = useMemo(() => getProxiedImageUrl(src), [src]);

  const [currentSrc, setCurrentSrc] = useState<string>(proxied);
  const [hidden, setHidden] = useState(false);

  const original = src;

  // 当外部 src 变化时，同步重置当前显示源 + 隐藏状态
  useEffect(() => {
    setCurrentSrc(proxied);
    setHidden(false);
  }, [proxied]);

  if (hidden) return null;

  // 检查 src 是否为明显无效值（空字符串、undefined 字面量、null 字面量）
  if (!currentSrc || currentSrc === "undefined" || currentSrc === "null") {
    return null;
  }

  return (
    <img
      {...rest}
      src={currentSrc}
      loading={loading ?? "lazy"}
      decoding={decoding ?? "async"}
      referrerPolicy={referrerPolicy ?? "no-referrer"}
      onLoad={(e) => {
        // 检查图片实际尺寸：如果加载的是 1x1 像素或极小图（通常是占位图/默认图），隐藏
        const img = e.currentTarget;
        if (img.naturalWidth <= 1 || img.naturalHeight <= 1) {
          const shouldHide = hideOnError ?? !fallbackSrc;
          if (shouldHide) setHidden(true);
        }
      }}
      onError={(e) => {
        if (onError) onError(e);

        // 1) 代理 URL 失败 → 回退原图直连
        if (currentSrc === proxied && proxied !== original) {
          setCurrentSrc(original);
          return;
        }

        // 2) 原图也失败 → 若有 fallbackSrc 用兜底
        if (fallbackSrc && currentSrc !== fallbackSrc) {
          setCurrentSrc(fallbackSrc);
          return;
        }

        // 3) 没有 fallbackSrc 时默认隐藏（除非显式传 hideOnError={false}）
        const shouldHide = hideOnError ?? !fallbackSrc;
        if (shouldHide) {
          setHidden(true);
        }
      }}
    />
  );
}

