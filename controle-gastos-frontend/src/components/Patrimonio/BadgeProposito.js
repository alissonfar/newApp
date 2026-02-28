import React from 'react';
import './BadgeProposito.css';

const PROPOSITOS = {
  disponivel: { label: 'Disponível', variant: 'info' },
  reserva_emergencia: { label: 'Reserva de Emergência', variant: 'success' },
  objetivo: { label: 'Objetivo', variant: 'warning' },
  guardado: { label: 'Guardado', variant: 'neutral' },
};

const BadgeProposito = ({ proposito, className = '' }) => {
  const config = PROPOSITOS[proposito] || { label: proposito || '-', variant: 'neutral' };
  return (
    <span className={`badge-proposito badge-proposito--${config.variant} ${className}`.trim()}>
      {config.label}
    </span>
  );
};

export default BadgeProposito;
