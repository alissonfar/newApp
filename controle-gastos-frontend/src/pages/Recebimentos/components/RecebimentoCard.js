import React from 'react';
import { formatDateBR } from '../../../utils/dateUtils';

const formatarValor = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '0,00' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const RecebimentoCard = ({ transacao, selecionado, onClick }) => (
    <div
      className={`recebimento-card ${selecionado ? 'selecionado' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <span className="recebimento-card-desc">{transacao.descricao}</span>
      <span className="recebimento-card-data">{formatDateBR(transacao.data)}</span>
      <span className="recebimento-card-valor">R$ {formatarValor(transacao.valor)}</span>
    </div>
  );

export default RecebimentoCard;
