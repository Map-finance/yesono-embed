"use client";

import * as React from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import dayjs, { type Dayjs } from "dayjs";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/shadcn/button";
import { Calendar } from "@/components/ui/shadcn/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/shadcn/popover";

/**
 * DatePicker - antd 兼容 wrapper（API 保留 value=Dayjs|null / onChange=(Dayjs|null)）
 * 内部使用 shadcn Calendar (react-day-picker)。
 * 不支持 antd 的 picker="week|month|year"；调用方传入这些时降级为 date。
 */
export interface DatePickerProps {
  value?: Dayjs | null;
  onChange?: (date: Dayjs | null) => void;
  /** antd 形参兼容：date|week|month|year；本组件目前一律按 date 处理 */
  picker?: "date" | "week" | "month" | "year";
  placeholder?: string;
  disabled?: boolean;
  disabledDate?: (current: Dayjs) => boolean;
  className?: string;
  /** antd 兼容：size / style 接收但忽略（样式走 className + 主题 token） */
  size?: "small" | "middle" | "large";
  style?: React.CSSProperties;
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  disabledDate,
  className,
  style,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selectedDate = value ? value.toDate() : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-10 px-3",
            "bg-(--bg-secondary) border-(--border) text-(--text-primary) hover:bg-(--bg-hover)",
            !value && "text-(--text-tertiary)",
            className
          )}
          style={style}
        >
          <CalendarIcon className="mr-2 size-4 text-(--text-secondary)" />
          {value ? value.format("YYYY-MM-DD") : (placeholder ?? "Pick a date")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(d) => {
            onChange?.(d ? dayjs(d) : null);
            setOpen(false);
          }}
          disabled={
            disabledDate ? (d: Date) => !!disabledDate(dayjs(d)) : undefined
          }
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
