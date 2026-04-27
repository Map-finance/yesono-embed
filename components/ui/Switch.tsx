"use client";

import * as React from "react";

export interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    { checked = false, onCheckedChange, disabled = false, className = "" },
    ref
  ) => {
    const [isChecked, setIsChecked] = React.useState(checked);

    React.useEffect(() => {
      setIsChecked(checked);
    }, [checked]);

    const handleClick = () => {
      if (disabled) return;
      const newChecked = !isChecked;
      setIsChecked(newChecked);
      onCheckedChange?.(newChecked);
    };

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={isChecked}
        disabled={disabled}
        onClick={handleClick}
        className={`
          relative inline-flex h-[20px] w-[35px]  items-center rounded-full
          transition-colors
          ${isChecked ? "bg-[var(--accent)]" : "bg-[var(--text-tertiary)]"}
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          ${className}
        `}
      >
        <span
          className={`
            inline-block size-[15px] rounded-full bg-white
            transition-transform
            ${isChecked ? "translate-x-[18px]" : "translate-x-0.5"}
          `}
        />
      </button>
    );
  }
);

Switch.displayName = "Switch";

export { Switch };
