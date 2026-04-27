/**
 * 应用主题
 * 将主题配置应用到 CSS 变量
 */

import { Theme } from './theme';

/**
 * 应用主题到 DOM
 */
export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // 应用颜色
  root.style.setProperty('--bg-primary', theme.colors.bg.primary);
  root.style.setProperty('--bg-secondary', theme.colors.bg.secondary);
  root.style.setProperty('--bg-card', theme.colors.bg.card);
  root.style.setProperty('--bg-hover', theme.colors.bg.hover);

  root.style.setProperty('--text-primary', theme.colors.text.primary);
  root.style.setProperty('--text-secondary', theme.colors.text.secondary);
  root.style.setProperty('--text-tertiary', theme.colors.text.tertiary);
  root.style.setProperty('--text-inverse', theme.colors.text.inverse);

  root.style.setProperty('--accent', theme.colors.accent.primary);
  root.style.setProperty('--accent-secondary', theme.colors.accent.secondary);
  root.style.setProperty('--accent-hover', theme.colors.accent.hover);

  root.style.setProperty('--green', theme.colors.status.success);
  root.style.setProperty('--red', theme.colors.status.error);
  root.style.setProperty('--yellow', theme.colors.status.warning);
  root.style.setProperty('--blue', theme.colors.status.info);

  root.style.setProperty('--border', theme.colors.border.default);
  root.style.setProperty('--border-light', theme.colors.border.light);
  root.style.setProperty('--border-dark', theme.colors.border.dark);

  // 应用字体
  root.style.setProperty('--font-primary', theme.fonts.primary);
  root.style.setProperty('--font-secondary', theme.fonts.secondary);
  root.style.setProperty('--font-mono', theme.fonts.mono);

  Object.entries(theme.fonts.sizes).forEach(([key, value]) => {
    root.style.setProperty(`--font-size-${key}`, value);
  });

  Object.entries(theme.fonts.weights).forEach(([key, value]) => {
    root.style.setProperty(`--font-weight-${key}`, value.toString());
  });

  // 应用间距
  Object.entries(theme.spacing).forEach(([key, value]) => {
    root.style.setProperty(`--spacing-${key}`, value);
  });

  // 应用圆角
  Object.entries(theme.borderRadius).forEach(([key, value]) => {
    root.style.setProperty(`--radius-${key}`, value);
  });

  // 应用阴影
  Object.entries(theme.shadows).forEach(([key, value]) => {
    root.style.setProperty(`--shadow-${key}`, value);
  });

  // 应用过渡
  Object.entries(theme.transitions).forEach(([key, value]) => {
    root.style.setProperty(`--transition-${key}`, value);
  });

  // 输入框专用背景色（亮色白色，暗色有辨识度）
  const isDark = theme.name === 'dark';
  root.style.setProperty('--bg-input', isDark ? '#1e1e30' : '#ffffff');

  // 兼容旧变量名
  root.style.setProperty('--color-primary', theme.colors.accent.primary);
  root.style.setProperty('--color-secondary', theme.colors.accent.secondary);
  root.style.setProperty('--color-background', theme.colors.bg.primary);
  root.style.setProperty('--color-text', theme.colors.text.primary);
  root.style.setProperty('--color-accent', theme.colors.accent.primary);
}

/**
 * 获取当前主题名称
 */
export function getCurrentTheme(): string {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

/**
 * 设置主题名称
 */
export function setThemeName(name: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', name);
}

