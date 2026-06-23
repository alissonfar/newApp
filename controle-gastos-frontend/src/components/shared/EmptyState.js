// src/components/shared/EmptyState.js
import React from 'react';
import { FaInbox } from 'react-icons/fa';
import './EmptyState.css';

/**
 * EmptyState - Estado vazio de uma lista/seção
 *
 * API atual (preservada): { message, icon, children }
 *   - `message` aparece como descrição
 *   - `children` é renderizado como ação
 *   - default icon: <FaInbox />
 *
 * API nova (do plano): { icon, title, description, action }
 *   - `title` aparece como título principal
 *   - `description` é o texto
 *   - `action` é o elemento de ação (preferência sobre `children`)
 */
const EmptyState = ({
  icon,
  title,
  description,
  message,     // alias legado de description (preserva API anterior)
  action,
  children,    // alias legado de action (preserva API anterior)
  className = '',
  ...rest
}) => {
  const resolvedDescription = description || message;
  const resolvedAction = action || children;

  return (
    <div className={`cg-empty-state ${className}`.trim()} {...rest}>
      <div className="cg-empty-state__icon">
        {icon || <FaInbox size={48} />}
      </div>
      {title && <h3 className="cg-empty-state__title">{title}</h3>}
      {resolvedDescription && <p className="cg-empty-state__description">{resolvedDescription}</p>}
      {resolvedAction && <div className="cg-empty-state__action">{resolvedAction}</div>}
    </div>
  );
};

export default EmptyState;
