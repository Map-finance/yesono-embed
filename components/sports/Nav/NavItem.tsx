import { memo, ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

type BaseNavItemProps = {
  active: boolean;
  icon?: ReactNode;
  label: string;
  badge?: number | string;
  className?: string;
};

type NavItemLinkProps = BaseNavItemProps & {
  type: "link";
  href: string;
  onClick: () => void;
};

type NavItemButtonProps = BaseNavItemProps & {
  type: "button";
  onClick: () => void;
  expanded?: boolean;
};

type NavItemProps = NavItemLinkProps | NavItemButtonProps;

/**
 * 通用的导航项组件，用于渲染各种样式相似的链接和按钮
 * 支持链接模式和按钮模式，可以显示图标、标签和徽章
 */
export const NavItem = memo(function NavItem(props: NavItemProps) {
  const { active, icon, label, badge, className = "" } = props;

  const baseClassName = `flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-all max-md:min-w-[60px] max-md:justify-center max-md:px-2 max-md:py-1.5 ${
    active
      ? "bg-(--bg-secondary) text-(--accent)"
      : "hover:bg-(--bg-hover) max-md:hover:bg-transparent"
  } ${className}`;

  const content = (
    <>
      <div className="flex items-center gap-2 max-md:flex-col py-1 max-md:py-0 min-w-0 flex-1">
        {/* {icon && (
          <span className="w-5 h-5 flex items-center justify-center text-lg">
            {icon}
          </span>
        )} */}
        <span className="truncate">{label}</span>
      </div>
      {badge !== undefined && (
        <span
          className={`text-xs max-md:absolute max-md:top-0 max-md:right-0 max-md:text-white max-md:bg-red max-md:rounded-md max-md:px-1 ${
            active ? "text-(--accent)" : "text-(--text-secondary)"
          }`}
        >
          {badge}
        </span>
      )}
      {props.type === "button" && props.expanded !== undefined && (
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 max-md:hidden ${
            props.expanded ? "rotate-180" : ""
          }`}
        />
      )}
    </>
  );

  if (props.type === "link") {
    const { href, onClick } = props;

    return (
      <Link
        href={href}
        onClick={onClick}
        className={`${baseClassName} relative`}
        aria-current={active ? "page" : undefined}
      >
        {content}
      </Link>
    );
  }

  // button type
  return (
    <button
      onClick={props.onClick}
      className={`w-full border-none bg-transparent cursor-pointer ${baseClassName}`}
    >
      {content}
    </button>
  );
});
