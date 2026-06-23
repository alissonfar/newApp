// src/components/Emprestimos/EmprestimoBadge.js
import React from 'react';
import { formatarMoedaBRL } from '../../utils/emprestimoFormat';
import './EmprestimoBadge.css';

const EmprestimoBadge = ({ emprestimoInfo, variant = 'inline' }) => {
  if (!emprestimoInfo) return null;

  const tipo = emprestimoInfo.tipo;
  const pessoaNome = emprestimoInfo.pessoaNome || 'pessoa';
  const valor = emprestimoInfo.valor ?? emprestimoInfo.valorOriginal ?? 0;

  const tooltip = `Parte do empréstimo ${pessoaNome} — valor: ${formatarMoedaBRL(valor)}`;

  const label = tipo === 'desembolso' ? '↗ Desembolso' : '↙ Recebimento';

  if (variant === 'chip') {
    return (
      <span className="emp-badge emp-badge-chip" title={tooltip}>
        🏦 {label}
      </span>
    );
  }
  return (
    <span className="emp-badge emp-badge-inline" title={tooltip}>
      <span className="emp-badge-icon">🏦</span>
      <span className="emp-badge-text">{label}</span>
    </span>
  );
};

export default EmprestimoBadge;
