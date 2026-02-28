import React from 'react';
import './SectionHeader.css';

const SectionHeader = ({ title, icon, children, className = '' }) => (
  <div className={`ds-section-header ${className}`.trim()}>
    <h3 className="ds-section-header__title">
      {icon && <span className="ds-section-header__icon">{icon}</span>}
      {title}
    </h3>
    {children && <div className="ds-section-header__actions">{children}</div>}
  </div>
);

export default SectionHeader;
