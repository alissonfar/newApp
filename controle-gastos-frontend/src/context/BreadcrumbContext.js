import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BreadcrumbContext = createContext(null);

export function BreadcrumbProvider({ children }) {
  // MAP de pathname → label dinâmico. Não é singleton global.
  // Cada página de detalhe registra seu label sob a key da PRÓPRIA rota,
  // então uma página não consegue mais sobrescrever a label de outra.
  const [dynamicLabels, setDynamicLabels] = useState(() => new Map());

  // Registra/atualiza o label da rota atual. Idempotente.
  const setDynamicLabel = useCallback((pathname, label) => {
    setDynamicLabels((prev) => {
      const next = new Map(prev);
      if (label && typeof label === 'string') {
        next.set(pathname, label);
      } else {
        next.delete(pathname);
      }
      return next;
    });
  }, []);

  // Remove o label de uma rota específica (cleanup).
  const clearDynamicLabel = useCallback((pathname) => {
    setDynamicLabels((prev) => {
      if (!prev.has(pathname)) return prev;
      const next = new Map(prev);
      next.delete(pathname);
      return next;
    });
  }, []);

  return (
    <BreadcrumbContext.Provider value={{ dynamicLabels, setDynamicLabel, clearDynamicLabel }}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbContext() {
  const ctx = useContext(BreadcrumbContext);
  if (!ctx) {
    // Fallback silencioso: se o provider não estiver acima, devolve MAP vazio
    // e no-op setters. Garante que o componente não quebra em testes isolados.
    return {
      dynamicLabels: new Map(),
      setDynamicLabel: () => {},
      clearDynamicLabel: () => {},
    };
  }
  return ctx;
}

/**
 * Hook para páginas de detalhe registrarem o label dinâmico do breadcrumb.
 * Substitui o antigo useBreadcrumbOverride (singleton global, com race condition).
 *
 * Comportamento:
 * - Registra label sob a key do pathname atual (escopo de rota).
 * - Cleanup só dispara se a rota que registrou AINDA É a ativa.
 *   O guard `window.location.pathname === pathname` resolve a race condition
 *   quando o usuário navega entre dois detalhes em sequência rápida:
 *   o cleanup da rota antiga vê que a URL atual é outra e NÃO apaga o label novo.
 *
 * @param {string|null} label - Nome da entidade (ex: vinculo?.nome, subconta?.nome)
 */
export function useBreadcrumbTrailing(label) {
  const { setDynamicLabel, clearDynamicLabel } = useBreadcrumbContext();
  const location = useLocation();
  const pathname = location.pathname;

  useEffect(() => {
    if (!label) return;
    setDynamicLabel(pathname, label);
    return () => {
      // Verifica se a rota que registrou ainda é a ativa.
      // Se o usuário já navegou pra outra, NÃO limpa — outra página
      // pode ter registrado label novo e seria sobrescrita.
      if (typeof window !== 'undefined' && window.location.pathname === pathname) {
        clearDynamicLabel(pathname);
      }
    };
  }, [label, pathname, setDynamicLabel, clearDynamicLabel]);
}
