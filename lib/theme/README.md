# 主题系统使用指南

## 📚 概述

主题系统提供了完整的颜色、字体、间距等设计令牌，确保整个应用的设计一致性。

## 🎨 使用主题

### 1. 在组件中使用主题 Hook

```tsx
import { useTheme, useThemeColors } from '@/lib/theme';

function MyComponent() {
  const { theme, themeName, switchTheme, isDark } = useTheme();
  const colors = useThemeColors();
  
  return (
    <div style={{ backgroundColor: colors.bg.primary }}>
      <button onClick={() => switchTheme(isDark ? 'light' : 'dark')}>
        切换主题
      </button>
    </div>
  );
}
```

### 2. 使用 CSS 变量（推荐）

所有主题值都通过 CSS 变量暴露，可以直接在 Tailwind 或 CSS 中使用：

```tsx
// Tailwind 类
<div className="bg-[var(--bg-primary)] text-[var(--text-primary)]">
  <button className="bg-[var(--accent)] hover:bg-[var(--accent-hover)]">
    按钮
  </button>
</div>

// 内联样式
<div style={{ 
  backgroundColor: 'var(--bg-primary)',
  color: 'var(--text-primary)',
  padding: 'var(--spacing-md)',
  borderRadius: 'var(--radius-md)',
}}>
  内容
</div>
```

### 3. 使用 Tailwind 配置的颜色

Tailwind 配置中已经映射了主题颜色：

```tsx
<div className="bg-bg-primary text-text-primary">
  <button className="bg-accent hover:bg-accent-hover">
    按钮
  </button>
</div>
```

## 🎯 主题变量

### 颜色

- **背景色**: `--bg-primary`, `--bg-secondary`, `--bg-card`, `--bg-hover`
- **文字色**: `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-inverse`
- **主题色**: `--accent`, `--accent-secondary`, `--accent-hover`
- **状态色**: `--green`, `--red`, `--yellow`, `--blue`
- **边框色**: `--border`, `--border-light`, `--border-dark`

### 字体

- **字体族**: `--font-primary`, `--font-secondary`, `--font-mono`
- **字体大小**: `--font-size-xs` 到 `--font-size-3xl`
- **字体粗细**: `--font-weight-normal` 到 `--font-weight-bold`

### 间距

- `--spacing-xs` (4px) 到 `--spacing-3xl` (64px)

### 圆角

- `--radius-none` 到 `--radius-full`

### 阴影

- `--shadow-sm` 到 `--shadow-xl`

### 过渡

- `--transition-fast`, `--transition-normal`, `--transition-slow`

## 🔄 切换主题

```tsx
import { useTheme } from '@/lib/theme';

function ThemeSwitcher() {
  const { switchTheme, themeName } = useTheme();
  
  return (
    <button onClick={() => switchTheme(themeName === 'dark' ? 'light' : 'dark')}>
      切换到 {themeName === 'dark' ? '浅色' : '深色'} 主题
    </button>
  );
}
```

## 📝 创建新主题

在 `lib/theme/theme.ts` 中添加新主题：

```typescript
export const myTheme: Theme = {
  name: 'my-theme',
  colors: { ... },
  fonts: { ... },
  // ...
};

export const themes: Record<string, Theme> = {
  dark: defaultTheme,
  light: lightTheme,
  'my-theme': myTheme, // 添加新主题
};
```

## ✅ 最佳实践

1. **优先使用 CSS 变量**: 使用 `var(--variable-name)` 而不是硬编码颜色
2. **使用 Tailwind 类**: 利用 Tailwind 配置的颜色类
3. **保持一致性**: 使用主题中定义的值，不要自定义颜色
4. **响应式设计**: 使用主题的间距和字体大小系统

---

**提示**: 主题会自动保存到 localStorage，刷新页面后会自动应用。

