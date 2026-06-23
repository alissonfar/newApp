// src/hooks/useThemeMode.js
// Hook que gerencia o modo de tema (light/dark) do app.
// Persiste a escolha do usuário em localStorage (chave 'cg:theme') e
// aplica data-theme="light|dark" no <html>, para que tokens.css
// ([data-theme="dark"] { ... }) troque as CSS variables.
//
// No primeiro acesso (sem nada no localStorage), respeita a preferência
// do sistema operacional (prefers-color-scheme).

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'cg:theme';

const getInitialMode = () => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useThemeMode = () => {
  const [mode, setMode] = useState(getInitialMode);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, mode);
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const toggle = useCallback(() => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return { mode, toggle, setMode };
};
