import React from 'react';
import './Badge.css';

/**
 * Badge - Status badges
 * @param {string} variant - success | warning | error | info | neutral
 */
const Badge = ({ children, variant = 'neutral', className = '' }) => (
  <span className={`ds-badge ds-badge--${variant} ${className}`.trim()}>
    {children}
  </span>
);

export default Badge;
