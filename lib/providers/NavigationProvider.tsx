"use client";

import React, { createContext, useContext, useMemo, useState } from "react";
import type { NavigationItem } from "@/types/home";

interface NavigationContextValue {
  data: NavigationItem[] | null;
  setData: (d: NavigationItem[] | null) => void;
}

const NavigationContext = createContext<NavigationContextValue | undefined>(undefined);

export function NavigationProvider({ children, initialData }: { children: React.ReactNode; initialData?: NavigationItem[] }) {
  const [data, setData] = useState<NavigationItem[] | null>(initialData ?? null);

  // keep state in sync when server provides new initialData after router.refresh()
  React.useEffect(() => {
    if (initialData) setData(initialData);
  }, [initialData]);

  // setData 是 useState setter,引用稳定;只在 data 变化时重建 value,避免
  // 父级 re-render 触发 Header / AdaptiveNav 等消费者全量重渲。
  const value = useMemo(() => ({ data, setData }), [data]);

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigationContext() {
  const ctx = useContext(NavigationContext);
  return ctx;
}

export default NavigationProvider;
