import React from 'react';
import { FaTimes } from 'react-icons/fa';
import Button from './Button';
import './BulkActionBar.css';

/**
 * Barra de ações em massa - padrão Gmail/Notion/SaaS.
 * Exibida quando há itens selecionados.
 */
const BulkActionBar = ({
  selectedCount,
  totalCount,
  onClearSelection,
  onSelectAll,
  actions = [],
  className = ''
}) => {
  const allSelected = totalCount > 0 && selectedCount === totalCount;

  return (
    <div className={`bulk-action-bar ${className}`.trim()}>
      <div className="bulk-action-bar__info">
        <span className="bulk-action-bar__count">
          {selectedCount} {selectedCount === 1 ? 'selecionada' : 'selecionadas'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          icon={<FaTimes size={12} />}
          className="bulk-action-bar__clear"
        >
          Limpar
        </Button>
      </div>
      <div className="bulk-action-bar__actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={allSelected ? onClearSelection : onSelectAll}
        >
          {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
        </Button>
        {actions.map((action, idx) => (
          <Button
            key={idx}
            variant={action.variant || 'primary'}
            size={action.size || 'sm'}
            onClick={action.onClick}
            disabled={action.disabled}
            icon={action.icon}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default BulkActionBar;
