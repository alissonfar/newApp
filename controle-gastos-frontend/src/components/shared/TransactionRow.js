// src/components/shared/TransactionRow.js
import React from 'react';
import { FaArrowDown, FaArrowUp } from 'react-icons/fa';
import './TransactionRow.css';

/**
 * TransactionRow - Linha visual de transação (ícone, descrição, data, valor, ações)
 *
 * @param {string} type - 'gasto' | 'recebivel'
 * @param {string|ReactNode} description - Texto principal
 * @param {string} secondaryText - Linha secundária (ex: pessoas)
 * @param {string} date - Data já formatada
 * @param {string|number} value - Valor (caso `formattedValue` não seja passado)
 * @param {string} formattedValue - Valor já formatado (ex: 'R$ 100,00'). Tem prioridade sobre `value`
 * @param {ReactNode} actions - Botões/ícones no canto direito
 * @param {function} onClick - Handler de clique (torna a row interativa)
 */
const TransactionRow = ({
  type, // 'gasto' | 'recebivel'
  description,
  secondaryText,
  date,
  value,
  formattedValue,
  actions,
  onClick,
  className = '',
}) => {
  const isGasto = type === 'gasto';
  return (
    <div
      className={`cg-transaction-row cg-transaction-row--${type} ${className}`.trim()}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={`cg-transaction-row__tipo cg-transaction-row__tipo--${type}`}>
        {isGasto ? <FaArrowDown /> : <FaArrowUp />}
      </div>
      <div className="cg-transaction-row__descricao">
        <div className="cg-transaction-row__descricao-texto">{description}</div>
        {secondaryText && <div className="cg-transaction-row__pessoas">{secondaryText}</div>}
      </div>
      <div className="cg-transaction-row__data">{date}</div>
      <div className={`cg-transaction-row__valor cg-transaction-row__valor--${type}`}>
        {formattedValue || value}
      </div>
      {actions && <div className="cg-transaction-row__acoes">{actions}</div>}
    </div>
  );
};

export default TransactionRow;
