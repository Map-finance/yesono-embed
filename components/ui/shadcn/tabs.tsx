"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn(
        "group/tabs flex gap-2 data-[orientation=vertical]:flex-row data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex items-center text-(--text-secondary)",
  {
    variants: {
      variant: {
        default:
          "h-9 w-fit justify-center rounded-lg p-[3px] bg-(--bg-secondary)",
        line: "h-auto gap-3 bg-transparent border-b border-(--border)",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // 项目用 data-theme=dark 而非 .dark class，dark: 变体不生效，颜色直接用 CSS 变量
        "relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium text-(--text-secondary) transition-colors hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--bg-primary) disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        // default variant: pill-like tab，active 时换底色
        "group-data-[variant=default]/tabs-list:h-[calc(100%-2px)] group-data-[variant=default]/tabs-list:flex-1 group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:px-3 group-data-[variant=default]/tabs-list:py-1",
        "data-[state=active]:group-data-[variant=default]/tabs-list:bg-(--bg-card) data-[state=active]:group-data-[variant=default]/tabs-list:text-(--text-primary) data-[state=active]:group-data-[variant=default]/tabs-list:shadow-sm",
        // line variant: 下划线 + accent 黄
        "group-data-[variant=line]/tabs-list:h-9 group-data-[variant=line]/tabs-list:px-1 group-data-[variant=line]/tabs-list:bg-transparent",
        "group-data-[variant=line]/tabs-list:after:absolute group-data-[variant=line]/tabs-list:after:inset-x-0 group-data-[variant=line]/tabs-list:after:-bottom-px group-data-[variant=line]/tabs-list:after:h-[2px] group-data-[variant=line]/tabs-list:after:bg-(--accent) group-data-[variant=line]/tabs-list:after:opacity-0 group-data-[variant=line]/tabs-list:after:transition-opacity",
        "data-[state=active]:group-data-[variant=line]/tabs-list:text-(--accent) data-[state=active]:group-data-[variant=line]/tabs-list:after:opacity-100",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
