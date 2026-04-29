/**
 * FilterBarSimple 常量。
 *
 * 注：FilterBarSimple 组件内部还有一份 i18n 化的 SORT_OPTIONS / FREQUENCY_OPTIONS / STATUS_OPTIONS
 * （依赖运行时翻译），那份才是实际渲染用的。本文件下面三个静态版本保留以兼容历史代码（拆分时机械搬运，
 * 不改语义）。后续清理任务可考虑删除静态版本。
 */

// 排序选项（静态版本，不带 i18n）
export const SORT_OPTIONS = [
  { value: "24hr_volume", label: "24hr Volume", icon: "📊" },
  { value: "total_volume", label: "Total Volume", icon: "📈" },
  { value: "liquidity", label: "Liquidity", icon: "💧" },
  { value: "newest", label: "Newest", icon: "✨" },
  { value: "ending_soon", label: "Ending Soon", icon: "⏰" },
  // { value: 'competitive', label: 'Competitive', icon: '🏆' },
];

// 频率选项（静态版本，不带 i18n）
export const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "all", label: "All" },
];

// 状态选项（静态版本，不带 i18n）
export const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "resolved", label: "Resolved" },
];

// 排序值 → API order 映射（支持多字段，前缀 - 降序，+ 升序）
export const SORT_TO_API: Record<string, string> = {
  "24hr_volume": "-volume24hr",
  total_volume: "-volume",
  liquidity: "-liquidity",
  newest: "+startdate",
  ending_soon: "+enddate",
  competitive: "-volume",
};
