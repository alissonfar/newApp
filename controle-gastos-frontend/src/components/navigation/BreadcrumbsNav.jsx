import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Breadcrumbs, Typography } from '@mui/material';
import { breadcrumbMap } from '../../config/breadcrumbConfig';
import { useBreadcrumbContext } from '../../context/BreadcrumbContext';

/**
 * Detecta se um segmento parece ser um ID (MongoDB ObjectId ou UUID).
 */
function looksLikeId(segment) {
  if (!segment || typeof segment !== 'string') return false;
  return /^[a-fA-F0-9]{24}$/.test(segment) || /^[a-fA-F0-9-]{36}$/.test(segment);
}

/**
 * Monta os itens do breadcrumb a partir do pathname atual.
 */
function buildBreadcrumbItems(pathname, overrideLabel) {
  const segments = pathname.split('/').filter(Boolean);
  const items = [];

  if (segments.length === 0) {
    return [{ path: '/', label: breadcrumbMap['/'] || 'Home', isLast: true }];
  }

  let accumulatedPath = '';
  for (let i = 0; i < segments.length; i++) {
    accumulatedPath += (accumulatedPath ? '/' : '/') + segments[i];
    const isLast = i === segments.length - 1;
    const isDynamicSegment = isLast && looksLikeId(segments[i]);

    let label;
    if (isDynamicSegment) {
      label = overrideLabel || 'Detalhe';
    } else {
      label = breadcrumbMap[accumulatedPath] || segments[i];
    }

    items.push({ path: accumulatedPath, label, isLast });
  }

  return items;
}

/**
 * Retorna o array completo com Home sempre como primeiro item (exceto quando já na raiz).
 */
function getFullBreadcrumbItems(pathname, overrideLabel) {
  const items = buildBreadcrumbItems(pathname, overrideLabel);
  if (pathname === '/' || pathname === '') {
    return items;
  }
  return [{ path: '/', label: breadcrumbMap['/'] || 'Home', isLast: false }, ...items];
}

function BreadcrumbsNav() {
  const location = useLocation();
  const { overrideLabel } = useBreadcrumbContext();
  const pathname = location.pathname;

  const items = getFullBreadcrumbItems(pathname, overrideLabel);

  if (items.length === 0) return null;

  return (
    <Breadcrumbs
      separator="›"
      aria-label="breadcrumb"
      sx={{
        mb: 2,
        fontSize: '0.9rem',
        '& .MuiBreadcrumbs-separator': { mx: 0.5 },
      }}
    >
      {items.map((item, index) =>
        item.isLast ? (
          <Typography
            key={item.path}
            color="text.secondary"
            sx={{ fontSize: '0.9rem', fontWeight: 500 }}
          >
            {item.label}
          </Typography>
        ) : (
          <Link
            key={item.path}
            to={item.path}
            style={{
              color: 'inherit',
              textDecoration: 'none',
              fontSize: '0.9rem',
            }}
            sx={{
              '&:hover': { textDecoration: 'underline' },
            }}
          >
            {item.label}
          </Link>
        )
      )}
    </Breadcrumbs>
  );
}

export default BreadcrumbsNav;
