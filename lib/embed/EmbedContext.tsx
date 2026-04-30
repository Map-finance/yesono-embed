"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type EmbedState = {
  token: string | null;
  setToken: (token: string | null) => void;
};

const EmbedContext = createContext<EmbedState>({
  token: null,
  setToken: () => {},
});

let externalTokenGetter: () => string | null = () => null;

export function getEmbedToken(): string | null {
  return externalTokenGetter();
}

// 仅本地开发期 fallback：线上构建（NODE_ENV=production）下编译期常量为 null，
// 不会把 token 打进 bundle。线上 iframe 仍走 ?token= / postMessage 注入真 token。
const DEV_FALLBACK_TOKEN: string | null =
  process.env.NODE_ENV === 'development'
    ? process.env.NEXT_PUBLIC_EMBED_DEV_TOKEN || null
    : null;

export function EmbedProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(DEV_FALLBACK_TOKEN);

  useEffect(() => {
    externalTokenGetter = () => token;
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const queryToken = url.searchParams.get('token');
    if (queryToken) setToken(queryToken);

    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'yesono-embed:set-token' && typeof data.token === 'string') {
        setToken(data.token);
      }
      if (data.type === 'yesono-embed:clear-token') {
        setToken(null);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <EmbedContext.Provider value={{ token, setToken }}>{children}</EmbedContext.Provider>
  );
}

export function useEmbed() {
  return useContext(EmbedContext);
}
