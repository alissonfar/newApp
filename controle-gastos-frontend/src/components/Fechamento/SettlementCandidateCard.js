// src/components/Fechamento/SettlementCandidateCard.js
import React from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import Card from '../shared/Card';
import Button from '../shared/Button';
import TagBadge from '../../pages/Recebimentos/components/TagBadge';
import './SettlementCandidateCard.css';

function formatMoeda(valor) {
  const n = parseFloat(valor) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatData(date) {
  const d = new Date(date);
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

const SettlementCandidateCard = ({
  settlement,
  pessoaAtual,
  expandido,
  onToggleExpandir,
  onLinkar,
  linkando
}) => {
  const id = settlement._id || settlement.id;
  const pessoas = settlement.pessoas || [];
  const pessoaAtualLower = (pessoaAtual || '').toLowerCase();
  const appliedTransactions = settlement.appliedTransactions || [];

  return (
    <Card variant="glass" padding="md" className="settlement-candidate-card">
      <div className="settlement-candidate-card__top">
        <div className="settlement-candidate-card__pessoas">
          {pessoas.map((nome) => (
            <span
              key={nome}
              className={
                'settlement-candidate-card__pessoa-badge' +
                (nome.toLowerCase() === pessoaAtualLower ? ' settlement-candidate-card__pessoa-badge--atual' : '')
              }
            >
              {nome}
            </span>
          ))}
        </div>
        <div className="settlement-candidate-card__valores">
          <span className="settlement-candidate-card__valor-principal">
            {formatMoeda(settlement.totalApplied)}
          </span>
          {settlement.leftoverAmount > 0 && (
            <span className="settlement-candidate-card__valor-sobra">
              + {formatMoeda(settlement.leftoverAmount)} de sobra
            </span>
          )}
        </div>
      </div>

      <p className="settlement-candidate-card__desc">
        {settlement.receivingTransactionId?.descricao}
      </p>
      <p className="settlement-candidate-card__meta">
        {new Date(settlement.createdAt).toLocaleDateString('pt-BR')} · {appliedTransactions.length} transações quitadas
      </p>

      {expandido && (
        <div className="settlement-candidate-card__detail">
          {appliedTransactions.length === 0 ? (
            <p className="settlement-candidate-card__detail-empty">Nenhuma transação quitada registrada.</p>
          ) : (
            <table className="settlement-candidate-card__tx-table">
              <thead><tr><th>Data</th><th>Descrição</th><th>Valor aplicado</th></tr></thead>
              <tbody>
                {appliedTransactions.map((at, i) => (
                  <tr key={i}>
                    <td>{formatData(at.transactionId?.data)}</td>
                    <td>{at.transactionId?.descricao || 'N/A'}</td>
                    <td>{formatMoeda(at.amountApplied)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {settlement.tagId && (
            <div className="settlement-candidate-card__tag">
              <TagBadge tag={settlement.tagId} size={14} />
            </div>
          )}
        </div>
      )}

      <div className="settlement-candidate-card__actions">
        <Button variant="ghost" size="sm" onClick={() => onToggleExpandir(id)}>
          {expandido ? <FaChevronUp /> : <FaChevronDown />} {expandido ? 'Recolher' : 'Ver detalhe'}
        </Button>
        <Button
          variant="primary"
          size="sm"
          loading={linkando}
          onClick={() => onLinkar(id)}
        >
          Linkar
        </Button>
      </div>
    </Card>
  );
};

export default SettlementCandidateCard;
