'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Toast 富信息结构(Polymarket 风格)
 * - title:主标题(如 "Buy Down placed")
 * - marketTitle:市场全名(如 "Bitcoin Up or Down - June 1, 10:45PM-10:50PM ET")
 * - detail:详情(成功 → "5.00 shares @ 5¢";失败 → 后端错误文案)
 * - persistent:true = 不自动消失,用户手动关
 */
export interface ToastMessage {
  id: string;
  type: ToastType;
  /** 主标题(三行结构第一行) */
  title?: string;
  /** 市场名(三行结构第二行,小字次色) */
  marketTitle?: string;
  /** 详情(三行结构第三行) */
  detail?: string;
  /** 不自动消失,需手动关闭 */
  persistent?: boolean;
  /** 兼容旧单行用法:简单文本 */
  message?: string;
  /** 自动消失时长,默认 3000ms;persistent=true 时忽略 */
  duration?: number;
  /** 整条 toast 可点击;点击后自动关闭。常用:点击跳市场详情 */
  onClick?: () => void;
}

/** 调用方友好的入参:可传字符串(兼容旧)或对象(新富信息) */
export type ToastInput =
  | string
  | {
      title?: string;
      message?: string;
      marketTitle?: string;
      detail?: string;
      persistent?: boolean;
      duration?: number;
      onClick?: () => void;
    };

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap = {
  success: 'bg-green-500/10 border-green-500/30 text-green-500',
  error: 'bg-red-500/10 border-red-500/30 text-red-500',
  warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
};

// 图标 + 标题主色(按类型)。用内联 hex 而非 Tailwind 类:
// 实测富信息 toast 上 text-green-500 等类不出色(被某处抑制/覆盖),
// 与 ClaimWinningsPanel 一致改用 style={{color}} 内联,保证一定上色。
const accentHexMap: Record<ToastType, string> = {
  success: '#22c55e', // 绿
  error: '#ef4444',   // 红
  warning: '#eab308', // 黄
  info: '#3b82f6',    // 蓝
};

function Toast({ toast, onClose }: ToastProps) {
  const Icon = iconMap[toast.type];
  const colorClass = colorMap[toast.type];

  // 持久 toast 不挂自动关闭定时器
  useEffect(() => {
    if (toast.persistent) return;
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, toast.persistent, onClose]);

  // 三行富信息时显示 title/marketTitle/detail;否则回退到 message 单行
  const hasRich = !!(toast.title || toast.marketTitle || toast.detail);
  const isClickable = !!toast.onClick;
  const handleClick = () => {
    if (!toast.onClick) return;
    try {
      toast.onClick();
    } finally {
      onClose(toast.id);
    }
  };

  return (
    <div
      onClick={isClickable ? handleClick : undefined}
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-xs shadow-lg animate-slide-in min-w-[280px] max-w-sm ${colorClass} ${
        isClickable ? 'cursor-pointer hover:brightness-110 transition' : ''
      }`}
    >
      <Icon
        className="w-5 h-5 shrink-0 mt-0.5"
        style={{ color: accentHexMap[toast.type] }}
      />
      {hasRich ? (
        <div className="flex-1 min-w-0 space-y-0.5">
          {toast.title && (
            <div
              className="text-sm font-semibold leading-snug"
              style={{ color: accentHexMap[toast.type] }}
            >
              {toast.title}
            </div>
          )}
          {toast.marketTitle && (
            <div className="text-xs text-(--text-secondary) leading-snug truncate">
              {toast.marketTitle}
            </div>
          )}
          {toast.detail && (
            <div className="text-xs text-(--text-tertiary) leading-snug">
              {toast.detail}
            </div>
          )}
        </div>
      ) : (
        <span className="text-sm text-(--text-primary) flex-1 min-w-0">
          {toast.message}
        </span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose(toast.id);
        }}
        className="p-1 hover:bg-white/10 rounded transition-colors shrink-0 mt-0.5"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  // 右下角(Polymarket 同款,不挡顶部市场标题/搜索)
  // 移动端避开底部 nav(MobileBottomNav 高 ~56px / lg 不显示)
  return (
    <div className="fixed bottom-4 right-4 z-9999 flex flex-col-reverse gap-2 max-w-sm lg:bottom-4 max-lg:bottom-20">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

// ============== Toast Hook ==============

let toastListeners: ((toasts: ToastMessage[]) => void)[] = [];
let toasts: ToastMessage[] = [];

/** 同时最多显示的 toast 数量。超出时挤掉最旧的非 persistent toast;若全是 persistent,挤掉最旧的那条 */
const MAX_VISIBLE_TOASTS = 3;

function updateToasts(newToasts: ToastMessage[]) {
  if (newToasts.length > MAX_VISIBLE_TOASTS) {
    // 先尝试挤掉最旧的非 persistent;否则挤掉最旧的(即使是 persistent)
    const idx = newToasts.findIndex((t) => !t.persistent);
    const dropIdx = idx >= 0 ? idx : 0;
    newToasts = [
      ...newToasts.slice(0, dropIdx),
      ...newToasts.slice(dropIdx + 1),
    ];
  }
  toasts = newToasts;
  toastListeners.forEach((listener) => listener(toasts));
}

/** 把 string | object 入参归一为 ToastMessage(除 id/type) */
function normalize(input: ToastInput): Omit<ToastMessage, 'id' | 'type'> {
  if (typeof input === 'string') {
    return { message: input };
  }
  // 对象:title / message 互通(message 当 title 用)
  return {
    title: input.title ?? input.message,
    marketTitle: input.marketTitle,
    detail: input.detail,
    persistent: input.persistent,
    duration: input.duration,
    onClick: input.onClick,
  };
}

export function useToast() {
  const [, setUpdate] = useState(0);

  useEffect(() => {
    const listener = () => setUpdate((n) => n + 1);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  const show = useCallback(
    (type: ToastType, input: ToastInput, legacyDuration?: number): string => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const fields = normalize(input);
      // 兼容旧签名:show('success', 'msg', 5000)
      if (legacyDuration !== undefined && fields.duration === undefined) {
        fields.duration = legacyDuration;
      }
      updateToasts([...toasts, { id, type, ...fields }]);
      return id;
    },
    []
  );

  const close = useCallback((id: string) => {
    updateToasts(toasts.filter((t) => t.id !== id));
  }, []);

  /** 关闭全部(用于登出 / 切账户清理) */
  const closeAll = useCallback(() => {
    updateToasts([]);
  }, []);

  const success = useCallback(
    (input: ToastInput, duration?: number) => show('success', input, duration),
    [show]
  );
  const error = useCallback(
    (input: ToastInput, duration?: number) => show('error', input, duration),
    [show]
  );
  const warning = useCallback(
    (input: ToastInput, duration?: number) => show('warning', input, duration),
    [show]
  );
  const info = useCallback(
    (input: ToastInput, duration?: number) => show('info', input, duration),
    [show]
  );

  return {
    toasts,
    show,
    close,
    closeAll,
    success,
    error,
    warning,
    info,
  };
}

// Global Toast Provider Component
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, close } = useToast();

  return (
    <>
      {children}
      <ToastContainer toasts={toasts} onClose={close} />
    </>
  );
}
