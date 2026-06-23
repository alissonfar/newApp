// src/components/shared/Card.js
import React from 'react';
import './Card.css';

const Card = React.forwardRef(({
  children,
  variant = 'default',
  elevation = 'md',
  padding = 'md',
  className = '',
  ...rest
}, ref) => {
  const classes = [
    'cg-card',
    `cg-card--${variant}`,
    `cg-card--elev-${elevation}`,
    `cg-card--pad-${padding}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div ref={ref} className={classes} {...rest}>
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export const CardHeader = ({ children, className = '', ...rest }) => (
  <div className={`cg-card__header ${className}`.trim()} {...rest}>
    {children}
  </div>
);

export const CardContent = ({ children, className = '', ...rest }) => (
  <div className={`cg-card__content ${className}`.trim()} {...rest}>
    {children}
  </div>
);

export default Card;
