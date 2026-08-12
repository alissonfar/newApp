// src/components/shared/PageHeader.js
import React from 'react';
import './PageHeader.css';

const PageHeader = ({ icon, title, subtitle, action }) => (
  <div className="cg-page-header">
    <div className="cg-page-header__row">
      <h1 className="cg-page-header__title">
        {icon && <span className="cg-page-header__icon">{icon}</span>}
        {title}
      </h1>
      {action && <div className="cg-page-header__action">{action}</div>}
    </div>
    {subtitle && <p className="cg-page-header__subtitle">{subtitle}</p>}
  </div>
);

export default PageHeader;
