"use client";

/**
 * EmbedModal 内部工具：生成嵌入代码 / 高亮代码片段 / 图表 Tooltip。
 * 从 EmbedModal.tsx 拆出，纯机械搬运（不改语义）。
 */

import React from "react";

// ---------------------------------------------------------------- generateEmbedCode

export interface EmbedCodeOpts {
  marketUrl: string;
  marketSlug: string;
  embedSrc: string;
  title: string;
  yesPrice: number | string;
  noPrice: number;
  siteOrigin: string;
  width: number;
  height: number;
}

/** 生成嵌入用 HTML 代码块（含 schema.org JSON-LD + figure + iframe）。 */
export function generateEmbedCode(opts: EmbedCodeOpts): string {
  const {
    marketUrl,
    marketSlug,
    embedSrc,
    title,
    yesPrice,
    noPrice,
    siteOrigin,
    width,
    height,
  } = opts;
  const safeTitle = title.replace(/"/g, '\\"');
  return `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "${safeTitle}",
  "description": "Prediction market: Yes ${yesPrice}%${noPrice ? ` · No ${noPrice}%` : ""} on YesONo.",
  "url": "${marketUrl}",
  "publisher": {
    "@type": "Organization",
    "name": "YesONo",
    "url": "${siteOrigin}"
  }
}
</script>
<figure
    class="yesono-embed"
    id="yesono-${marketSlug}"
    aria-label="YesONo prediction market: ${safeTitle}"
    itemscope
    itemtype="https://schema.org/WebPage"
    style="position:relative;display:inline-block;margin:0">
    <iframe
        title="${safeTitle} — YesONo Prediction Market"
        src="${embedSrc}"
        width="${width}"
        height="${height}"
        frameborder="0"
        style="border-radius:16px;overflow:hidden"
        allowtransparency="true">
    </iframe>
    <a href="${marketUrl}"
        aria-label="View on YesONo"
        target="_blank"
        rel="noopener noreferrer"
        style="position:absolute;top:16px;right:20px;width:120px;height:24px;z-index:10">
    </a>
    <figcaption style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">
        <strong>${title}</strong><br>
        Yes ${yesPrice}%${noPrice ? ` · No ${noPrice}%` : ""}<br>
        <a href="${marketUrl}">
            View full market &amp; trade on YesONo
        </a>
    </figcaption>
</figure>`;
}

// ---------------------------------------------------------------- renderHighlightedCodeLine

/** 简易语法高亮渲染一行 HTML 代码片段。 */
export function renderHighlightedCodeLine(
  line: string,
  lineIndex: number
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const tokenRegex = /(<\/?\w+|[\w-]+=|"[^"]*"|'[^']*')/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <span key={`${lineIndex}-text-${lastIndex}`}>
          {line.slice(lastIndex, match.index)}
        </span>
      );
    }

    const token = match[0];
    let className = "text-[#c9d1d9]";

    if (/^<\/?\w+$/.test(token)) {
      className = "text-[#ff7b72]";
    } else if (/^[\w-]+=$/.test(token)) {
      className = "text-[#79c0ff]";
    } else if (/^["'].*["']$/.test(token)) {
      className = "text-[#a5d6ff]";
    }

    nodes.push(
      <span
        key={`${lineIndex}-token-${match.index}`}
        className={className}
      >
        {token}
      </span>
    );

    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) {
    nodes.push(
      <span key={`${lineIndex}-text-${lastIndex}`}>{line.slice(lastIndex)}</span>
    );
  }

  return nodes;
}

// ---------------------------------------------------------------- CustomTooltip

interface TooltipLineConfig {
  id: string | number;
  color: string;
  label: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: any;
  lines: TooltipLineConfig[];
  darkMode: boolean;
}

/** Recharts 自定义 Tooltip。darkMode + lines 通过 props 传入，避免组件内闭包重定义（§2.1）。 */
export const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  lines,
  darkMode,
}) => {
  if (!active || !payload || !payload.length) return null;

  const dateStr = label
    ? new Date(label).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      className={`p-2 border rounded-lg shadow-lg text-xs min-w-[120px] ${
        darkMode
          ? "bg-[#1a1f2e] border-gray-700 text-gray-200"
          : "bg-white border-gray-200 text-gray-800"
      }`}
    >
      {dateStr && (
        <div className="mb-2 pb-1 border-b border-gray-500/30 text-gray-500">
          {dateStr}
        </div>
      )}
      {payload.map((entry: any, index: number) => {
        const lineConfig = lines.find((l) => l.id === entry.dataKey);
        const title = lineConfig?.label || entry.dataKey;
        const color = lineConfig?.color || entry.color;
        const val =
          entry.value !== undefined && entry.value !== null
            ? Math.round(Number(entry.value))
            : "-";
        return (
          <div
            key={`item-${index}`}
            className="flex items-center justify-between gap-4 py-0.5"
          >
            <div className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="font-medium truncate max-w-[80px]">{title}</span>
            </div>
            <span className="font-bold">{val}%</span>
          </div>
        );
      })}
    </div>
  );
};
