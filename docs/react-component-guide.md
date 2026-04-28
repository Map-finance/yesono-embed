# React 组件开发规范

> 适用项目：yesono-embed（Next.js 14 + TS + Tailwind + **shadcn/ui** + Radix Primitives）
> 维护：所有提交 PR 前请对照本规范自检；review 时把违反项作为阻塞理由
> 最后更新：2026-04-27（对齐 AI Workflow nextjs profile 命名规则）
>
> 当前历史代码仍残留 Antd 5 组件，处于过渡期 —— **新增组件一律使用 shadcn/ui**，旧 Antd 组件随业务迭代逐步替换。详见 [§18 UI 组件库](#18-ui-组件库shadcnui)。

---

## 0. 总则

1. **可读 > 可炫**。命名和分层比奇技淫巧重要。
2. **删 > 加**。能删的代码先删，不要为"以后可能用到"留死代码。
3. **同一类问题用同一个解法**。新写法要先在团队里达成共识，不要在 review 里临时发明。
4. **看到不符合规范的旧代码**：当前 PR 不强制改，单独开 PR 修。

---

## 1. 文件与目录

### 1.1 命名

> 与 AI 工作流框架（`AI-WORKFLOW-DESIGN.md` nextjs profile）对齐：**文件名一律 kebab-case**，组件标识符仍 PascalCase。

| 类型 | 规则 | 示例 |
|---|---|---|
| 组件文件 | `kebab-case.tsx`（`export` 的组件名仍是 `PascalCase`） | `market-card.tsx` → `export default function MarketCard()` |
| Hook 文件 | `use-xxx.ts` | `use-market-chart.ts` |
| 工具文件 | `kebab-case.ts` | `format-price.ts` |
| 类型文件 | `xxx.types.ts`，或就近放在组件内 | `market.types.ts` |
| 样式 | 优先 Tailwind class；其次 CSS Module（`xxx.module.css`） | `market-card.module.css` |

**组件 / Hook / 类型的标识符**仍按 React 惯例：组件 `PascalCase`、Hook `useXxx`、类型 `PascalCase`。只有**文件名**走 kebab-case。

**禁止**：内联 `style={{...}}`（除非是动态计算出的尺寸/位置）。

**迁移**：存量 `PascalCase.tsx` 不强制改名（避免大批 rename 污染 git history），但**新增文件一律 kebab-case**；旧文件随业务迭代顺手 rename。

### 1.2 目录组织

```
components/
  cards/                  # 同类组件聚一个目录
    market-card.tsx
    vs-card.tsx
    index.ts              # 集中 re-export
  detail/
    market-chart/         # 复杂组件做成目录（kebab-case）
      index.tsx           # 组件入口
      hooks.ts            # 内部 hook
      utils.ts            # 内部 utils
      types.ts            # 内部 types
```

**拆分阈值**：单文件 < 250 行就放 `.tsx`；超过 250 行或带 ≥2 个子组件，就拆成同名目录 + `index.tsx`。

### 1.3 行数预算

| 文件类型 | 推荐 | 警戒 | 必拆 |
|---|---|---|---|
| 页面（`app/.../page.tsx`） | < 300 | 500 | 800 |
| React 组件 | < 250 | 400 | 600 |
| 自定义 Hook | < 150 | 200 | 300 |
| 工具 / utils | < 200 | 300 | 500 |
| API service | < 300 | 500 | 800 |
| Zustand store | < 150 | 250 | 400 |

超出 **警戒** 行数的 PR：在描述里给出理由或拆分计划；超出 **必拆**：review 直接打回。

判断信号比行数更重要：
- 滚动两次还看不完一个东西 → 拆。
- 一个文件里出现 3 个以上彼此不调用的"区域" → 拆。

---

## 2. 组件分层

每个组件归属于以下三类**之一**，不要混：

| 类型 | 职责 | 局部状态 | 数据请求 |
|---|---|---|---|
| **Page**（`app/.../page.tsx`） | 路由入口 + 组装 | OK | OK |
| **Container**（业务组件） | 业务逻辑 + 数据 | OK | OK |
| **Presentational / UI** | 纯展示，受 props 控制 | 仅 UI 状态（hover、open） | ❌ |

**铁律**：UI 组件不得 `import` 任何 store / service / fetch。

---

## 3. 组件内部结构（固定顺序）

团队所有人按同一顺序写，review 速度翻倍。

```tsx
"use client";  // ① 仅 client component 加，server 不加

// ② imports：按"远 → 近"分组，每组之间空一行
import { useState, useMemo } from "react";                // 1) react
import { useRouter } from "next/navigation";              // 2) next / 三方
import { Bookmark } from "lucide-react";                  // 3) UI 库

import { Market } from "@/types/types";                   // 4) 项目内 types
import { useTranslation } from "@/lib/i18n";              // 5) 项目内 lib / hooks
import ProxyImage from "@/components/common/proxy-image"; // 6) 项目内组件

import styles from "./market-card.module.css";            // 7) 样式

// ③ 类型 / Props
interface MarketCardProps {
  market: Market;
  onFavoriteChange?: () => void;
}

// ④ 文件内常量（不参与渲染重算）
const MAX_TITLE_LEN = 80;

// ⑤ 内部子组件（只在本文件用，不导出）
function FavoriteButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return <button onClick={onClick}>{active ? "★" : "☆"}</button>;
}

// ⑥ 主组件
export default function MarketCard({ market, onFavoriteChange }: MarketCardProps) {
  // 6.1 hooks（顺序：路由 → context/store → state → memo → effect → 自定义 hook）
  const router = useRouter();
  const { t } = useTranslation();
  const [isFav, setIsFav] = useState(market.isFavorite);

  const yesPercent = useMemo(
    () => Math.round((market.options[0]?.percentage ?? 0) * 100),
    [market.options]
  );

  // 6.2 事件处理
  const handleClick = () => router.push(`/market/${market.id}`);

  // 6.3 早返回（loading / error / empty）
  if (!market) return null;

  // 6.4 渲染
  return <article onClick={handleClick}>...</article>;
}
```

---

## 4. Props

- 永远定义 `interface XxxProps`，不写 inline。
- 可选 prop 用 `?` + 默认值：`size = "md"`。**不要** 用 `defaultProps`（React 19 已废弃）。
- 回调命名 `on{Event}`，处理函数命名 `handle{Event}`。
- **不透传 DOM props**（`...rest`）—— 除非组件就是包装 `<button>` / `<input>`。
- 超过 5 个 prop 时考虑：拆组件 / 用对象（`config` / `options`）/ 用 children。

```tsx
// ❌
<Card title="" subtitle="" image="" link="" badge="" priority={1} variant="" />

// ✅ 选择 1：传一个对象
<Card data={cardData} />

// ✅ 选择 2：复合组件
<Card title="">
  <Card.Image src="" />
  <Card.Body>...</Card.Body>
</Card>
```

---

## 5. State 管理

| 场景 | 用什么 |
|---|---|
| 单组件内（toggle、input） | `useState` |
| 父子共享 | 提升到最近父组件 |
| 跨组件、同页面 | `useContext` |
| 跨页面、全局 | Zustand store |
| 服务端数据 | **SWR / TanStack Query**，不要塞进 Zustand |
| 表单 | 受控 + **react-hook-form + zod**（统一选型） |

**禁止**：把服务端数据用 `useState` + `useEffect(fetch)` 手搓。统一走 SWR。

---

## 6. 副作用 `useEffect`

- 每个 `useEffect` 只做一件事，多件事开多个。
- 依赖数组完整，**不要**用 `// eslint-disable react-hooks/exhaustive-deps` 绕过；如果依赖确实多，先想是不是该用 `useReducer` / `useRef` / 抽 hook。
- 副作用必须可清理 —— 订阅、定时器、监听都要在 return 里取消。
- 数据请求不放 `useEffect`（除非真没办法），交给 SWR / Query。

```tsx
// ❌ 一个 effect 干多件事
useEffect(() => {
  fetchUser();
  setupWebSocket();
  trackPageView();
}, []);

// ✅ 拆开 + 清理
useEffect(() => { trackPageView(); }, []);

useEffect(() => {
  const ws = setupWebSocket();
  return () => ws.close();
}, []);
```

---

## 7. 性能

不要无脑 `useMemo` / `useCallback`。**只在以下三种情况用**：
1. 依赖项参与下游 `React.memo` 组件的 props。
2. 计算确实昂贵（千行表格、复杂 reduce）。
3. 该值作为 effect 的依赖且引用稳定性影响行为。

`React.memo` 同理 —— 测过 React Profiler 再上。

**列表必须有稳定 `key`**，绝不用 index（除非列表只读且永不重排）。

**大列表（> 100 项）** 用 `react-window` / `react-virtualized-auto-sizer`（项目已装）。

---

## 8. 样式（Tailwind）

- 优先 Tailwind utility class。
- 复杂条件用 `clsx` / `cn`，不要三目嵌套：

```tsx
// ❌
<div className={`p-4 ${active ? "bg-red-500" : ""} ${size === "lg" ? "text-xl" : "text-sm"}`}>

// ✅
import { clsx } from "clsx";
<div className={clsx(
  "p-4",
  active && "bg-red-500",
  size === "lg" ? "text-xl" : "text-sm",
)}>
```

- 颜色用 CSS 变量：`var(--accent)` / `var(--bg-primary)` / `var(--text-primary)` / `var(--border)`。**禁止**硬编码 hex（除少数确定不会随主题变的色彩）。
- 移动端遵循 `flex flex-wrap` + `min-w-0` + `truncate`，**禁止**给文字容器写死 `width`。
- 同一类视觉常量抽成 Tailwind config 或工具组件，避免散落到处都是。

---

## 9. 国际化

- 用户可见的所有字符串走 `t.xxx`，**禁止**硬编码中英文。
- 新增 key 必须**同步所有语言文件**（`lib/i18n/langs/*/`）。
- 复数、占位符用模板：`t.market.timeAgo({ n: 3 })`，不在组件里 `${...}` 拼。

---

## 10. 可访问性 (a11y)

最低要求：
- 交互元素必须是 `<button>` / `<a>`，**禁止** `<div onClick>`。
- 图片有 `alt`；装饰图写 `alt=""`。
- 表单 `<input>` 有 `<label>` 或 `aria-label`。
- 模态 / 抽屉的关闭按钮有 `aria-label="Close"`。
- 键盘可达：`Tab` 走得通，`Esc` 能关弹层。

---

## 11. 错误与边界

- 数据请求的页面提供 `loading` / `error` / `empty` 三态。
- 服务端 fetch 失败要抛错，让 `error.tsx` 兜底；**不要** `try/catch` 静默吞错。
- 用户输入做 trim / 长度限制，不信任客户端。
- 组件级出错可包 `<ErrorBoundary>`（如引入 `react-error-boundary`）。

---

## 12. 嵌入项目特有规范（yesono-embed）

> 这一节只对 yesono-embed 适用，普通项目可跳过。

- **不写登录 / 钱包 / 交易相关的 UI**。token 由宿主注入到 `EmbedContext`，组件只做展示。
- **不要直接读 `localStorage` 取 token**，统一走 `getEmbedToken()` 或 `useEmbed()` hook。
- **不要假设宿主有 token**：`favorite`、`comment`、`like` 等需要鉴权的操作，UI 仍然渲染但点击时提供合理的 fallback（toast 或 noop）。
- **iframe 内禁止全屏弹窗** —— 高度由 `IframeBridge` 推到宿主，弹层撑高 iframe 时需要测试宿主体验。
- 任何全局副作用（document.body 锁滚动、全局事件监听）都要在卸载时清理，不要污染宿主。

---

## 13. 不要做的事（黑名单）

- ❌ 在组件里直接 `localStorage.getItem`，包一层 `safeLocalStorage`。
- ❌ `dangerouslySetInnerHTML` 渲染用户内容。
- ❌ 拼接 className 做主题判断（用 `data-theme` + CSS 变量）。
- ❌ `any` / `as unknown as Foo`，先想清楚类型。
- ❌ `console.log` 留在主分支；调试用 `console.warn` / `console.error` 并加前缀 `[ComponentName]`。
- ❌ 大段注释解释 WHAT，命名讲清楚就够；只在 WHY 不明显时写注释。
- ❌ 一个组件 `export` 多个 default。
- ❌ `index.ts` barrel re-export 时跨文件循环引用。
- ❌ 复制粘贴超过 3 处：抽成组件或 hook。
- ❌ 发现 bug 在 UI 层 hack 修复（加判断、加默认值），先回到数据源修。

---

## 14. 测试（引入后适用）

每个组件至少覆盖：
1. 渲染 happy path。
2. 处理空数据 / 空数组 / null。
3. 关键交互（点击、输入）触发回调。

工具：`@testing-library/react` + `vitest`。文件 `xxx.test.tsx` 与组件同目录（kebab-case）。

---

## 15. PR 自检清单

提交 PR 前对照：

- [ ] 文件 < 300 行（否则解释或拆分）。
- [ ] Props 有类型，没用 `any`。
- [ ] 没有 `console.log`。
- [ ] 文案走 i18n。
- [ ] 移动端 320px 宽度下不溢出。
- [ ] Tab 键能聚焦所有交互元素。
- [ ] `yarn lint` 通过。
- [ ] 暗色 / 亮色主题都看过。
- [ ] 删除了未使用的 import 和 dead code。
- [ ] 嵌入项目：宿主无 token 状态下不报错、不白屏。

---

## 16. 模板

新建组件时复制这份骨架开始，省掉重复设计：

```tsx
"use client";

import React from "react";
import { useTranslation } from "@/lib/i18n";

interface XxxProps {
  // TODO
}

export default function Xxx({}: XxxProps) {
  const { t } = useTranslation();

  return (
    <div className="...">
      {/* TODO */}
    </div>
  );
}
```

新建 hook：

```ts
import { useState, useEffect } from "react";

interface UseXxxOptions {
  enabled?: boolean;
}

interface UseXxxReturn {
  data: unknown;
  isLoading: boolean;
  error: Error | null;
}

export function useXxx(options: UseXxxOptions = {}): UseXxxReturn {
  const { enabled = true } = options;
  const [data, setData] = useState<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) return;
    // TODO
  }, [enabled]);

  return { data, isLoading, error };
}
```

---

## 17. 变更管理

- 修改本规范走 PR + 至少 1 人 review。
- 重大变更（影响所有组件写法）在 README / CLAUDE.md 同步指出。
- 规范不是教条，遇到规范没覆盖的场景，先按"尽量贴近现有写法"原则处理，再回来补规范。

---

## 18. UI 组件库（shadcn/ui）

### 18.1 选型结论

本项目统一使用 **shadcn/ui + Radix Primitives + Tailwind**，理由：

- 嵌入式 widget 的命门是不污染宿主样式 —— shadcn 是纯 Tailwind class，可加 prefix 完全隔离。
- 组件源码进自己仓库，三方包升级不会把样式搞坏。
- a11y 由 Radix Primitives 兜底（业界标杆）。
- RSC 友好，不会被一堆 `"use client"` 拖累。
- 体积小，比 Antd 节省约 200KB（gzip）。

**Antd 处于过渡期**：旧组件不强制改，但**新代码不允许新增 Antd 依赖**。详见 [§18.4 迁移路线](#184-迁移路线)。

### 18.2 组件选型清单

| 场景 | 用什么 |
|---|---|
| Button / Input / Label / Badge / Card / Avatar | shadcn/ui |
| Dialog / AlertDialog | shadcn `Dialog` / `AlertDialog` |
| Drawer（侧边/底部抽屉） | shadcn `Sheet`（桌面）/ `Drawer`（移动端，基于 Vaul） |
| Tabs | shadcn `Tabs` |
| Popover / Tooltip / HoverCard | shadcn 同名组件 |
| Select / Combobox | shadcn `Select` / `Command + Popover`（Combobox 模式） |
| Checkbox / Radio / Switch | shadcn 同名组件 |
| DatePicker / Calendar | shadcn `Calendar`（基于 react-day-picker） |
| Toast / 全局消息 | **`sonner`**（shadcn 推荐） |
| Form | **react-hook-form + zod + shadcn `Form`** |
| Table | **TanStack Table v8 + shadcn `Table`**（分别管逻辑和渲染） |
| Pagination | shadcn `Pagination` |
| 命令面板 / 搜索 | shadcn `Command`（基于 cmdk） |
| 图标 | `lucide-react`（已装） |
| 图表 | `recharts` / `lightweight-charts`（已装） |
| 数字滚动动画 | `@number-flow/react`（已装） |
| 长列表虚拟化 | `react-window` + `react-virtualized-auto-sizer`（已装） |

### 18.3 写法约定

**装组件**：用官方 CLI，组件源码会被复制到 `components/ui/`：

```bash
npx shadcn@latest add dialog tabs popover select toast
```

> 注意：本项目已有 `components/ui/` 目录（旧 Antd 包装层）。新加 shadcn 组件先加到 `components/ui/shadcn/`，避免与旧 `Toast.tsx` / `Dialog.tsx` 冲突；旧组件迁移完毕后再合并。

**class 合并**：统一用 `clsx` + `tailwind-merge` 组合的 `cn` 工具（shadcn init 自动生成在 `lib/utils.ts`）：

```tsx
import { cn } from "@/lib/utils";

<div className={cn("p-4 rounded-md", active && "bg-[var(--accent)]")} />
```

**主题色**：继续走 CSS 变量（`var(--accent)`、`var(--bg-primary)`、`var(--text-primary)`、`var(--border)`），不要硬编码 `bg-zinc-900`。shadcn 默认的 `--background` / `--foreground` 等变量按需映射到本项目的变量上，统一在 [styles/index.css](../styles/index.css) 定义。

**变体**：用 `class-variance-authority` (`cva`) 组织 variant 和 size，不要手写 if-else 拼 class。

**a11y**：所有交互组件用 shadcn / Radix 的对应组件，不要自己 `<div onClick>` 模拟。

### 18.4 迁移路线

不强制一次性切换，按以下节奏：

| 阶段 | 内容 | 工时预估 |
|---|---|---|
| 1 | `npx shadcn init`，引入 `Dialog` / `Tabs` / `Popover` / `Toast`，先把 Header 的 "How it works" 弹窗换掉 | 半天 |
| 2 | 新组件全部用 shadcn；不再 import `antd` | 持续 |
| 3 | 把存量 Antd 组件按使用频率排序，逐个替换：`Modal` → `Dialog`，`Drawer` → `Sheet`，`Tabs` → `Tabs`，`Popover` → `Popover`，`Select` → `Select` | 1–2 天 |
| 4 | 拆掉 [app/ClientWrapper.tsx](../app/ClientWrapper.tsx) 中的 `ConfigProvider` / `App`，主题改为纯 CSS 变量 | 半天 |
| 5 | `yarn remove antd @ant-design/cssinjs`，跑 `yarn build` 确认无引用 | 10 分钟 |

### 18.5 黑名单（与 §13 互补）

- ❌ 新代码不要 `import { Xxx } from "antd"`。
- ❌ 不要用 `@emotion/*` / `styled-components` —— 与 Tailwind 哲学冲突。
- ❌ 不要混用 MUI / Chakra / Mantine。
- ❌ 不要全局污染 `body` 样式（弹层 / Drawer 锁滚动用 Radix 自带方案）。
- ❌ 不要在 shadcn 组件源码上"二次 fork"，需要扩展时新建一个组件包裹它。

### 18.6 参考资料

- [shadcn/ui 官方文档](https://ui.shadcn.com/)
- [Radix Primitives](https://www.radix-ui.com/primitives)
- [TanStack Table](https://tanstack.com/table)
- [react-hook-form](https://react-hook-form.com/) + [Zod](https://zod.dev/)
- [Sonner（Toast）](https://sonner.emilkowal.ski/)
