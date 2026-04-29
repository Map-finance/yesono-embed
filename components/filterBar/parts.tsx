"use client";

import React from "react";
import { ChevronDown } from "lucide-react";

/**
 * FilterBarSimple 的两个内部 UI 子组件。
 *
 * 之前定义在主组件函数体内（闭包共享 openDropdown / setOpenDropdown），
 * 每次父组件 render 都会重建一份新组件类型 → 触发不必要的 unmount/remount（§2.1 性能问题）。
 * 抽出后通过 props 显式传入状态，类型稳定。
 */

// ---------------------------------------------------------------- DropdownSelect

interface DropdownSelectProps {
  label: string;
  value: string;
  options: { value: string; label: string; icon?: string }[];
  onChange: (value: string) => void;
  dropdownKey: string;
  openDropdown: string | null;
  setOpenDropdown: (key: string | null) => void;
}

export function DropdownSelect({
  label,
  value,
  options,
  onChange,
  dropdownKey,
  openDropdown,
  setOpenDropdown,
}: DropdownSelectProps) {
  const isOpen = openDropdown === dropdownKey;
  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="relative">
      <button
        onClick={() => setOpenDropdown(isOpen ? null : dropdownKey)}
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border border-(--border) rounded-md hover:bg-(--bg-secondary) transition-colors"
      >
        <span className="text-(--text-secondary)">{label}:</span>
        <span className="text-(--text-primary) font-medium">
          {selectedOption?.label}
        </span>
        <ChevronDown
          size={12}
          className={`text-(--text-secondary) transition-transform sm:w-3.5 sm:h-3.5 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[140px] bg-(--bg-card) border border-(--border) rounded-md shadow-lg z-50 py-1">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setOpenDropdown(null);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-(--bg-secondary) transition-colors flex items-center gap-2 ${
                value === option.value
                  ? "text-(--accent)"
                  : "text-(--text-primary)"
              }`}
            >
              {option.icon && <span>{option.icon}</span>}
              {option.label}
              {value === option.value && <span className="ml-auto">•</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- CheckboxFilter

interface CheckboxFilterProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function CheckboxFilter({
  label,
  checked,
  onChange,
}: CheckboxFilterProps) {
  return (
    <label className="flex items-center gap-2 px-3 py-1.5 text-sm border border-(--border) rounded-md cursor-pointer hover:bg-(--bg-secondary) transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-(--border) text-(--accent) focus:ring-(--accent) focus:ring-offset-0 bg-transparent"
      />
      <span className="text-(--text-secondary)">{label}</span>
    </label>
  );
}
