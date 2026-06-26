import React from 'react';
import { FaTimes } from 'react-icons/fa';
import { formatarMoeda } from '../../utils/format';
import Button from './Button';
import './BulkActionBar.css';

/**
 * Barra de ações em massa - padrão Gmail/Notion/SaaS.
 * Exibida quando há itens selecionados.
 *
 * Props novas (opt-in):
 *  - selectedSummary: { [key]: number } | null
 *      Mapa de chave → valor somado das linhas selecionadas. Quando informado
 *      E há seleção, exibe o(s) total(is) ao lado do contador.
 *      Ex: { valor: 1234.56 }
 *
 *  - summaryFormatter: (key, value) => { label, formatted } | null
 *      Callback opcional pra customizar como cada entrada é exibida. Se omitido,
 *      usa o formatter padrão: label = key capitalizado, value = formatarMoeda().
 *      Ex: (key, value) => ({ label: 'Total', formatted: formatarMoeda(value) })
 */
const BulkActionBar = ({
  selectedCount,
  totalCount,
  onClearSelection,
  onSelectAll,
  actions = [],
  className = '',
  selectedSummary = null,
  summaryFormatter = null
}) => {
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  const hasSummary = selectedSummary && typeof selectedSummary === 'object' && selectedCount > 0;

  return (
    <div className={`bulk-action-bar ${className}`.trim()}>
      <div className="bulk-action-bar__info">
        <span className="bulk-action-bar__count">
          {selectedCount} {selectedCount === 1 ? 'selecionada' : 'selecionadas'}
        </span>
        {hasSummary && (
          <span className="bulk-action-bar__summary">
            {Object.entries(selectedSummary).map(([key, value]) => {
              if (summaryFormatter) {
                const formatted = summaryFormatter(key, value);
                return (
                  <span key={key} className="bulk-action-bar__summary-item">
                    <span className="bulk-action-bar__summary-label">
                      {formatted.label}:
                    </span>{' '}
                    <span className="bulk-action-bar__summary-value">
                      {formatted.formatted}
                    </span>
                  </span>
                );
              }
              // Default: label = key capitalizado, value = formatarMoeda
              const label = key.charAt(0).toUpperCase() + key.slice(1);
              return (
                <span key={key} className="bulk-action-bar__summary-item">
                  <span className="bulk-action-bar__summary-label">{label}:</span>{' '}
                  <span className="bulk-action-bar__summary-value">
                    {formatarMoeda(value)}
                  </span>
                </span>
              );
            })}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          icon={<FaTimes size={12} />}
          className="bulk-action-bar__clear"
        >
          Limpar
        </Button>
      </div>
      <div className="bulk-action-bar__actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={allSelected ? onClearSelection : onSelectAll}
        >
          {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
        </Button>
        {actions.map((action, idx) => (
          <Button
            key={idx}
            variant={action.variant || 'primary'}
            size={action.size || 'sm'}
            onClick={action.onClick}
            disabled={action.disabled}
            icon={action.icon}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default BulkActionBar;
