// src/components/Emprestimos/EmprestimoBadge.js
import React from 'react';
import { formatarMoedaBRL } from '../../utils/emprestimoFormat';
import './EmprestimoBadge.css';

const EmprestimoBadge = ({ emprestimoInfo, variant = 'inline' }) => {
  if (!emprestimoInfo) return null;

  if (emprestimoInfo.tipo === 'recebimento') {
    const tooltip = `Valor original: ${formatarMoedaBRL(emprestimoInfo.valorOriginal)} = ${formatarMoedaBRL(emprestimoInfo.principal)} devolução de principal + ${formatarMoedaBRL(emprestimoInfo.juros)} juros`;
    if (variant === 'chip') {
      return (
        <span className="emp-badge emp-badge-chip" title={tooltip}>
          🏦 Empréstimo
        </span>
      );
    }
    return (
      <span className="emp-badge emp-badge-inline" title={tooltip}>
        <span className="emp-badge-icon">🏦</span>
        <span className="emp-badge-text">Empréstimo</span>
      </span>
    );
  }

  return null;
};

export default EmprestimoBadge;
