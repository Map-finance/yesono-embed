'use client'

import { ReactNode, useState, useRef, useEffect, useCallback, useMemo } from 'react'

interface TabItem {
  label: string
  value: string
  content?: ReactNode
}

interface TabsProps {
  items: TabItem[]
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  className?: string
  size?: 'small' | 'medium'
  rightSlot?: ReactNode
  /** 仅挂载当前激活的 tab 内容，减少非激活 tab 的渲染开销 */
  lazyContent?: boolean
}

export default function Tabs({ items, value, defaultValue, onChange, className = '', rightSlot, size = 'medium', lazyContent = false }: TabsProps) {
  const [internalTab, setInternalTab] = useState(defaultValue || items[0]?.value)
  const activeTab = value !== undefined ? value : internalTab
  
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 })
  const tabsRef = useRef<{ [key: string]: HTMLButtonElement | null }>({})
  const itemsSignature = useMemo(
    () => items.map((item) => `${item.value}:${item.label}`).join('|'),
    [items]
  )

  const updateIndicator = useCallback(() => {
    const activeButton = tabsRef.current[activeTab]
    if (!activeButton) return
    const nextLeft = activeButton.offsetLeft
    const nextWidth = activeButton.offsetWidth
    setIndicatorStyle((prev) =>
      prev.left === nextLeft && prev.width === nextWidth
        ? prev
        : { left: nextLeft, width: nextWidth }
    )
  }, [activeTab])

  const handleTabClick = (val: string) => {
    if (value === undefined) {
      setInternalTab(val)
    }
    onChange?.(val)
  }

  useEffect(() => {
    updateIndicator()
  }, [activeTab, itemsSignature, updateIndicator])

  useEffect(() => {
    const handleResize = () => updateIndicator()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [updateIndicator])

  return (
    <div className={"flex flex-col flex-1 " + className}>
      {/* Tab Headers */}
      <div className="flex items-center justify-between border-b border-(--border) relative">
        <div className={`flex items-center font-semibold ${size === 'small' ? 'px-4 gap-3' : 'px-4 gap-4'}`}>
          {items.map((item) => (
            <button
              key={item.value}
              ref={(el) => { tabsRef.current[item.value] = el }}
              onClick={() => handleTabClick(item.value)}
              className={`
                py-2 text-sm transition-colors 
                ${size === 'small' ? '' : 'py-1 h-12 text-[15px]'} 
                ${
                  activeTab === item.value
                    ? 'text-(--text-primary)'
                    : 'text-(--text-secondary) opacity-60 hover:opacity-100 hover:text-(--text-primary)'
                }
              `}
            >
              {item.label}
            </button>
          ))}
        </div>
        {rightSlot && (
            <div>{rightSlot}</div>
        )}
        {/* 滑动指示器 */}
        <div
          className="absolute bottom-0 h-[2px] bg-(--accent) transition-all duration-300 ease-out"
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
          }}
        />
      </div>

      {/* Tab Content */}
      {lazyContent
        ? (() => {
            const activeItem = items.find((i) => i.value === activeTab)
            return activeItem?.content != null ? (
              <div key={activeItem.value} className="flex-1 overflow-hidden">
                {activeItem.content}
              </div>
            ) : null
          })()
        : items.map((item) => (
            <div
              key={item.value}
              className={`flex-1 overflow-hidden ${activeTab === item.value ? 'block' : 'hidden'}`}
            >
              {item.content}
            </div>
          ))}
    </div>
  )
}
