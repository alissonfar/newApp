import React, { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Box, Breadcrumbs, Typography, Link as MuiLink, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  menuStructure,
  buildParentMap,
  findLabelInMenu,
  humanizeSegment,
} from '../Layout/menuStructure';
import { useBreadcrumbContext } from '../../context/BreadcrumbContext';

/**
 * Resolve a hierarquia de qualquer pathname em uma chain de { path, label }.
 * Estratégia: sobe via parentMap. Se a rota for dinâmica (filha com :id) e
 * não estiver no map, encontra o ancestral mais próximo removendo o último
 * segmento e adiciona o ancestral descoberto como item intermediário.
 *
 * Para cada nível o label é resolvido na ordem:
 *   1. dynamicLabels.get(path)       (registrado por useBreadcrumbTrailing)
 *   2. findLabelInMenu(path, ...)    (label canônico do menuStructure)
 *   3. humanizeSegment(path)         (fallback final)
 */
function buildBreadcrumbItems(pathname, parentMap, dynamicLabels) {
  // Caso raiz: '/'
  if (pathname === '/' || pathname === '') {
    return [{ path: '/', label: 'Home', isLast: true }];
  }

  // Helper: resolve o label de um path com a mesma ordem de prioridade
  // usada pelo breadcrumb.
  const resolveLabel = (p) => {
    return (
      dynamicLabels.get(p) ||
      findLabelInMenu(p, menuStructure) ||
      humanizeSegment(p)
    );
  };

  // Helper: dado um path, acha o ancestral mais próximo que está no parentMap.
  // Retorna o ancestral (path conhecido) e o "resto" dinâmico a ser tratado
  // como item próprio. Ex: '/emprestimos/abc123' → ancestor '/emprestimos',
  // remainder '/emprestimos/abc123'.
  const findAncestor = (p) => {
    const segments = p.split('/').filter(Boolean);
    for (let i = segments.length - 1; i > 0; i--) {
      const candidate = '/' + segments.slice(0, i).join('/');
      if (parentMap.has(candidate)) {
        return { ancestor: candidate, remainder: p };
      }
    }
    return null;
  };

  // Se o pathname não está no parentMap (rota dinâmica), insere o ancestral
  // encontrado como item intermediário antes de subir.
  if (!parentMap.has(pathname)) {
    const found = findAncestor(pathname);
    if (found) {
      const ancestorLabel = resolveLabel(found.ancestor);
      // O item atual (pathname) é sempre o último.
      const lastLabel = resolveLabel(pathname);
      // Sobe a partir do ancestral.
      const rest = buildChainFromPath(found.ancestor, parentMap, dynamicLabels, resolveLabel);
      return [
        ...rest,
        { path: pathname, label: lastLabel, isLast: true },
      ].map((item, index, arr) => ({
        ...item,
        isLast: index === arr.length - 1,
      }));
      // O ancestorLabel já vem de rest (incluindo a chain acima).
      void ancestorLabel; // silenciar lint
    }
  }

  return buildChainFromPath(pathname, parentMap, dynamicLabels, resolveLabel);
}

/**
 * Sobe a chain a partir de um path que está no parentMap.
 * Adiciona Home no topo se a chain não incluir raiz.
 */
function buildChainFromPath(pathname, parentMap, dynamicLabels, resolveLabel) {
  const chain = [];
  let current = pathname;
  let safetyCounter = 0;
  const MAX_DEPTH = 20;

  while (current && current !== '/' && safetyCounter < MAX_DEPTH) {
    const parent = parentMap.get(current);
    const label = resolveLabel(current);
    // unshift: queremos a chain na ordem raiz → atual.
    chain.unshift({ path: current, label, isLast: false });
    current = parent;
    safetyCounter++;
  }

  // Adiciona Home no topo (se ainda não estiver).
  const hasHome = chain.some((item) => item.path === '/');
  if (!hasHome) {
    chain.unshift({ path: '/', label: 'Home', isLast: false });
  }

  // Marca o último item.
  if (chain.length > 0) {
    chain[chain.length - 1].isLast = true;
  }

  return chain;
}

function BreadcrumbsNav() {
  const location = useLocation();
  const { dynamicLabels } = useBreadcrumbContext();
  const pathname = location.pathname;
  const theme = useTheme();

  // Desktop (>= md) usa maxItems=4 com itemsAfterCollapse=2.
  // Mobile (< md) usa maxItems=3 com itemsAfterCollapse=1.
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const maxItems = isMobile ? 3 : 4;
  const itemsAfterCollapse = isMobile ? 1 : 2;

  // Memoiza o parentMap (estável enquanto menuStructure não muda).
  const parentMap = useMemo(() => buildParentMap(menuStructure), []);

  // Memoiza a chain de itens.
  const items = useMemo(
    () => buildBreadcrumbItems(pathname, parentMap, dynamicLabels),
    [pathname, parentMap, dynamicLabels]
  );

  if (items.length === 0) return null;

  return (
    <Box
      sx={{
        mb: 2,
        px: isMobile ? 1 : 1.5,
        py: 1,
        borderRadius: 'var(--cg-radius-md)',
        backgroundColor: 'var(--cg-color-surface)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--cg-color-border)',
      }}
    >
      <Breadcrumbs
        separator="·"
        aria-label="breadcrumb"
        maxItems={maxItems}
        itemsBeforeCollapse={1}
        itemsAfterCollapse={itemsAfterCollapse}
        sx={{
          fontSize: 'var(--cg-font-size-sm)',
          '& .MuiBreadcrumbs-separator': {
            mx: 1,
            color: 'var(--cg-color-text-muted)',
          },
        }}
      >
        {items.map((item, index) =>
          item.isLast ? (
            <Typography
              key={item.path || `last-${index}`}
              component="span"
              sx={{
                color: 'var(--cg-color-text-primary)',
                fontWeight: 600,
                fontSize: 'var(--cg-font-size-sm)',
              }}
              aria-current="page"
            >
              {item.label}
            </Typography>
          ) : (
            <MuiLink
              key={item.path || `item-${index}`}
              component={Link}
              to={item.path}
              underline="hover"
              sx={{
                color: 'var(--cg-color-text-secondary)',
                fontWeight: 500,
                fontSize: 'var(--cg-font-size-sm)',
                px: 0.5,
                py: 0.25,
                borderRadius: 'var(--cg-radius-sm)',
                textDecoration: 'none',
                transition: 'background-color 150ms ease',
                '&:hover': {
                  backgroundColor: 'var(--cg-color-surface-elevated)',
                  textDecoration: 'none',
                },
              }}
            >
              {item.label}
            </MuiLink>
          )
        )}
      </Breadcrumbs>
    </Box>
  );
}

export default BreadcrumbsNav;
