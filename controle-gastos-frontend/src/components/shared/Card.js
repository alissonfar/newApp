import React from 'react';
import './Card.css';

const Card = ({ children, className = '', variant = 'default', ...props }) => {
  const classNames = [
    'ds-card',
    variant !== 'default' ? `ds-card--${variant}` : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '', ...props }) => (
  <div className={`ds-card__header ${className}`.trim()} {...props}>
    {children}
  </div>
);

export const CardContent = ({ children, className = '', ...props }) => (
  <div className={`ds-card__content ${className}`.trim()} {...props}>
    {children}
  </div>
);

export default Card;
