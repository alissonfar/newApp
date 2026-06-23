// src/components/shared/Badge.js
import React from 'react';
import './Badge.css';

/**
 * Badge - Status badges
 * Variants: default | success | error | warning | info | glass
 * Aliases: 'neutral' -> 'default' (compat com API anterior)
 *
 * Modo dot: <Badge dot variant="success" /> (bolinha sem texto)
 */
const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
  ...rest
}) => {
  // Alias de compat: 'neutral' (legado) -> 'default'
  const resolvedVariant = variant === 'neutral' ? 'default' : variant;

  if (dot) {
    return (
      <span
        className={`cg-badge-dot cg-badge-dot--${resolvedVariant} ${className}`.trim()}
        {...rest}
      />
    );
  }
  return (
    <span
      className={`cg-badge cg-badge--${resolvedVariant} cg-badge--${size} ${className}`.trim()}
      {...rest}
    >
      {children}
    </span>
  );
};

export default Badge;
