'use client';

/**
 * 主题 Hook
 * 用于在组件中使用主题
 */

import { useEffect, useState } from 'react';
import { Theme, defaultTheme, themes } from './theme';
import { applyTheme, getCurrentTheme, setThemeName } from './applyTheme';

function getThemeCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|; )theme=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function setThemeCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `theme=${encodeURIComponent(name)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/**
 * 使用主题 Hook
 */
export function useTheme() {
  const [themeName, setThemeNameState] = useState<string>(getCurrentTheme);
  const [theme, setTheme] = useState<Theme>(themes[themeName] || defaultTheme);

  // 切换主题
  const switchTheme = (name: string) => {
    const newTheme = themes[name] || defaultTheme;
    applyTheme(newTheme);
    setThemeName(name);
    setThemeNameState(name);
    setTheme(newTheme);
    setThemeCookie(name);
    
    // 保存到 localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', name);
    }
  };

  // 初始化主题
  useEffect(() => {
    // 优先读取 cookie，其次 localStorage
    const savedTheme = getThemeCookie() || (typeof window !== 'undefined' 
      ? localStorage.getItem('theme') || 'dark'
      : 'dark');
    
    switchTheme(savedTheme);
  }, []);

  return {
    theme,
    themeName,
    switchTheme,
    isDark: themeName === 'dark',
    isLight: themeName === 'light',
  };
}

/**
 * 获取主题颜色
 */
export function useThemeColors() {
  const { theme } = useTheme();
  return theme.colors;
}

/**
 * 获取主题间距
 */
export function useThemeSpacing() {
  const { theme } = useTheme();
  return theme.spacing;
}

