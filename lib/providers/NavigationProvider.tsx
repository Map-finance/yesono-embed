"use client";

import React, { createContext, useContext, useState } from "react";
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
  return (
    <NavigationContext.Provider value={{ data, setData }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigationContext() {
  const ctx = useContext(NavigationContext);
  return ctx;
}

export default NavigationProvider;
