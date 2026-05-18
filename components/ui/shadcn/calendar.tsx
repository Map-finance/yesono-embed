"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      data-slot="calendar"
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-4",
        month: "flex flex-col gap-3",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium text-(--text-primary)",
        nav: "flex items-center gap-1",
        button_previous: cn(
          "absolute left-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-(--border) bg-transparent text-(--text-secondary) hover:bg-(--bg-secondary) hover:text-(--text-primary) disabled:opacity-30"
        ),
        button_next: cn(
          "absolute right-1 inline-flex h-7 w-7 items-center justify-center rounded-md border border-(--border) bg-transparent text-(--text-secondary) hover:bg-(--bg-secondary) hover:text-(--text-primary) disabled:opacity-30"
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-(--text-tertiary) rounded-md w-9 font-normal text-xs",
        week: "flex w-full mt-1",
        day: "h-9 w-9 text-center text-sm p-0 relative",
        day_button: cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-normal text-(--text-primary) hover:bg-(--bg-secondary) hover:text-(--text-primary) aria-selected:opacity-100 disabled:pointer-events-none disabled:opacity-40"
        ),
        selected:
          "[&>button]:bg-(--accent) [&>button]:text-(--text-inverse) [&>button]:hover:bg-(--accent-hover) [&>button]:hover:text-(--text-inverse) [&>button]:font-medium",
        today: "[&>button]:bg-(--bg-secondary) [&>button]:text-(--text-primary)",
        outside: "[&>button]:text-(--text-tertiary) [&>button]:opacity-50",
        disabled: "[&>button]:text-(--text-tertiary) [&>button]:opacity-40",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chevronClassName }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className={cn("size-4", chevronClassName)} />;
        },
      }}
      {...props}
    />
  );
}

export { Calendar };
