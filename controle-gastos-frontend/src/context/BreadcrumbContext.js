import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const BreadcrumbContext = createContext(null);

export function BreadcrumbProvider({ children }) {
  const [overrideLabel, setOverrideLabel] = useState(null);

  const setBreadcrumbOverride = useCallback((label) => {
    setOverrideLabel(typeof label === 'string' ? label : null);
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ overrideLabel, setBreadcrumbOverride }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbContext() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    return { overrideLabel: null, setBreadcrumbOverride: () => {} };
  }
  return ctx;
}

/**
 * Hook para páginas de detalhe registrarem o label dinâmico do breadcrumb.
 * Chama setBreadcrumbOverride ao montar e limpa no cleanup.
 * @param {string|null} label - Nome da entidade (ex: vinculo?.nome, subconta?.nome)
 */
export function useBreadcrumbOverride(label) {
  const { setBreadcrumbOverride } = useBreadcrumbContext();

  useEffect(() => {
    setBreadcrumbOverride(label);
    return () => setBreadcrumbOverride(null);
  }, [label, setBreadcrumbOverride]);
}
