"use client";

import * as React from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/shadcn/popover";

export interface ComboboxOption {
  value: string;
  label: React.ReactNode;
}

/**
 * Combobox - antd `<Select showSearch onSearch>` 兼容 wrapper
 * 单选 + 服务端搜索（onSearch 把输入回传给调用方刷新 options）
 */
export interface ComboboxProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  options: ComboboxOption[];
  /** 输入变化时回调（服务端 / 异步搜索） */
  onSearch?: (text: string) => void;
  placeholder?: string;
  emptyText?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  onSearch,
  placeholder,
  emptyText,
  loading,
  disabled,
  allowClear,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "group flex h-10 w-full items-center justify-between rounded-lg border border-(--border) bg-(--bg-secondary) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:border-(--accent) disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span
            className={cn(
              "line-clamp-1 text-left",
              !selected && "text-(--text-tertiary)"
            )}
          >
            {selected ? selected.label : placeholder}
          </span>
          <span className="flex items-center gap-1">
            {allowClear && value ? (
              <X
                className="size-3.5 cursor-pointer text-(--text-tertiary) hover:text-(--text-primary)"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange?.(undefined);
                }}
              />
            ) : null}
            <ChevronDown className="size-4 opacity-50" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center border-b border-(--border) px-2">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              onSearch?.(e.target.value);
            }}
            placeholder={placeholder}
            className="h-9 w-full bg-transparent text-sm text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-none"
          />
        </div>
        <div className="max-h-[260px] overflow-y-auto p-1">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-(--text-secondary)">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : options.length === 0 ? (
            <div className="py-6 text-center text-sm text-(--text-tertiary)">
              {emptyText ?? "No results"}
            </div>
          ) : (
            options.map((opt) => {
              const isActive = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange?.(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-(--text-primary) hover:bg-(--bg-secondary)",
                    isActive && "bg-(--bg-secondary)"
                  )}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      isActive ? "text-(--accent)" : "opacity-0"
                    )}
                  />
                  <span className="line-clamp-1">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * MultiCombobox - antd `<Select mode="multiple" showSearch onSearch>` 兼容 wrapper
 * 多选 + 服务端搜索；已选项显示为 chips
 */
export interface MultiComboboxProps {
  value: string[];
  onChange?: (values: string[]) => void;
  options: ComboboxOption[];
  onSearch?: (text: string) => void;
  placeholder?: string;
  emptyText?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  allowClear?: boolean;
  className?: string;
}

export function MultiCombobox({
  value,
  onChange,
  options,
  onSearch,
  placeholder,
  emptyText,
  loading,
  disabled,
  allowClear,
  className,
}: MultiComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const valueSet = React.useMemo(() => new Set(value), [value]);

  const selectedItems = React.useMemo(() => {
    return value.map((v) => {
      const opt = options.find((o) => o.value === v);
      return { value: v, label: opt?.label ?? v };
    });
  }, [value, options]);

  const toggle = (v: string) => {
    if (valueSet.has(v)) {
      onChange?.(value.filter((x) => x !== v));
    } else {
      onChange?.([...value, v]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-(--border) bg-(--bg-secondary) px-2 py-1.5 text-sm text-(--text-primary) focus:outline-none focus:border-(--accent) disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <div className="flex flex-1 flex-wrap items-center gap-1">
            {selectedItems.length === 0 ? (
              <span className="px-1 text-(--text-tertiary)">{placeholder}</span>
            ) : (
              selectedItems.map((item) => (
                <span
                  key={item.value}
                  className="inline-flex items-center gap-1 rounded bg-(--bg-card) border border-(--border) px-1.5 py-0.5 text-xs"
                >
                  <span className="line-clamp-1">{item.label}</span>
                  <X
                    className="size-3 cursor-pointer text-(--text-tertiary) hover:text-(--text-primary)"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(item.value);
                    }}
                  />
                </span>
              ))
            )}
          </div>
          <span className="flex items-center gap-1">
            {allowClear && value.length > 0 ? (
              <X
                className="size-3.5 cursor-pointer text-(--text-tertiary) hover:text-(--text-primary)"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange?.([]);
                }}
              />
            ) : null}
            <ChevronDown className="size-4 opacity-50" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center border-b border-(--border) px-2">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              onSearch?.(e.target.value);
            }}
            placeholder={placeholder}
            className="h-9 w-full bg-transparent text-sm text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-none"
          />
        </div>
        <div className="max-h-[260px] overflow-y-auto p-1">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-(--text-secondary)">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : options.length === 0 ? (
            <div className="py-6 text-center text-sm text-(--text-tertiary)">
              {emptyText ?? "No results"}
            </div>
          ) : (
            options.map((opt) => {
              const isActive = valueSet.has(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggle(opt.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-(--text-primary) hover:bg-(--bg-secondary)",
                    isActive && "bg-(--bg-secondary)"
                  )}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      isActive ? "text-(--accent)" : "opacity-0"
                    )}
                  />
                  <span className="line-clamp-1">{opt.label}</span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
