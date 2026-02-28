import React from 'react';
import { FaInbox } from 'react-icons/fa';
import './EmptyState.css';

const EmptyState = ({ message, icon, children, className = '' }) => (
  <div className={`ds-empty-state ${className}`.trim()}>
    <div className="ds-empty-state__icon">
      {icon || <FaInbox size={48} />}
    </div>
    <p className="ds-empty-state__message">{message}</p>
    {children && <div className="ds-empty-state__actions">{children}</div>}
  </div>
);

export default EmptyState;
