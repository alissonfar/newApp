import React from 'react';
import { FaCalendarDay, FaCalendarAlt } from 'react-icons/fa';
import Button from './Button';
import { getDateRangeForPeriod, PERIODOS_RAPIDOS } from '../../utils/dateUtils';
import './PeriodQuickFilter.css';

const PERIOD_LABELS = {
  [PERIODOS_RAPIDOS.MES_ATUAL]: 'Mês Atual',
  [PERIODOS_RAPIDOS.ULTIMOS_7_DIAS]: 'Últimos 7 dias',
  [PERIODOS_RAPIDOS.ULTIMOS_30_DIAS]: 'Últimos 30 dias',
  [PERIODOS_RAPIDOS.ESTE_ANO]: 'Este Ano',
  [PERIODOS_RAPIDOS.MES_ANTERIOR]: 'Mês Anterior',
  [PERIODOS_RAPIDOS.PERSONALIZADO]: 'Personalizado'
};

/**
 * Filtro de períodos rápidos - reutilizado por Relatório e Recebimentos.
 * Atualiza dataInicio/dataFim e opcionalmente dispara callback (ex: aplicar filtro).
 */
const PeriodQuickFilter = ({
  value = '',
  dataInicio = '',
  dataFim = '',
  onChange,
  onPeriodSelect,
  autoApply = false,
  showCustomInputs = true,
  compact = false,
  className = ''
}) => {
  const handlePeriodClick = (period) => {
    if (period === PERIODOS_RAPIDOS.PERSONALIZADO) {
      onPeriodSelect?.({ period: PERIODOS_RAPIDOS.PERSONALIZADO });
      return;
    }

    const range = getDateRangeForPeriod(period);
    if (range) {
      onChange?.({ dataInicio: range.dataInicio, dataFim: range.dataFim });
      onPeriodSelect?.({ period, ...range });
    }
  };

  const isActive = (period) => {
    if (period === PERIODOS_RAPIDOS.PERSONALIZADO) return false;
    const range = getDateRangeForPeriod(period);
    return range && range.dataInicio === dataInicio && range.dataFim === dataFim;
  };

  const periods = [
    PERIODOS_RAPIDOS.MES_ATUAL,
    PERIODOS_RAPIDOS.ULTIMOS_7_DIAS,
    PERIODOS_RAPIDOS.ULTIMOS_30_DIAS,
    PERIODOS_RAPIDOS.ESTE_ANO,
    PERIODOS_RAPIDOS.MES_ANTERIOR
  ];

  return (
    <div className={`period-quick-filter ${compact ? 'period-quick-filter--compact' : ''} ${className}`.trim()}>
      <div className="period-quick-filter__buttons">
        {periods.map((period) => (
          <Button
            key={period}
            variant={isActive(period) ? 'primary' : 'ghost'}
            size="sm"
            icon={period === PERIODOS_RAPIDOS.MES_ATUAL ? <FaCalendarDay size={12} /> : <FaCalendarAlt size={12} />}
            onClick={() => handlePeriodClick(period)}
            className={`period-quick-filter__btn ${isActive(period) ? 'period-quick-filter__btn--active' : ''}`}
          >
            {PERIOD_LABELS[period]}
          </Button>
        ))}
      </div>
      {showCustomInputs && (
        <div className="period-quick-filter__inputs">
          <input
            type="date"
            className="input-field period-quick-filter__input"
            value={dataInicio || ''}
            onChange={(e) => {
              onChange?.({ dataInicio: e.target.value });
              onPeriodSelect?.({ period: PERIODOS_RAPIDOS.PERSONALIZADO });
            }}
            placeholder="Data início"
          />
          <input
            type="date"
            className="input-field period-quick-filter__input"
            value={dataFim || ''}
            onChange={(e) => {
              onChange?.({ dataFim: e.target.value });
              onPeriodSelect?.({ period: PERIODOS_RAPIDOS.PERSONALIZADO });
            }}
            placeholder="Data fim"
          />
        </div>
      )}
    </div>
  );
};

export default PeriodQuickFilter;
export { PERIODOS_RAPIDOS };
