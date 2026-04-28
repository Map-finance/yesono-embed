"use client";

// 移动端抽屉组件
import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  maxHeight?: string;
  className?: string;
}

/**
 * 通用的移动端抽屉组件
 * - 从底部向上滑出
 * - 支持点击遮罩关闭
 * - 支持下拉手势关闭
 * - 顶部拖动条指示
 */
export default function Drawer({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = "80vh",
  className = "",
}: DrawerProps) {
  const [mounted, setMounted] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const handleBarRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const isHandleBarDrag = useRef<boolean>(false);
  const drawerMoved = useRef<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 阻止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      // 关闭时清除内联样式，确保下次打开时状态正确
      if (drawerRef.current) {
        drawerRef.current.style.transform = "";
        drawerRef.current.style.transition = "";
      }
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // 使用原生事件监听器来支持 preventDefault
  useEffect(() => {
    const drawer = drawerRef.current;
    if (!drawer || !isOpen) return;

    const handleTouchMoveNative = (e: TouchEvent) => {
      if (!isDragging.current || !drawer) return;

      currentY.current = e.touches[0].clientY;
      const diff = currentY.current - startY.current;

      // 判断是否应该阻止默认行为
      const shouldPreventDefault = () => {
        // 如果是拖动条区域的拖动，总是阻止默认行为
        if (isHandleBarDrag.current) return true;
        
        // 如果是内容区域，只有在滚动到顶部且向下拖动时才阻止
        if (contentRef.current) {
          const scrollTop = contentRef.current.scrollTop;
          return scrollTop === 0 && diff > 0;
        }
        
        return false;
      };

      const shouldMove = shouldPreventDefault();

      if (shouldMove) {
        e.preventDefault();
        drawerMoved.current = true; // 标记抽屉已移动
      }

      // 只有在应该阻止默认行为时才移动抽屉
      if (shouldMove) {
        // 允许向下拖动，限制向上拖动不超过初始位置
        if (diff > 0) {
          drawer.style.transform = `translateY(${diff}px)`;
        } else {
          // 向上拖动时，弹回原位
          drawer.style.transform = "translateY(0)";
        }
      }
    };

    const handleTouchEndNative = () => {
      if (!isDragging.current || !drawer) return;

      const diff = currentY.current - startY.current;

      // 恢复过渡动画
      drawer.style.transition = "";

      // 只有在抽屉实际移动过的情况下才允许通过拖动关闭
      if (drawerMoved.current && diff > 100) {
        // 清除内联样式，让 CSS transition 接管
        drawer.style.transform = "";
        onClose();
      } else {
        // 否则弹回原位
        drawer.style.transform = "translateY(0)";
      }

      isDragging.current = false;
      startY.current = 0;
      currentY.current = 0;
      drawerMoved.current = false;
    };

    // 绑定到 document 而不是 drawer，这样手指移出抽屉区域也能继续跟踪
    document.addEventListener("touchmove", handleTouchMoveNative, {
      passive: false,
    });
    document.addEventListener("touchend", handleTouchEndNative);
    document.addEventListener("touchcancel", handleTouchEndNative);

    return () => {
      document.removeEventListener("touchmove", handleTouchMoveNative);
      document.removeEventListener("touchend", handleTouchEndNative);
      document.removeEventListener("touchcancel", handleTouchEndNative);
    };
  }, [isOpen, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    
    // 判断触摸是否开始于拖动条区域
    isHandleBarDrag.current = handleBarRef.current?.contains(target) || false;
    
    startY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY;
    isDragging.current = true;
    drawerMoved.current = false; // 重置抽屉移动标记
    
    // 拖动时禁用过渡动画，使其跟手
    if (drawerRef.current) {
      drawerRef.current.style.transition = "none";
    }
  };

  // 保留这个空的 handleTouchEnd 以移除 JSX 中的引用
  // 实际的 touchend 处理在 useEffect 中的原生监听器里

  if (!mounted) return null;

  const drawer = (
    <>
      {/* 遮罩层 */}
      <div
        className={`fixed inset-0 bg-black/50 z-9998 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        } ${className}`}
        onClick={onClose}
      />

      {/* 抽屉内容 */}
      <div
        ref={drawerRef}
        className={`fixed bottom-0 left-0 right-0 bg-(--bg-primary) rounded-t-2xl z-9999 transition-transform duration-300 ease-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        } ${className}`}
        style={{ maxHeight }}
        onTouchStart={handleTouchStart}
      >
        {/* 拖动指示条 */}
        <div ref={handleBarRef} className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-(--text-tertiary) rounded-full opacity-50" />
        </div>

        {/* 标题 */}
        {title && (
          <div className="px-6 py-3">
            <h3 className="text-lg font-semibold text-(--text-primary) flex items-center gap-2">
              {title}
            </h3>
          </div>
        )}

        {/* 内容区域 */}
        <div ref={contentRef} className="overflow-y-auto scrollbar-hide" style={{ maxHeight: "calc(80vh - 80px)" }}>
          {children}
        </div>
      </div>
    </>
  );

  return createPortal(drawer, document.body);
}
