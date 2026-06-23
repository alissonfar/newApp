// src/components/shared/DataTable.js
import React from 'react';
import './DataTable.css';

/**
 * DataTable - Tabela flexível em grid (não usa <table> pra ser estilizada como cards)
 *
 * @param {Array} columns - [{ key, label, align ('left'|'right'), width }]
 * @param {Array} rows - Array de objetos
 * @param {function} renderCell - (row, column) => ReactNode (opcional)
 * @param {string} variant - 'default' | 'striped' | 'glass'
 * @param {string} emptyMessage - Texto quando rows.length === 0
 * @param {function} onRowClick - Handler chamado com a row
 * @param {string} className - Classe extra
 */
const DataTable = ({
  columns, // [{ key, label, align, width }]
  rows,    // array de objetos
  renderCell, // (row, column) => ReactNode (opcional)
  variant = 'default', // 'default' | 'striped' | 'glass'
  emptyMessage = 'Nenhum item encontrado',
  onRowClick,
  className = '',
}) => {
  const gridTemplate = columns.map(c => c.width || '1fr').join(' ');

  return (
    <div className={`cg-data-table cg-data-table--${variant} ${className}`.trim()}>
      <div className="cg-data-table__header" style={{ gridTemplateColumns: gridTemplate }}>
        {columns.map(col => (
          <div
            key={col.key}
            className={`cg-data-table__th ${col.align === 'right' ? 'cg-data-table__th--right' : ''}`}
          >
            {col.label}
          </div>
        ))}
      </div>
      <div className="cg-data-table__body">
        {rows.length === 0 ? (
          <div className="cg-data-table__empty">{emptyMessage}</div>
        ) : (
          rows.map((row, idx) => (
            <div
              key={row._id || row.id || idx}
              className={[
                'cg-data-table__row',
                variant === 'striped' && idx % 2 === 0 ? 'cg-data-table__row--even' : '',
                onRowClick ? 'cg-data-table__row--clickable' : '',
              ].filter(Boolean).join(' ')}
              style={{ gridTemplateColumns: gridTemplate }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
            >
              {columns.map(col => (
                <div
                  key={col.key}
                  className={`cg-data-table__td ${col.align === 'right' ? 'cg-data-table__td--right' : ''}`}
                >
                  {renderCell ? renderCell(row, col) : row[col.key]}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DataTable;
