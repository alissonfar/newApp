import React, { useState, useRef, useEffect } from 'react';
import { FaEllipsisV } from 'react-icons/fa';
import './ActionDropdown.css';

/**
 * ActionDropdown - Menu de ações (Editar, Excluir, etc.)
 * @param {Array} items - [{ label, icon, onClick, variant?: 'default'|'danger' }]
 */
const ActionDropdown = ({ items = [], className = '', ariaLabel = 'Ações' }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleItemClick = (item) => {
    item.onClick?.();
    setOpen(false);
  };

  return (
    <div className={`ds-action-dropdown ${className}`.trim()} ref={ref}>
      <button
        type="button"
        className="ds-action-dropdown__trigger"
        onClick={() => setOpen(!open)}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <FaEllipsisV size={14} />
      </button>
      {open && (
        <div className="ds-action-dropdown__menu" role="menu">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="menuitem"
              className={`ds-action-dropdown__item ds-action-dropdown__item--${item.variant || 'default'}`}
              onClick={() => handleItemClick(item)}
            >
              {item.icon && <span className="ds-action-dropdown__item-icon">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActionDropdown;
