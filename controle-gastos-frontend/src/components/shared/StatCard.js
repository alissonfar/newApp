// src/components/shared/StatCard.js
import React from 'react';
import IconRenderer from './IconRenderer.js';
import './StatCard.css';

/**
 * StatCard - Cartão de KPI (label, valor, ícone, variação)
 *
 * @param {string} label - Texto do label (ex: "A Receber")
 * @param {ReactNode|string|number} value - Valor principal (já formatado ou não)
 * @param {ReactNode|string} icon - Aceita tanto ReactNode (FaXxx) quanto string ('piggybank') para IconRenderer
 * @param {string} accentColor - CSS color/var (ex: 'var(--cg-color-primary)')
 * @param {string} detail - Texto curto do detalhe (ex: "5%")
 * @param {string} detailLabel - Label do detalhe (ex: "vs. mês anterior")
 * @param {boolean} positive - Define cor do detail (true=verde, false=vermelho, undefined=neutro)
 */
const StatCard = ({
  label,
  value,
  icon,
  accentColor,
  detail,
  detailLabel,
  positive,
  className = '',
  ...rest
}) => {
  const accent = accentColor || 'var(--cg-color-primary)';
  return (
    <div className={`cg-stat-card ${className}`.trim()} style={{ '--cg-stat-accent': accent }} {...rest}>
      {icon && (
        <div className="cg-stat-card__icon">
          {typeof icon === 'string'
            ? <IconRenderer nome={icon} size={20} />
            : icon}
        </div>
      )}
      <div className="cg-stat-card__label">{label}</div>
      <div className="cg-stat-card__value">{value}</div>
      {(detail || detailLabel) && (
        <div className="cg-stat-card__detail">
          {detailLabel && <span className="cg-stat-card__detail-label">{detailLabel}</span>}
          {detail && (
            <span className={`cg-stat-card__detail-value ${positive === true ? 'positive' : positive === false ? 'negative' : ''}`}>
              {detail}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatCard;
