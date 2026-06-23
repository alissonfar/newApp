// src/components/shared/Button.js
import React from 'react';
import './Button.css';

/**
 * Button - Componente reutilizável com variantes
 * Variants: primary | secondary | glass | danger | success | ghost | warning (alias de ghost)
 * Sizes: sm | md | lg
 *
 * Mantém compatibilidade: aceita `icon` (alias de startIcon), `type`, `disabled` como antes.
 * Adiciona: `loading` (com spinner), `startIcon`, `endIcon`.
 */
const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  startIcon,
  endIcon,
  icon,        // alias legado de startIcon (preserva API anterior)
  className = '',
  type = 'button',
  ...rest
}) => {
  // Mapear variant legado 'warning' -> 'ghost' (mesmo visual, sem quebrar quem usa)
  const resolvedVariant = variant === 'warning' ? 'ghost' : variant;

  const classes = [
    'cg-button',
    `cg-button--${resolvedVariant}`,
    `cg-button--${size}`,
    loading ? 'cg-button--loading' : '',
    className,
  ].filter(Boolean).join(' ');

  const renderStartIcon = !loading && (startIcon || icon);

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="cg-button__spinner" aria-hidden="true" />}
      {renderStartIcon && <span className="cg-button__icon">{startIcon || icon}</span>}
      <span className="cg-button__label">{children}</span>
      {!loading && endIcon && <span className="cg-button__icon">{endIcon}</span>}
    </button>
  );
};

export default Button;
