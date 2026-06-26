// src/hooks/useRelatorioFilters.js
// Hook que gerencia:
//  - draftFilters (state local, sendo editado)
//  - appliedFilters (state commitado, usado no fetch)
//  - collapsed (boolean, persistido em localStorage 'relatorio:filtersCollapsed')
//  - ações: onChange, apply, clear, toggleCollapsed
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY_COLLAPSED = 'relatorio:filtersCollapsed';

const safeReadLocalStorage = (key) => {
  try {
    return typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(key)
      : null;
  } catch {
    return null;
  }
};

const safeWriteLocalStorage = (key, value) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // silencioso — localStorage pode estar desabilitado (modo privado, etc)
  }
};

/**
 * Hook de filtros do Relatório.
 *
 * @param {object} initialFilters - Estado inicial dos filtros
 * @returns {{
 *   draftFilters: object,
 *   appliedFilters: object | null,
 *   collapsed: boolean,
 *   setDraftFilters: (filters) => void,
 *   onChange: (filters) => void,
 *   apply: () => object,         // retorna o appliedFilters novo
 *   clear: () => object,         // retorna os filtros resetados
 *   toggleCollapsed: () => void
 * }}
 */
export const useRelatorioFilters = (initialFilters) => {
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(null);

  // Colapso: começa expandido (false), a menos que localStorage diga o contrário
  const [collapsed, setCollapsed] = useState(() => {
    const stored = safeReadLocalStorage(STORAGE_KEY_COLLAPSED);
    if (stored === null) return false;
    return stored === 'true';
  });

  // Persistir mudança de collapsed em localStorage
  useEffect(() => {
    safeWriteLocalStorage(STORAGE_KEY_COLLAPSED, String(collapsed));
  }, [collapsed]);

  const onChange = useCallback((newFilters) => {
    setDraftFilters(newFilters);
  }, []);

  const apply = useCallback(() => {
    const draft = { ...draftFilters };
    setAppliedFilters(draft);
    return draft;
  }, [draftFilters]);

  const clear = useCallback(() => {
    // Reseta tagFilters mantendo o shape (chave por categoriaId)
    const reset = { ...initialFilters };
    setDraftFilters(reset);
    setAppliedFilters(null);
    return reset;
  }, [initialFilters]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  return {
    draftFilters,
    appliedFilters,
    collapsed,
    setDraftFilters,
    onChange,
    apply,
    clear,
    toggleCollapsed
  };
};

export default useRelatorioFilters;
