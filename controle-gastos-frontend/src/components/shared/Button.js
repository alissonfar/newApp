import React from 'react';
import './Button.css';

/**
 * Button - Componente reutilizável com variantes
 * @param {string} variant - primary | secondary | danger | success | warning | ghost
 * @param {string} size - sm | md | lg
 */
const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  icon,
  type = 'button',
  disabled,
  ...props
}) => {
  const classNames = [
    'ds-button',
    `ds-button--${variant}`,
    `ds-button--${size}`,
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      type={type}
      className={classNames}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="ds-button__icon">{icon}</span>}
      {children}
    </button>
  );
};

export default Button;
