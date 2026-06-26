import React from 'react';
import { FaCalendarDay, FaCalendarAlt } from 'react-icons/fa';
import Button from './Button';
import {
  getDateRangeForPeriod,
  getSingleDateRange,
  PERIODOS_RAPIDOS,
  PERIODOS_DIA_UNICO
} from '../../utils/dateUtils';
import './PeriodQuickFilter.css';

const PERIOD_LABELS = {
  [PERIODOS_RAPIDOS.MES_ATUAL]: 'Mês Atual',
  [PERIODOS_RAPIDOS.ULTIMOS_7_DIAS]: 'Últimos 7 dias',
  [PERIODOS_RAPIDOS.ULTIMOS_30_DIAS]: 'Últimos 30 dias',
  [PERIODOS_RAPIDOS.ULTIMOS_3_MESES]: '3 meses',
  [PERIODOS_RAPIDOS.ULTIMOS_6_MESES]: '6 meses',
  [PERIODOS_RAPIDOS.ULTIMOS_12_MESES]: '1 ano',
  [PERIODOS_RAPIDOS.ESTE_ANO]: 'Este Ano',
  [PERIODOS_RAPIDOS.MES_ANTERIOR]: 'Mês Anterior',
  [PERIODOS_RAPIDOS.PERSONALIZADO]: 'Personalizado'
};

const DAY_PERIOD_LABELS = {
  [PERIODOS_DIA_UNICO.HOJE]: 'Hoje',
  [PERIODOS_DIA_UNICO.ONTEM]: 'Ontem',
  [PERIODOS_DIA_UNICO.AMANHA]: 'Amanhã'
};

/**
 * Filtro de períodos rápidos - reutilizado por Relatório e Recebimentos.
 * Atualiza dataInicio/dataFim e opcionalmente dispara callback (ex: aplicar filtro).
 *
 * Props novas:
 *  - showDayButtons (boolean, default false) — renderiza 3 botões "Hoje/Ontem/Amanhã"
 *    ANTES dos atalhos por período. Default false mantém compatibilidade com Recebimentos.
 */
const DEFAULT_PERIODS = [
  PERIODOS_RAPIDOS.MES_ATUAL,
  PERIODOS_RAPIDOS.ULTIMOS_7_DIAS,
  PERIODOS_RAPIDOS.ULTIMOS_30_DIAS,
  PERIODOS_RAPIDOS.ESTE_ANO,
  PERIODOS_RAPIDOS.MES_ANTERIOR
];

const DEFAULT_DAY_PERIODS = [
  PERIODOS_DIA_UNICO.HOJE,
  PERIODOS_DIA_UNICO.ONTEM,
  PERIODOS_DIA_UNICO.AMANHA
];

const PeriodQuickFilter = ({
  value = '',
  dataInicio = '',
  dataFim = '',
  onChange,
  onPeriodSelect,
  autoApply = false,
  showCustomInputs = true,
  showDayButtons = false,
  compact = false,
  className = '',
  periods = DEFAULT_PERIODS,
  dayPeriods = DEFAULT_DAY_PERIODS
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

  const handleDayPeriodClick = (period) => {
    const range = getSingleDateRange(period);
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

  const isDayActive = (period) => {
    const range = getSingleDateRange(period);
    return range && range.dataInicio === dataInicio && range.dataFim === dataFim;
  };

  return (
    <div className={`period-quick-filter ${compact ? 'period-quick-filter--compact' : ''} ${className}`.trim()}>
      {showDayButtons && (
        <div className="period-quick-filter__buttons period-quick-filter__buttons--day">
          {dayPeriods.map((period) => DAY_PERIOD_LABELS[period] && (
            <Button
              key={period}
              variant={isDayActive(period) ? 'primary' : 'ghost'}
              size="sm"
              icon={<FaCalendarDay size={12} />}
              onClick={() => handleDayPeriodClick(period)}
              className={`period-quick-filter__btn period-quick-filter__btn--day ${isDayActive(period) ? 'period-quick-filter__btn--active' : ''}`}
            >
              {DAY_PERIOD_LABELS[period]}
            </Button>
          ))}
        </div>
      )}
      <div className="period-quick-filter__buttons">
        {periods.map((period) => PERIOD_LABELS[period] && (
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
              onChange?.({ dataInicio: e.target.value, dataFim: dataFim || '' });
              onPeriodSelect?.({ period: PERIODOS_RAPIDOS.PERSONALIZADO });
            }}
            placeholder="Data início"
          />
          <input
            type="date"
            className="input-field period-quick-filter__input"
            value={dataFim || ''}
            onChange={(e) => {
              onChange?.({ dataInicio: dataInicio || '', dataFim: e.target.value });
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
export { PERIODOS_RAPIDOS, PERIODOS_DIA_UNICO };
