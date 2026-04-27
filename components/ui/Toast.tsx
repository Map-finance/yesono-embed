'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

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

function Toast({ toast, onClose }: ToastProps) {
  const Icon = iconMap[toast.type];
  const colorClass = colorMap[toast.type];

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onClose]);

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg animate-slide-in ${colorClass}`}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm text-[var(--text-primary)] flex-1">{toast.message}</span>
      <button
        onClick={() => onClose(toast.id)}
        className="p-1 hover:bg-white/10 rounded transition-colors"
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

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>
  );
}

// Toast Hook
let toastListeners: ((toasts: ToastMessage[]) => void)[] = [];
let toasts: ToastMessage[] = [];

function updateToasts(newToasts: ToastMessage[]) {
  toasts = newToasts;
  toastListeners.forEach((listener) => listener(toasts));
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

  const show = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    updateToasts([...toasts, { id, type, message, duration }]);
    return id;
  }, []);

  const close = useCallback((id: string) => {
    updateToasts(toasts.filter((t) => t.id !== id));
  }, []);

  const success = useCallback((message: string, duration?: number) => show('success', message, duration), [show]);
  const error = useCallback((message: string, duration?: number) => show('error', message, duration), [show]);
  const warning = useCallback((message: string, duration?: number) => show('warning', message, duration), [show]);
  const info = useCallback((message: string, duration?: number) => show('info', message, duration), [show]);

  return {
    toasts,
    show,
    close,
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
