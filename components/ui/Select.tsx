"use client"

import * as React from "react"
import { Popover } from "./Popover"
import { ChevronDown, Check } from "lucide-react"

export interface SelectOption<T = any> {
  value: T
  label: string
  disabled?: boolean
  render?: () => React.ReactNode
}

export interface SelectProps<T = any> {
  options: SelectOption<T>[]
  value?: T
  defaultValue?: T
  onChange?: (value: T) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  error?: boolean
  fullWidth?: boolean
  renderSelected?: (option: SelectOption<T>) => React.ReactNode
  renderOption?: (option: SelectOption<T>, isSelected: boolean) => React.ReactNode
}

export function Select<T = any>({
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className = "",
  error = false,
  fullWidth = false,
  renderSelected,
  renderOption,
}: SelectProps<T>) {
  const [internalValue, setInternalValue] = React.useState<T | undefined>(defaultValue)
  const [isOpen, setIsOpen] = React.useState(false)
  const [triggerWidth, setTriggerWidth] = React.useState<number>(0)
  const triggerRef = React.useRef<HTMLButtonElement>(null)

  const isControlled = controlledValue !== undefined
  const currentValue = isControlled ? controlledValue : internalValue

  const selectedOption = options.find(opt => opt.value === currentValue)

  React.useEffect(() => {
    if (triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth)
    }
  }, [isOpen])

  const handleSelect = (option: SelectOption<T>) => {
    if (option.disabled) return
    
    if (!isControlled) {
      setInternalValue(option.value)
    }
    onChange?.(option.value)
    setIsOpen(false)
  }

  const displayContent = React.useMemo(() => {
    if (selectedOption) {
      if (renderSelected) {
        return renderSelected(selectedOption)
      }
      if (selectedOption.render) {
        return selectedOption.render()
      }
      return selectedOption.label
    }
    return placeholder
  }, [selectedOption, placeholder, renderSelected])

  return (
    <Popover
      open={isOpen}
      onOpenChange={setIsOpen}
      trigger="click"
      placement="bottom-left"
      content={
        <div 
          className="py-1 max-h-[300px] overflow-y-auto"
          style={{ width: triggerWidth ? `${triggerWidth}px` : 'auto', minWidth: '160px' }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === currentValue
            const optionContent = renderOption
              ? renderOption(option, isSelected)
              : option.render
              ? option.render()
              : option.label

            return (
              <button
                key={index}
                onClick={() => handleSelect(option)}
                disabled={option.disabled}
                className={`
                  w-full px-3 py-2 text-left text-sm
                  flex items-center justify-between gap-2
                  transition-colors
                  ${
                    option.disabled
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-(--bg-secondary) cursor-pointer"
                  }
                  ${isSelected ? "bg-(--bg-secondary)" : ""}
                `}
              >
                <span className="flex-1">{optionContent}</span>
                {isSelected && (
                  <Check size={16} className="text-(--accent) shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      }
    >
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`
          px-3 py-2
          bg-(--bg-secondary)
          border border-(--border)
          rounded-md
          text-(--text-primary)
          transition-colors
          flex items-center justify-between gap-2
          hover:border-(--border-hover)
          focus:outline-hidden
          focus:ring-2
          focus:ring-blue-500
          focus:border-transparent
          disabled:opacity-50
          disabled:cursor-not-allowed
          ${error ? "border-red-500 focus:ring-red-500" : ""}
          ${fullWidth ? "w-full" : ""}
          ${!selectedOption ? "text-(--text-tertiary)" : ""}
          ${className}
        `}
      >
        <span className="flex-1 text-left truncate">{displayContent}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
    </Popover>
  )
}

export default Select
