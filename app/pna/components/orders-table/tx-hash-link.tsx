"use client";

import { Copy } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { getBasescanUrl } from "@/lib/config";

export function TxHashLink({ hash }: { hash?: string }) {
  const { t } = useTranslation();
  if (!hash) return <span className="text-xs text-(--text-secondary)">{t.pna.asian.none}</span>;
  const short = `${hash.slice(0, 8)}…${hash.slice(-6)}`;
  return (
    <div className="flex items-center gap-1">
      <a
        href={hash.startsWith("0x") ? getBasescanUrl.transaction(hash) : "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-mono text-(--accent) hover:underline"
        title={hash}
        onClick={(e) => e.stopPropagation()}
      >
        {short}
      </a>
      <button
        type="button"
        className="text-(--text-secondary) hover:text-(--text-primary)"
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard?.writeText(hash);
        }}
        aria-label="Copy"
      >
        <Copy size={12} />
      </button>
    </div>
  );
}
