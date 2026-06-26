// src/components/Relatorio/RelatorioFiltersCompact.js
// Versão "compacta" (1 linha) do painel de filtros do Relatório.
// Usado quando o user colapsa o painel principal.
// Mantém: atalho de período, 3 botões de dia, tipo, pesquisa, e botões aplicar/limpar.
import React from 'react';
import PeriodQuickFilter from '../shared/PeriodQuickFilter';
import SegmentedControl from '../shared/SegmentedControl';
import Button from '../shared/Button';

/**
 * Versão 1-linha do painel de filtros. Usado no modo colapsado.
 *
 * @param {object} draftFilters
 * @param {string} quickRange
 * @param {function} onChange - (newFilters) => void
 * @param {function} onApply - () => void
 * @param {function} onClear - () => void
 */
const RelatorioFiltersCompact = ({
  draftFilters,
  quickRange = '',
  onChange,
  onApply,
  onClear
}) => {
  const safe = draftFilters || {};
  return (
    <div className="relatorio-filtros-compact" role="region" aria-label="Filtros rápidos">
      <div className="relatorio-filtros-compact__row">
        <div className="relatorio-filtros-compact__period">
          <PeriodQuickFilter
            value={quickRange}
            dataInicio={safe.dataInicio}
            dataFim={safe.dataFim}
            onChange={({ dataInicio, dataFim }) =>
              onChange?.({ ...safe, dataInicio, dataFim })
            }
            showDayButtons
            showCustomInputs={false}
            compact
          />
        </div>
        <div className="relatorio-filtros-compact__tipo">
          <SegmentedControl
            options={[
              { value: 'both', label: 'Ambos' },
              { value: 'gasto', label: 'Gastos' },
              { value: 'recebivel', label: 'Recebíveis' }
            ]}
            value={safe.selectedTipo || 'both'}
            onChange={(v) => onChange?.({ ...safe, selectedTipo: v })}
          />
        </div>
        <div className="relatorio-filtros-compact__search">
          <input
            type="search"
            className="relatorio-filtros-compact__input"
            value={safe.searchTerm || ''}
            onChange={e => onChange?.({ ...safe, searchTerm: e.target.value })}
            placeholder="Buscar..."
            aria-label="Buscar"
          />
        </div>
        <div className="relatorio-filtros-compact__actions">
          <Button variant="primary" size="sm" onClick={onApply}>
            Filtrar
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            Limpar
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RelatorioFiltersCompact;
