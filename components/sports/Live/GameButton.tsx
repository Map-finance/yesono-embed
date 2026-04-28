"use client"

import { ButtonHTMLAttributes, ReactNode } from "react"

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: "primary" | "secondary" | "success" | "danger"
  size?: "sm" | "md" | "lg"
  color?: string // 自定义背景颜色，会覆盖variant
  textColor?: string // 自定义文字颜色，不传则根据 color 自动决定
  shadowColor?: string // 自定义阴影颜色，默认使用color
}

export default function GameButton({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  color,
  textColor,
  shadowColor,
  ...props
}: GameButtonProps) {
  const variants = {
    primary: "bg-(--accent) text-white",
    secondary: "bg-(--bg-secondary) text-(--text-primary)",
    success: "bg-green-500 text-white",
    danger: "bg-red-500 text-white",
  }

  const shadowColors = {
    primary: "var(--accent)",
    secondary: "var(--border)",
    success: "rgb(34, 197, 94)",
    danger: "rgb(239, 68, 68)",
  }

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  }

  // 如果提供了自定义颜色，使用自定义颜色，否则使用variant
  const finalShadowColor = shadowColor || color || shadowColors[variant]
  const customStyle: React.CSSProperties = color
    ? { backgroundColor: color, color: textColor || undefined }
    : {}

  return (
    <button
      disabled={disabled}
      className={`
        relative
        rounded-md
        font-semibold
        border-2 border-(--border)
        transition-all
        duration-100
        flex items-center justify-center
        ${color ? "" : variants[variant]}
        ${sizes[size]}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        ${className}
      `}
      style={{
        ...customStyle,
        boxShadow: `0 4px 0 0 color-mix(in srgb, ${finalShadowColor} 40%, transparent)`,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.boxShadow = `0 2px 0 0 color-mix(in srgb, ${finalShadowColor} 40%, transparent)`
          e.currentTarget.style.transform = "translateY(2px)"
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.boxShadow = `0 4px 0 0 color-mix(in srgb, ${finalShadowColor} 40%, transparent)`
          e.currentTarget.style.transform = "translateY(0)"
        }
      }}
      onMouseDown={(e) => {
        if (!disabled) {
          e.currentTarget.style.boxShadow = `0 0px 0 0 color-mix(in srgb, ${finalShadowColor} 40%, transparent)`
          e.currentTarget.style.transform = "translateY(4px)"
        }
      }}
      onMouseUp={(e) => {
        if (!disabled) {
          e.currentTarget.style.boxShadow = `0 2px 0 0 color-mix(in srgb, ${finalShadowColor} 40%, transparent)`
          e.currentTarget.style.transform = "translateY(2px)"
        }
      }}
      {...props}
    >
      {children}
    </button>
  )
}
