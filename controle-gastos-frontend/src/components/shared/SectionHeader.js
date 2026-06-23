// src/components/shared/SectionHeader.js
import React from 'react';
import './SectionHeader.css';

/**
 * SectionHeader - Cabeçalho de seção com título, ícone, ação à direita
 *
 * API atual (preservada): { title, icon, children }
 *   - `icon` é renderizado ao lado do título
 *   - `children` é renderizado no canto direito (área de ações)
 *
 * API nova (do plano): { title, subtitle, action }
 *   - `subtitle` aparece abaixo do título
 *   - `action` é renderizado no canto direito (preferência sobre `children`)
 */
const SectionHeader = ({ title, subtitle, icon, action, children, className = '', ...rest }) => (
  <div className={`cg-section-header ${className}`.trim()} {...rest}>
    <div className="cg-section-header__text">
      <h2 className="cg-section-header__title">
        {icon && <span className="cg-section-header__icon">{icon}</span>}
        {title}
      </h2>
      {subtitle && <p className="cg-section-header__subtitle">{subtitle}</p>}
    </div>
    {(action || children) && (
      <div className="cg-section-header__action">
        {action || children}
      </div>
    )}
  </div>
);

export default SectionHeader;
