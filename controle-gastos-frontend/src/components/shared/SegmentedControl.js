import React from 'react';
import './SegmentedControl.css';

/**
 * SegmentedControl - Grupo de botões estilo pill para filtros
 * @param {Array<{value: string, label: string, variant?: string}>} options - Opções (variant: 'neutral' | 'error' | 'success')
 * @param {string} value - Valor selecionado
 * @param {function} onChange - (value) => void
 */
const SegmentedControl = ({ options = [], value, onChange, className = '' }) => {
  return (
    <div className={`ds-segmented-control ${className}`.trim()}>
      {options.map((opt, index) => {
        const isFirst = index === 0;
        const isLast = index === options.length - 1;
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange?.(opt.value)}
            className={`ds-segmented-control__btn ${isFirst ? 'ds-segmented-control__btn--first' : ''} ${isLast ? 'ds-segmented-control__btn--last' : ''} ${isActive ? 'ds-segmented-control__btn--active' : ''} ${opt.variant ? `ds-segmented-control__btn--${opt.variant}` : ''}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
