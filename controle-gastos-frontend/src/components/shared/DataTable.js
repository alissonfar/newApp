// src/components/shared/DataTable.js
// Componente de tabela headless (motor via @tanstack/react-table) com visual próprio.
//
// Responsabilidades:
//   - Render flexível: variant 'default' | 'striped' | 'glass' (preservado)
//   - Header sticky (opt-in via stickyHeader)
//   - Ordenação clicável (controlada pelo pai via sortColumn/sortDirection/onSort)
//   - Seleção de linhas (opt-in via selectable/selectedIds/onSelectionChange)
//   - Agrupamento custom (controlado pelo pai via groupBy/renderGroupHeader)
//   - Resize de colunas (TanStack columnSizingFeature) com persistência em localStorage
//   - Footer com soma condicional (opt-in via showFooter + meta.type nas colunas)
//   - Clamp de linhas (opt-in via clampLines/tooltipOnClamp)
//
// API pública (props) preservada para não regredir consumidores:
//   columns, rows, renderCell, variant, emptyMessage, onRowClick, className,
//   stickyHeader, onSort, sortColumn, sortDirection, selectable, selectedIds,
//   onSelectionChange, groupBy, renderGroupHeader, rowIdKey, clampLines, tooltipOnClamp
//
// Props novas:
//   - id (string, default 'default'): chave usada no localStorage `dataTable:columnSizing:<id>`
//   - showFooter (boolean, default false): renderiza linha de soma no rodapé
//   - footerLabel (string, default 'Total'): label exibido na primeira coluna do footer
//   - globalFilter (string): texto de busca global (filtra em todas as colunas)
//   - onColumnSizingChange (callback): estado controlado externo (opcional)

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender
} from '@tanstack/react-table';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { formatarMoeda } from '../../utils/format';
import './DataTable.css';

const SELECT_COL_WIDTH = 40;
const STORAGE_PREFIX = 'dataTable:columnSizing:';
const MIN_COL_WIDTH = 50;

/**
 * Pega o ID de uma row (compatível com _id, id, codigo)
 */
const getRowId = (row, idx) => row._id || row.id || row.codigo || idx;

/**
 * Compara dois valores para ordenação (trata string, number, date ISO).
 */
const compareValues = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') {
    const da = Date.parse(a);
    const db = Date.parse(b);
    if (!isNaN(da) && !isNaN(db)) return da - db;
  }
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true });
};

/**
 * Carrega columnSizingState do localStorage (best-effort, sem throw).
 */
const loadColumnSizing = (tableId) => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + tableId);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (_) {
    /* localStorage indisponível / parse falhou — fallback silencioso */
  }
  return {};
};

/**
 * Persiste columnSizingState no localStorage (best-effort).
 */
const saveColumnSizing = (tableId, sizing) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + tableId, JSON.stringify(sizing));
  } catch (_) {
    /* localStorage cheio / modo privado — não quebra o app */
  }
};

/**
 * Formata o valor de uma célula do footer conforme meta.type.
 */
const formatFooterValue = (type, value) => {
  if (value == null || Number.isNaN(value)) return '—';
  if (type === 'currency') return formatarMoeda(value);
  if (type === 'number') return new Intl.NumberFormat('pt-BR').format(value);
  return '—';
};

const DataTable = ({
  columns = [],   // [{ key, label, align, width, meta: { type } }]
  rows = [],
  renderCell,     // (row, column) => ReactNode (opcional)
  variant = 'default',
  emptyMessage = 'Nenhum item encontrado',
  onRowClick,
  className = '',

  // Sticky / sort (opt-in)
  stickyHeader = false,
  onSort,
  sortColumn,
  sortDirection = 'asc',

  // Seleção (opt-in)
  selectable = false,
  selectedIds,
  onSelectionChange,

  // Agrupamento custom (opt-in) — não usa TanStack grouping
  groupBy = null,
  renderGroupHeader,
  rowIdKey,

  // Clamp / tooltip (opt-in)
  clampLines = null,
  tooltipOnClamp = true,

  // Novas props
  id = 'default',
  showFooter = false,
  footerLabel = 'Total',
  globalFilter = '',
  onColumnSizingChange: onColumnSizingChangeExternal
}) => {
  // === Estado interno ===
  // Column sizing — começa do localStorage; persiste em cada mudança
  const [columnSizing, setColumnSizing] = useState(() => loadColumnSizing(id));

  // Reaplica sizing do localStorage se o id mudar
  useEffect(() => {
    setColumnSizing(loadColumnSizing(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Persiste sizing no localStorage em cada mudança
  const handleColumnSizingChange = useCallback((updater) => {
    setColumnSizing((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveColumnSizing(id, next);
      if (onColumnSizingChangeExternal) onColumnSizingChangeExternal(next);
      return next;
    });
  }, [id, onColumnSizingChangeExternal]);

  // === Ordenação controlada (vem do pai) ===
  // Mapear para o formato TanStack: array de { id, desc }
  const sortingState = useMemo(
    () => (sortColumn ? [{ id: sortColumn, desc: sortDirection === 'desc' }] : []),
    [sortColumn, sortDirection]
  );

  // Quando o pai não controla sort (sem onSort), TanStack não ordena (sorting fica no pai).
  // Quando o pai controla, sincronizamos o sorting interno com o estado dele.

  // === Construção das colunas no formato TanStack ===
  // Mantém uma "linha invisível" SELECT para o header/body alinharem (igual versão anterior)
  const tanstackColumns = useMemo(() => {
    const cols = [];
    if (selectable) {
      cols.push({
        id: '__select',
        accessor: () => null,
        header: () => null,
        cell: () => null,
        size: SELECT_COL_WIDTH,
        enableSorting: false,
        enableResizing: false
      });
    }
    columns.forEach((col) => {
      cols.push({
        id: col.key,
        accessor: (row) => row[col.key],
        header: () => col.label,
        cell: (info) => info.getValue(),
        size: typeof col.width === 'number'
          ? col.width
          : (col.width ? parseInt(col.width, 10) || undefined : undefined),
        enableSorting: !!onSort && col.key !== '__select',
        enableResizing: col.key !== '__select',
        meta: { align: col.align || 'left', type: col.meta?.type || null, columnDef: col }
      });
    });
    return cols;
  }, [columns, selectable, onSort]);

  // === Tabela TanStack (motor de sort/filter/resize) ===
  // FIX CIRÚRGICO: reordenação manual baseada no sortingState.
  // O TanStack sort não funciona porque a referência de `data` é estável entre renders
  // (o `rows` vem do backend, sempre em desc, e a referência é a mesma). Reordenamos
  // manualmente aqui para garantir que `useReactTable` receba rows em ordem diferente
  // a cada clique no header, e o TanStack pega o state.sorting de brinde.
  // Suporta strings (localeCompare pt-BR, ignora acentos, ISO dates funcionam lexicograficamente),
  // numbers e Dates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tableData = useMemo(() => {
    // Se não tem sort ativo, retorna rows original
    if (!sortingState || sortingState.length === 0) {
      return rows;
    }

    // Pega o sort ativo (só 1 coluna por vez no nosso caso)
    const { id: sortCol, desc } = sortingState[0];
    const sortDir = desc ? 'desc' : 'asc';

    // Cria cópia do array (não muta o original) e ordena
    return [...rows].sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];

      // Trata undefined/null como "vai pro final"
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Compara valores
      let comparison = 0;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        // Strings: localeCompare (pt-BR, ignora acentos, case-insensitive)
        comparison = aVal.localeCompare(bVal, 'pt-BR', { sensitivity: 'base' });
      } else if (aVal instanceof Date || bVal instanceof Date) {
        comparison = new Date(aVal).getTime() - new Date(bVal).getTime();
      } else {
        // Numbers ou outros comparáveis
        comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      }

      return sortDir === 'desc' ? -comparison : comparison;
    });
  }, [rows, sortingState]);

  const table = useReactTable({
    data: tableData,
    columns: tanstackColumns,
    state: {
      sorting: sortingState,
      columnSizing,
      globalFilter
    },
    onColumnSizingChange: handleColumnSizingChange,
    columnResizeMode: 'onEnd',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableColumnResizing: true,
    columnResizeDirection: 'ltr',
    // FIX: conectar o sort do TanStack ao onSort do pai.
    // Sem esse callback, quando o user clica no header o TanStack atualiza seu sort
    // interno mas não propaga o novo state pro pai (props.onSortingChange é undefined),
    // então no próximo render ele reverte pro state controlado antigo. Resultado:
    // o sort "pisca" e volta — user vê "nada acontece".
    // Padrão correto segundo doc oficial TanStack Table v8 (controlled sorting state).
    onSortingChange: (updaterOrValue) => {
      const newSorting = typeof updaterOrValue === 'function'
        ? updaterOrValue(sortingState)
        : updaterOrValue;

      if (Array.isArray(newSorting) && newSorting.length > 0) {
        const col = newSorting[0].id;
        const dir = newSorting[0].desc ? 'desc' : 'asc';
        onSort(col, dir);
      } else {
        onSort('data', 'desc');
      }
    },
    // Sort é client-side: o pai passa a coluna/direção desejada via sortColumn/sortDirection
    // e o TanStack reordena as rows em memória (getSortedRowModel). Sem chamada de API.
    manualSorting: false,
    manualFiltering: true, // filtro é server-side (globalFilter não é usado nesta fase)
    getRowId: (originalRow, index) =>
      rowIdKey ? originalRow[rowIdKey] : getRowId(originalRow, index)
  });

  // === Helpers de seleção (inalterado) ===
  const isSelected = useCallback((id) => {
    if (!selectedIds) return false;
    return selectedIds instanceof Set ? selectedIds.has(id) : selectedIds.includes(id);
  }, [selectedIds]);

  const toggleRow = useCallback((id) => {
    if (!onSelectionChange) return;
    const newSet = new Set(selectedIds instanceof Set ? selectedIds : (selectedIds || []));
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    onSelectionChange(newSet);
  }, [onSelectionChange, selectedIds]);

  const allRowIds = useMemo(
    () => rows.map((r, i) => rowIdKey ? r[rowIdKey] : getRowId(r, i)),
    [rows, rowIdKey]
  );

  const selectedSet = useMemo(() => {
    if (selectedIds instanceof Set) return selectedIds;
    return new Set(selectedIds || []);
  }, [selectedIds]);

  const allSelected = selectable && rows.length > 0 && allRowIds.every((id) => selectedSet.has(id));
  const someSelected = selectable && selectedSet.size > 0 && !allSelected;

  const toggleAll = useCallback(() => {
    if (!onSelectionChange) return;
    if (allSelected) {
      const newSet = new Set(selectedSet);
      allRowIds.forEach((id) => newSet.delete(id));
      onSelectionChange(newSet);
    } else {
      const newSet = new Set(selectedSet);
      allRowIds.forEach((id) => newSet.add(id));
      onSelectionChange(newSet);
    }
  }, [allSelected, allRowIds, onSelectionChange, selectedSet]);

  // === Sizing — usa sizingState do TanStack pra gerar grid-template-columns ===
  // Largura padrão = column.size, ou 200px se não tiver
  const gridTemplate = useMemo(() => {
    const cols = table.getAllColumns().map((col) => {
      const width = columnSizing[col.id] ?? col.getSize?.() ?? 200;
      // Garante mínimo
      return `${Math.max(MIN_COL_WIDTH, width)}px`;
    });
    return cols.join(' ');
  }, [table, columnSizing]);

  // === Helpers visuais ===
  const renderSortIcon = (col) => {
    if (!onSort) return null;
    const isActive = sortColumn === col.key;
    if (isActive) {
      return sortDirection === 'desc'
        ? <FaSortDown size={11} className="cg-data-table__sort-icon cg-data-table__sort-icon--active" />
        : <FaSortUp size={11} className="cg-data-table__sort-icon cg-data-table__sort-icon--active" />;
    }
    return <FaSort size={11} className="cg-data-table__sort-icon" />;
  };

  const handleHeaderClick = (col) => {
    if (onSort && col.key !== '__select') {
      onSort(col.key);
    }
  };

  // === Agrupamento (custom, preservado) ===
  const groups = useMemo(() => {
    if (!groupBy || !renderGroupHeader) return null;
    const grouped = new Map();
    rows.forEach((row) => {
      const key = row[groupBy] ?? '(vazio)';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });
    const keys = Array.from(grouped.keys()).sort((a, b) => compareValues(b, a));
    return keys.map((k) => ({ value: k, rows: grouped.get(k) }));
  }, [rows, groupBy, renderGroupHeader]);

  const hasGroups = groups && groups.length > 0;

  // === Rows visíveis (após sort/filter do TanStack) ===
  // Sem grouping: usa table.getRowModel().rows (rows reordenadas pelo sort).
  // Com grouping: usa as rows agrupadas (groupBy é custom, fora do TanStack).
  const sortedRows = useMemo(
    () => table.getRowModel().rows.map((tr) => tr.original),
    // table.getRowModel() muda quando sorting/data muda, mas a ref da função é estável
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table.getRowModel().rows, rows, sortingState]
  );

  // === Footer: soma condicional por coluna com meta.type ===
  // Soma considera apenas as linhas VISÍVEIS (respeitando groupBy se houver).
  const visibleRows = useMemo(() => {
    if (hasGroups) return groups.flatMap((g) => g.rows);
    return sortedRows;
  }, [sortedRows, groups, hasGroups]);

  const footerValues = useMemo(() => {
    if (!showFooter) return {};
    const result = {};
    columns.forEach((col) => {
      const t = col.meta?.type;
      if (t === 'currency' || t === 'number') {
        result[col.key] = visibleRows.reduce((acc, row) => {
          const raw = row[col.key];
          // Aceita number direto OU string numérica (decimais com vírgula também)
          let n = 0;
          if (typeof raw === 'number') n = raw;
          else if (typeof raw === 'string') n = parseFloat(raw.replace(',', '.')) || 0;
          return acc + n;
        }, 0);
      }
    });
    return result;
  }, [showFooter, columns, visibleRows]);

  // === Render do header ===
  const headerCols = table.getHeaderGroups()[0]?.headers.map((header) => {
    const colDef = columns.find((c) => c.key === header.column.id) || { key: header.column.id };
    const isSelect = header.column.id === '__select';
    const canSort = !isSelect && !!onSort;
    const canResize = header.column.getCanResize?.();
    const isResizing = header.column.getIsResizing?.();
    return (
      <div
        key={header.id}
        className={[
          'cg-data-table__th',
          colDef.align === 'right' ? 'cg-data-table__th--right' : '',
          canSort ? 'cg-data-table__th--sortable' : ''
        ].filter(Boolean).join(' ')}
        onClick={() => {
          if (canSort) {
            handleHeaderClick(colDef);
          }
        }}
        role={canSort ? 'button' : undefined}
        tabIndex={canSort ? 0 : undefined}
        onKeyDown={canSort ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleHeaderClick(colDef);
          }
        } : undefined}
      >
        {isSelect ? (
          <input
            type="checkbox"
            className="cg-data-table__checkbox cg-data-table__checkbox--header"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={toggleAll}
            aria-label="Selecionar todas as linhas"
          />
        ) : (
          <>
            <span className="cg-data-table__th-label">
              {flexRender(header.column.columnDef.header, header.getContext())}
            </span>
            {renderSortIcon(colDef)}
          </>
        )}
        {/* Resize handle (TanStack) — só para colunas "normais" */}
        {canResize && (
          <div
            onMouseDown={header.getResizeHandler()}
            onTouchStart={header.getResizeHandler()}
            onDoubleClick={() => header.column.resetSize()}
            className={['cg-data-table__resizer', isResizing ? 'cg-data-table__resizer--is-resizing' : ''].filter(Boolean).join(' ')}
            aria-hidden="true"
          />
        )}
      </div>
    );
  });

  // === Render de uma linha ===
  const renderRow = (row, idx) => {
    const id = rowIdKey ? row[rowIdKey] : getRowId(row, idx);
    const selected = isSelected(id);
    return (
      <div
        key={id}
        className={[
          'cg-data-table__row',
          variant === 'striped' && idx % 2 === 0 ? 'cg-data-table__row--even' : '',
          onRowClick ? 'cg-data-table__row--clickable' : '',
          selectable ? 'cg-data-table__row--selectable' : '',
          selected ? 'cg-data-table__row--selected' : ''
        ].filter(Boolean).join(' ')}
        style={{ gridTemplateColumns: gridTemplate }}
        onClick={(e) => {
          if (e.target.type === 'checkbox') return;
          if (onRowClick) onRowClick(row);
        }}
        role={onRowClick ? 'button' : undefined}
        tabIndex={onRowClick ? 0 : undefined}
      >
        {selectable && (
          <div className="cg-data-table__td cg-data-table__td--select" key="__select">
            <input
              type="checkbox"
              className="cg-data-table__checkbox"
              checked={selected}
              onChange={() => toggleRow(id)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Selecionar linha ${idx + 1}`}
            />
          </div>
        )}
        {columns.map((col) => {
          const cellValue = row[col.key];
          const cellText = cellValue == null ? '' : String(cellValue);
          const cellClasses = [
            'cg-data-table__td',
            col.align === 'right' ? 'cg-data-table__td--right' : '',
            clampLines ? 'cg-data-table__td--clamp' : ''
          ].filter(Boolean).join(' ');
          const cellStyle = clampLines ? { '--clamp-lines': clampLines } : undefined;
          const cellTitle = (clampLines && tooltipOnClamp) ? cellText : undefined;
          return (
            <div
              key={col.key}
              className={cellClasses}
              style={cellStyle}
              title={cellTitle}
            >
              {renderCell ? renderCell(row, col) : cellValue}
            </div>
          );
        })}
      </div>
    );
  };

  // === Render do footer (soma condicional) ===
  const renderFooter = () => {
    if (!showFooter) return null;
    // Primeira coluna fica vazia (label) ou com o footerLabel, demais ficam "—" exceto colunas com type
    const cells = [];
    // Coluna de seleção (se houver) — fica vazia
    if (selectable) {
      cells.push(
        <div key="__select" className="cg-data-table__footer-cell" />
      );
    }
    columns.forEach((col, idx) => {
      const t = col.meta?.type;
      const isFirstNonSelect = !selectable && idx === 0;
      if (t === 'currency' || t === 'number') {
        cells.push(
          <div
            key={col.key}
            className={[
              'cg-data-table__footer-cell',
              'cg-data-table__footer-cell--currency',
              col.align === 'right' ? 'cg-data-table__footer-cell--right' : ''
            ].filter(Boolean).join(' ')}
          >
            {isFirstNonSelect && (
              <span className="cg-data-table__footer-label">{footerLabel}: </span>
            )}
            <span className="cg-data-table__footer-value">{formatFooterValue(t, footerValues[col.key])}</span>
          </div>
        );
      } else {
        cells.push(
          <div
            key={col.key}
            className={[
              'cg-data-table__footer-cell',
              'cg-data-table__footer-cell--placeholder',
              col.align === 'right' ? 'cg-data-table__footer-cell--right' : ''
            ].filter(Boolean).join(' ')}
          >
            {isFirstNonSelect && (
              <span className="cg-data-table__footer-label">{footerLabel}</span>
            )}
          </div>
        );
      }
    });
    return (
      <div
        className="cg-data-table__footer"
        style={{ gridTemplateColumns: gridTemplate }}
        role="row"
      >
        {cells}
      </div>
    );
  };

  return (
    <div className={`cg-data-table cg-data-table--${variant} ${stickyHeader ? 'cg-data-table--sticky' : ''} ${className}`.trim()}>
      <div
        className="cg-data-table__header"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {headerCols}
      </div>
      <div className="cg-data-table__body">
        {sortedRows.length === 0 ? (
          <div className="cg-data-table__empty">{emptyMessage}</div>
        ) : hasGroups ? (
          groups.map((g, gi) => (
            <React.Fragment key={`group-${gi}`}>
              {renderGroupHeader(g.value, g.rows)}
              {g.rows.map((row, idx) => renderRow(row, idx))}
            </React.Fragment>
          ))
        ) : (
          sortedRows.map((row, idx) => renderRow(row, idx))
        )}
      </div>
      {renderFooter()}
    </div>
  );
};

export default DataTable;
