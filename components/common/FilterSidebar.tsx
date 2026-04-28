import React from "react";
import ProxyImage from "@/components/common/ProxyImage";

/**
 * 过滤项数据结构
 */
export interface FilterItem {
  id: string;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }> | string; // 支持 React 组件图标或图片 URL
}

/**
 * 过滤分组数据结构
 */
export interface FilterGroup {
  items: FilterItem[];
  showDivider?: boolean; // 该组后面是否显示分割线
}

/**
 * 样式配置
 */
export interface FilterSidebarStyles {
  // 容器样式
  desktopContainer?: string;
  mobileContainer?: string;
  mobileScrollContainer?: string;

  // 按钮样式
  desktopButton?: string;
  desktopButtonActive?: string;
  desktopButtonHover?: string;
  mobileButton?: string;
  mobileButtonActive?: string;
  mobileButtonHover?: string;

  // 图标样式
  desktopIcon?: string;
  desktopIconActive?: string;
  desktopIconDefault?: string;
  mobileIcon?: string;

  // 图片图标样式
  desktopImageIcon?: string;
  mobileImageIcon?: string;

  // 文本样式
  desktopLabel?: string;
  desktopLabelActive?: string;
  desktopLabelDefault?: string;
  mobileLabel?: string;

  // 计数样式
  count?: string;
  mobileCount?: string;

  // 分割线样式
  desktopDivider?: string;
  mobileDivider?: string;
}

/**
 * 公共过滤侧边栏组件属性
 */
export interface FilterSidebarProps {
  groups: FilterGroup[]; // 支持多个分组
  selectedId: string; // 当前选中的项 ID
  onItemClick: (id: string) => void; // 点击项时的回调

  // 样式配置（可选，提供默认样式）
  styles?: FilterSidebarStyles;

  // 是否隐藏计数（默认显示）
  hideCount?: boolean;
}

/**
 * FilterSidebar - 通用侧边栏组件
 *
 */
const FilterSidebar: React.FC<FilterSidebarProps> = ({
  groups,
  selectedId,
  onItemClick,
  styles = {},
  hideCount = false,
}) => {
  // 默认样式
  const defaultStyles: FilterSidebarStyles = {
    desktopContainer:
      "hidden lg:flex flex-col w-[260px] p-4 gap-4 bg-(--bg-primary) border-(--border) overflow-y-auto h-[calc(100vh-120px)] sticky top-[120px] scrollbar-hide",
    mobileContainer: "lg:hidden w-full bg-(--bg-primary) border-b border-(--border)",
    mobileScrollContainer:
      "flex overflow-x-auto py-2 px-4 gap-2 scrollbar-hide",

    desktopButton:
      "w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all group",
    desktopButtonActive: "bg-(--bg-secondary)",
    desktopButtonHover: "hover:bg-(--bg-secondary)",
    mobileButton:
      "flex flex-col items-center justify-center min-w-[60px] h-[30px] rounded-lg border transition-all",
    mobileButtonActive: "bg-(--bg-secondary) border-transparent",
    mobileButtonHover: "hover:bg-(--bg-secondary)",

    desktopIcon: "w-5 h-5",
    desktopIconActive: "text-(--text-primary)",
    desktopIconDefault: "text-(--text-secondary) group-hover:text-(--text-primary)",
    mobileIcon: "w-6 h-6 text-(--text-primary) mb-1",

    desktopImageIcon: "w-5 h-5 rounded-full object-contain",
    mobileImageIcon: "w-8 h-8 rounded-full object-contain mb-1",

    desktopLabel: "text-[15px]",
    desktopLabelActive: "font-bold text-(--text-primary)",
    desktopLabelDefault: "font-medium text-(--text-secondary) group-hover:text-(--text-primary)",
    mobileLabel: "text-[11px] font-bold text-(--text-primary) truncate max-w-[70px]",

    count: "text-[13px] text-(--text-tertiary) font-bold",

    desktopDivider: "h-px bg-(--border) mx-1 my-2 shrink-0",
    mobileDivider: "w-px h-[30px] bg-(--border) self-center mx-1 shrink-0",
  };

  // 合并自定义样式和默认样式
  const mergedStyles = { ...defaultStyles, ...styles };

  /**
   * 渲染单个过滤项
   */
  const renderItem = (item: FilterItem, isMobile: boolean) => {
    const isSelected = selectedId === item.id;
    const isIconString = typeof item.icon === "string";
    const IconComponent = !isIconString ? item.icon : null;

    // 桌面端渲染
    if (!isMobile) {
      return (
        <button
          key={item.id}
          onClick={() => onItemClick(item.id)}
          className={`${mergedStyles.desktopButton} ${
            isSelected
              ? mergedStyles.desktopButtonActive
              : mergedStyles.desktopButtonHover
          }`}
        >
          <div className="flex items-center gap-3">
            {/* 图标渲染 */}
            {isIconString ? (
              <ProxyImage
                src={item.icon as string}
                className={mergedStyles.desktopImageIcon}
                alt={item.label}
              />
            ) : (
              IconComponent && (
                <IconComponent
                  className={`${mergedStyles.desktopIcon} ${
                    isSelected
                      ? mergedStyles.desktopIconActive
                      : mergedStyles.desktopIconDefault
                  }`}
                />
              )
            )}

            {/* 文本标签 */}
            <span
              className={`${mergedStyles.desktopLabel} ${
                isSelected
                  ? mergedStyles.desktopLabelActive
                  : mergedStyles.desktopLabelDefault
              }`}
            >
              {item.label}
            </span>
          </div>

          {/* 计数 */}
          {!hideCount && item.count !== undefined && (
            <span className={mergedStyles.count}>{item.count}</span>
          )}
        </button>
      );
    }

    // 移动端渲染
    const hasIcon = isIconString || !!IconComponent;

    // 没有图标时，显示文字标签按钮
    if (!hasIcon) {
      return (
        <button
          key={item.id}
          onClick={() => onItemClick(item.id)}
          className={`px-3 py-1.5 whitespace-nowrap text-xs rounded-lg border border-(--border) transition-all shrink-0 ${
            isSelected
              ? "font-semibold bg-(--accent) text-(--bg-primary) border-(--accent)"
              : "text-(--text-secondary) hover:bg-(--bg-secondary)"
          }`}
        >
          {item.label}
        </button>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => onItemClick(item.id)}
        className={`${mergedStyles.mobileButton} ${
          isSelected
            ? mergedStyles.mobileButtonActive
            : mergedStyles.mobileButtonHover
        }`}
      >
        {/* 图标渲染 */}
        {isIconString ? (
          <ProxyImage
            src={item.icon as string}
            className={mergedStyles.mobileImageIcon}
            alt={item.label}
          />
        ) : (
          IconComponent && <IconComponent className={mergedStyles.mobileIcon} />
        )}

        {/* 文本标签 */}
        <span className={mergedStyles.mobileLabel}>{item.label}</span>
      </button>
    );
  };

  return (
    <>
      {/* 桌面端布局 */}
      <aside className={mergedStyles.desktopContainer}>
        {groups.map((group, groupIndex) => (
          <React.Fragment key={groupIndex}>
            <div className="space-y-1">
              {group.items.map((item) => renderItem(item, false))}
            </div>

            {/* 分割线 */}
            {group.showDivider && groupIndex < groups.length - 1 && (
              <div className={mergedStyles.desktopDivider} />
            )}
          </React.Fragment>
        ))}
      </aside>

      {/* 移动端布局 */}
      <div className={mergedStyles.mobileContainer}>
        <div className={mergedStyles.mobileScrollContainer}>
          {groups.map((group, groupIndex) => (
            <React.Fragment key={groupIndex}>
              {group.items.map((item) => renderItem(item, true))}

              {/* 分割线 */}
              {group.showDivider && groupIndex < groups.length - 1 && (
                <div className={mergedStyles.mobileDivider} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </>
  );
};

export default FilterSidebar;
