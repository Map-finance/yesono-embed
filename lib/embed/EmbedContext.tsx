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

export function EmbedProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);

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
