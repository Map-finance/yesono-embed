"use client"

import * as React from "react"
import { createPortal } from "react-dom"

export interface PopoverProps {
  children: React.ReactNode | ((props: { isOpen: boolean }) => React.ReactNode)
  content: React.ReactNode | ((props: { isOpen: boolean; close: () => void }) => React.ReactNode)
  trigger?: "click" | "hover"
  placement?: 
    | "top" | "bottom" | "left" | "right" | "auto"
    | "top-left" | "top-right"
    | "bottom-left" | "bottom-right"
    | "left-top" | "left-bottom"
    | "right-top" | "right-bottom"
  offset?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  contentClassName?: string
  matchWidth?: boolean
}

export function Popover({
  children,
  content,
  trigger = "click",
  placement = "auto",
  offset = 8,
  open: controlledOpen,
  onOpenChange,
  className = "",
  contentClassName = "",
  matchWidth = false,
}: PopoverProps) {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [position, setPosition] = React.useState({ top: 0, left: 0 })
  const [triggerWidth, setTriggerWidth] = React.useState<number | undefined>(undefined)
  const [actualPlacement, setActualPlacement] = React.useState(placement || "auto")
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const timeoutRef = React.useRef<NodeJS.Timeout>()

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const setOpen = React.useCallback((value: boolean) => {
    if (!isControlled) {
      setInternalOpen(value)
    }
    onOpenChange?.(value)
  }, [isControlled, onOpenChange])

  const calculatePosition = React.useCallback(() => {
    if (!triggerRef.current || !contentRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const contentRect = contentRef.current.getBoundingClientRect()
    
    // 如果contentRect还没有正确渲染，稍后重试
    if (contentRect.width === 0 || contentRect.height === 0) {
      requestAnimationFrame(() => calculatePosition())
      return
    }
    
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    }

    const margin = 8 // 距离视口边缘的最小距离

    // 解析 placement（支持组合如 "right-top"）
    const [mainPlacement, subPlacement] = placement.split("-") as [string, string?]

    // 计算各个方向的可用空间
    const spaceTop = triggerRect.top
    const spaceBottom = viewport.height - triggerRect.bottom
    const spaceLeft = triggerRect.left
    const spaceRight = viewport.width - triggerRect.right

    let finalPlacement: Exclude<PopoverProps["placement"], undefined> =
      mainPlacement === "auto" ? "bottom" : (mainPlacement as Exclude<PopoverProps["placement"], undefined>)
    let finalSubPlacement = subPlacement
    let top = 0
    let left = 0

    // 智能选择最佳位置（包含 flip 逻辑）
    if (mainPlacement === "auto" || mainPlacement === "bottom" || mainPlacement === "top") {
      const contentHeight = contentRect.height || 200
      
      // 优先使用用户指定的方向
      let preferredPlacement = mainPlacement === "auto" ? "bottom" : mainPlacement
      
      // 检查首选方向是否有足够空间
      if (preferredPlacement === "bottom") {
        if (spaceBottom >= contentHeight + offset + margin) {
          finalPlacement = "bottom"
        } else if (spaceTop >= contentHeight + offset + margin) {
          // flip 到相反方向
          finalPlacement = "top"
        } else {
          // 两边空间都不够，选择空间较大的一侧
          finalPlacement = spaceBottom >= spaceTop ? "bottom" : "top"
        }
      } else if (preferredPlacement === "top") {
        if (spaceTop >= contentHeight + offset + margin) {
          finalPlacement = "top"
        } else if (spaceBottom >= contentHeight + offset + margin) {
          // flip 到相反方向
          finalPlacement = "bottom"
        } else {
          // 两边空间都不够，选择空间较大的一侧
          finalPlacement = spaceTop >= spaceBottom ? "top" : "bottom"
        }
      } else {
        // auto 模式
        if (spaceBottom >= contentHeight + offset + margin) {
          finalPlacement = "bottom"
        } else if (spaceTop >= contentHeight + offset + margin) {
          finalPlacement = "top"
        } else if (spaceRight >= contentRect.width + offset + margin) {
          finalPlacement = "right"
        } else if (spaceLeft >= contentRect.width + offset + margin) {
          finalPlacement = "left"
        } else {
          finalPlacement = spaceBottom >= spaceTop ? "bottom" : "top"
        }
      }
    } else if (mainPlacement === "left" || mainPlacement === "right") {
      const contentWidth = contentRect.width || 200
      
      if (mainPlacement === "right") {
        if (spaceRight >= contentWidth + offset + margin) {
          finalPlacement = "right"
        } else if (spaceLeft >= contentWidth + offset + margin) {
          // flip 到相反方向
          finalPlacement = "left"
        } else {
          finalPlacement = spaceRight >= spaceLeft ? "right" : "left"
        }
      } else {
        if (spaceLeft >= contentWidth + offset + margin) {
          finalPlacement = "left"
        } else if (spaceRight >= contentWidth + offset + margin) {
          // flip 到相反方向
          finalPlacement = "right"
        } else {
          finalPlacement = spaceLeft >= spaceRight ? "left" : "right"
        }
      }
    }

    // 根据最终位置和子位置计算坐标
    switch (finalPlacement) {
      case "top":
        top = triggerRect.top - contentRect.height - offset
        // 处理子位置（left/right）
        if (finalSubPlacement === "left") {
          left = triggerRect.left
        } else if (finalSubPlacement === "right") {
          left = triggerRect.right - contentRect.width
        } else {
          // 默认居中
          left = triggerRect.left + triggerRect.width / 2 - contentRect.width / 2
        }
        break
      case "bottom":
        top = triggerRect.bottom + offset
        // 处理子位置（left/right）
        if (finalSubPlacement === "left") {
          left = triggerRect.left
        } else if (finalSubPlacement === "right") {
          left = triggerRect.right - contentRect.width
        } else {
          // 默认居中
          left = triggerRect.left + triggerRect.width / 2 - contentRect.width / 2
        }
        break
      case "left":
        left = triggerRect.left - contentRect.width - offset
        // 处理子位置（top/bottom）
        if (finalSubPlacement === "top") {
          top = triggerRect.top
        } else if (finalSubPlacement === "bottom") {
          top = triggerRect.bottom - contentRect.height
        } else {
          // 默认居中
          top = triggerRect.top + triggerRect.height / 2 - contentRect.height / 2
        }
        break
      case "right":
        left = triggerRect.right + offset
        // 处理子位置（top/bottom）
        if (finalSubPlacement === "top") {
          top = triggerRect.top
        } else if (finalSubPlacement === "bottom") {
          top = triggerRect.bottom - contentRect.height
        } else {
          // 默认居中
          top = triggerRect.top + triggerRect.height / 2 - contentRect.height / 2
        }
        break
    }

    // 水平方向边界调整（不改变主方向）
    if (finalPlacement === "top" || finalPlacement === "bottom") {
      const minLeft = margin
      const maxLeft = viewport.width - contentRect.width - margin
      
      // 检查是否会超出右边界，如果超出很多，考虑左对齐
      if (left > maxLeft) {
        // 尝试左对齐到trigger
        const leftAligned = triggerRect.left
        if (leftAligned >= minLeft && leftAligned + contentRect.width <= viewport.width - margin) {
          left = leftAligned
        } else {
          // 尝试右对齐到trigger
          const rightAligned = triggerRect.right - contentRect.width
          if (rightAligned >= minLeft) {
            left = rightAligned
          } else {
            left = maxLeft
          }
        }
      } else if (left < minLeft) {
        left = minLeft
      }
    }

    // 垂直方向边界调整（不改变主方向）
    if (finalPlacement === "left" || finalPlacement === "right") {
      const minTop = margin
      const maxTop = viewport.height - contentRect.height - margin
      
      if (top < minTop) {
        top = minTop
      } else if (top > maxTop) {
        top = maxTop
      }
    }

    // 最终边界保护（确保不超出视口）
    top = Math.max(margin, Math.min(top, viewport.height - contentRect.height - margin))
    left = Math.max(margin, Math.min(left, viewport.width - contentRect.width - margin))

    setPosition({ top, left })
    setActualPlacement(finalPlacement)
  }, [placement, offset])

  // 更新位置
  React.useLayoutEffect(() => {
    if (isOpen) {
      if (triggerRef.current && matchWidth) {
        setTriggerWidth(triggerRef.current.offsetWidth);
      }
      calculatePosition()

      const handleResize = () => {
         if (triggerRef.current && matchWidth) {
           setTriggerWidth(triggerRef.current.offsetWidth);
         }
         calculatePosition()
      }
      const handleScroll = () => calculatePosition()

      window.addEventListener("resize", handleResize)
      window.addEventListener("scroll", handleScroll, true)

      return () => {
        window.removeEventListener("resize", handleResize)
        window.removeEventListener("scroll", handleScroll, true)
      }
    }
  }, [isOpen, calculatePosition, matchWidth, triggerWidth])

  // 点击外部关闭
  React.useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        contentRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        !contentRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    // 使用 click 而不是 mousedown，确保 onClick 先执行
    document.addEventListener("click", handleClickOutside)
    return () => document.removeEventListener("click", handleClickOutside)
  }, [isOpen, setOpen])

  const handleTriggerClick = () => {
    if (trigger === "click") {
      setOpen(!isOpen)
    }
  }

  const handleMouseEnter = () => {
    if (trigger === "hover") {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      setOpen(true)
    }
  }

  const handleMouseLeave = () => {
    if (trigger === "hover") {
      timeoutRef.current = setTimeout(() => {
        setOpen(false)
      }, 100)
    }
  }

  const childrenContent = typeof children === 'function' 
    ? children({ isOpen }) 
    : children;

  const close = React.useCallback(() => {
    setOpen(false);
  }, [setOpen]);

  const contentElement = typeof content === 'function'
    ? content({ isOpen, close })
    : content;

  return (
    <>
      <div
        ref={triggerRef}
        onClick={handleTriggerClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={className}
      >
        {childrenContent}
      </div>

      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={contentRef}
            className={`
              fixed
              bg-[var(--bg-primary)]
              border border-[var(--border)]
              rounded-md
              shadow-md
              z-[9999]
              animate-in fade-in-0 zoom-in-95
              ${contentClassName}
            `}
            style={{
              top: `${position.top}px`,
              left: `${position.left}px`,
              width: matchWidth ? triggerWidth : undefined,
            }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {contentElement}
          </div>,
          document.body
        )}
    </>
  )
}
