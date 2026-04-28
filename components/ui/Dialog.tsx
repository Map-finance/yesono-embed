"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useTranslation } from "@/lib/i18n"

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  showClose?: boolean
  closeOnOverlayClick?: boolean
  closeOnEsc?: boolean
  size?: "sm" | "md" | "lg" | "xl" | "full"
  className?: string
  overlayClassName?: string
  contentClassName?: string
}

export function Dialog({
  open,
  onOpenChange,
  children,
  title,
  description,
  footer,
  showClose = true,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  size = "md",
  className = "",
  overlayClassName = "",
  contentClassName = "",
}: DialogProps) {
  const contentRef = React.useRef<HTMLDivElement>(null)

  // 关闭对话框
  const handleClose = React.useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  // ESC 键关闭
  React.useEffect(() => {
    if (!open || !closeOnEsc) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, closeOnEsc, handleClose])

  // 阻止背景滚动
  React.useEffect(() => {
    if (open) {
      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = originalStyle
      }
    }
  }, [open])

  // 点击遮罩关闭
  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && event.target === event.currentTarget) {
      handleClose()
    }
  }

  // 尺寸映射
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    full: "max-w-full mx-4",
  }

  if (!open || typeof document === "undefined") {
    return null
  }

  return createPortal(
    <div
      className={`
        fixed inset-0 z-100
        flex items-center justify-center
        animate-in fade-in-0
        ${overlayClassName}
      `}
      onClick={handleOverlayClick}
    >
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs"
        aria-hidden="true"
      />

      {/* 对话框内容 */}
      <div
        ref={contentRef}
        className={`
          relative
          w-full ${sizeClasses[size]}
          bg-(--bg-primary)
          border border-(--border)
          rounded-lg
          shadow-xl
          animate-in zoom-in-95 slide-in-from-bottom-4
          ${className}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "dialog-title" : undefined}
        aria-describedby={description ? "dialog-description" : undefined}
      >
        {/* 关闭按钮 */}
        {showClose && (
          <button
            onClick={handleClose}
            className="
              absolute right-4 top-4
              p-1 rounded-md
              text-(--text-secondary)
              hover:text-(--text-primary)
              hover:bg-(--bg-secondary)
              transition-colors
              z-10
            "
            aria-label="Close"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15 5L5 15M5 5L15 15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {/* 标题 */}
        {title && (
          <div className="px-6 pt-6 pb-2">
            <h2
              id="dialog-title"
              className="text-xl font-semibold text-(--text-primary)"
            >
              {title}
            </h2>
            {description && (
              <p
                id="dialog-description"
                className="mt-2 text-sm text-(--text-secondary)"
              >
                {description}
              </p>
            )}
          </div>
        )}

        {/* 内容 */}
        <div className={`px-6 ${title ? "py-4" : "pt-6 pb-4"} ${contentClassName}`}>
          {children}
        </div>

        {/* 底部按钮区域 */}
        {footer && (
          <div className="px-6 py-4 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

// 便捷的确认对话框组件
export interface ConfirmDialogProps extends Omit<DialogProps, "children" | "footer"> {
  message: React.ReactNode
  confirmText?: string
  cancelText?: string | null
  confirmVariant?: "primary" | "danger"
  onConfirm: () => void | Promise<void>
  onCancel?: () => void
}

export function ConfirmDialog({
  message,
  confirmText,
  cancelText,
  confirmVariant = "primary",
  onConfirm,
  onCancel,
  onOpenChange,
  ...props
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = React.useState(false)
  const resolvedConfirmText = confirmText ?? t.market.common.confirm
  const resolvedCancelText = cancelText ?? t.market.common.cancel
  const showCancel = resolvedCancelText !== null

  const handleConfirm = async () => {
    try {
      setLoading(true)
      await onConfirm()
      onOpenChange(false)
    } catch (error) {
      console.error("ConfirmDialog onConfirm failed:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  const confirmButtonClass = confirmVariant === "danger"
    ? "text-red bg-[#312c39]"
    : "bg-(--accent) hover:bg-(--accent-hover) text-black"

  return (
    <Dialog
      {...props}
      onOpenChange={onOpenChange}
      footer={
        <div className={`flex gap-3 ${showCancel ? "" : "w-full"}`}>
          {showCancel && (
            <button
              onClick={handleCancel}
              disabled={loading}
              className="
                px-4 py-2 rounded-md
                text-(--text-primary)
                bg-(--bg-secondary)
                hover:bg-(--bg-tertiary)
                transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {resolvedCancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={loading}
            className={`
              px-4 py-2 rounded-md
              disabled:opacity-50 disabled:cursor-not-allowed
              ${showCancel ? "" : "flex-1"}
              ${confirmButtonClass}
            `}
          >
            {loading ? t.market.common.processing : resolvedConfirmText}
          </button>
        </div>
      }
    >
      <div className="text-(--text-primary)">{message}</div>
    </Dialog>
  )
}
