"use client";

/**
 * 用户菜单：头像入口 + 三项下拉
 *  - 排行榜（链接）
 *  - 夜间模式（switch）
 *  - 语言（点开 → 内嵌语言选择列表）
 *
 * 不含登录/钱包/设置（嵌入项目用不到）。
 */

import { useState } from "react";
import Link from "next/link";
import { Briefcase, Check, Globe, Moon, Trophy } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/shadcn/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/shadcn/popover";
import { Switch } from "@/components/ui/shadcn/switch";
import { Separator } from "@/components/ui/shadcn/separator";
import { useLocale, useTranslation, type Locale } from "@/lib/i18n";
import { useTheme } from "@/lib/theme/useTheme";
import { useAuthStore } from "@/lib/stores/authStore";
import { cn } from "@/lib/utils";

const NATIVE_NAMES: Record<string, string> = {
  en: "English",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  ja: "日本語",
  vi: "Tiếng Việt",
  th: "ภาษาไทย",
  km: "ភាសាខ្មែរ",
};
// 与原项目一致：菜单中暴露的语言（其他 locale 仍可用 ?lang= 切换）
const LANG_LIST: Locale[] = ["zh-CN", "zh-TW", "ja", "vi", "th", "km", "en"];

export default function UserMenu() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const { isDark, switchTheme } = useTheme();
  const { user } = useAuthStore();

  const [view, setView] = useState<"main" | "language">("main");

  const username =
    (user as { username?: string; displayName?: string })?.username ||
    (user as { username?: string; displayName?: string })?.displayName ||
    "U";
  const avatarUrl = (user as { avatarUrl?: string })?.avatarUrl;
  const initial = username.charAt(0).toUpperCase();

  return (
    <Popover
      onOpenChange={(open) => {
        if (!open) setView("main");
      }}
    >
      <PopoverTrigger asChild>
        <button
          aria-label="user menu"
          className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
        >
          <Avatar className="size-8">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={username} /> : null}
            <AvatarFallback className="bg-(--bg-secondary) text-(--text-primary) text-xs">
              {initial}
            </AvatarFallback>
          </Avatar>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-56 p-0 bg-(--bg-card) border-(--border)"
      >
        {view === "main" ? (
          <div className="py-1">
            <Link
              href="/pna"
              className="flex items-center gap-3 px-4 py-2 text-sm text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-secondary) transition-colors"
            >
              <Briefcase size={16} className="text-emerald-500" />
              <span>{t.common?.portfolio ?? "Portfolio"}</span>
            </Link>
            <Link
              href="/leaderboard"
              className="flex items-center gap-3 px-4 py-2 text-sm text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-secondary) transition-colors"
            >
              <Trophy size={16} className="text-yellow-500" />
              <span>{t.leaderboard?.title ?? "Leaderboard"}</span>
            </Link>

            <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-secondary) transition-colors">
              <div className="flex items-center gap-3">
                <Moon size={16} className="text-blue-500" />
                <span>{t.common?.darkMode ?? "Dark mode"}</span>
              </div>
              <Switch
                checked={isDark}
                onCheckedChange={(c) => switchTheme(c ? "dark" : "light")}
              />
            </div>

            <Separator className="bg-(--border) my-1" />

            <button
              onClick={() => setView("language")}
              className="w-full flex items-center justify-between gap-3 px-4 py-2 text-sm text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-secondary) transition-colors"
            >
              <div className="flex items-center gap-3">
                <Globe size={16} className="text-purple-500" />
                <span>{t.common?.language ?? "Language"}</span>
              </div>
              <span className="text-xs bg-(--bg-secondary) px-2 py-1 rounded">
                {NATIVE_NAMES[locale] ?? locale}
              </span>
            </button>
          </div>
        ) : (
          <LanguageList
            current={locale}
            onPick={(lang) => {
              setLocale(lang);
              setView("main");
            }}
            onBack={() => setView("main")}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function LanguageList({
  current,
  onPick,
  onBack,
}: {
  current: Locale;
  onPick: (lang: Locale) => void;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="py-1">
      <div className="px-4 py-2 flex items-center justify-between border-b border-(--border)">
        <span className="text-xs font-semibold text-(--text-secondary) uppercase tracking-wider">
          {t.common?.language ?? "Language"}
        </span>
        <button
          onClick={onBack}
          className="text-xs text-(--text-secondary) hover:text-(--text-primary)"
        >
          ←
        </button>
      </div>
      <div className="py-1 max-h-72 overflow-y-auto">
        {LANG_LIST.map((lang) => {
          const active = current === lang;
          return (
            <button
              key={lang}
              onClick={() => onPick(lang)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2 text-sm transition-colors hover:bg-(--bg-secondary)",
                active
                  ? "text-(--accent) font-medium"
                  : "text-(--text-secondary) hover:text-(--text-primary)"
              )}
            >
              <span>{NATIVE_NAMES[lang] ?? lang}</span>
              {active ? <Check size={14} className="text-(--accent)" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
