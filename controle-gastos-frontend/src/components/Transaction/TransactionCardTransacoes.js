// src/components/Transaction/TransactionCardTransacoes.js
import React from 'react';
import { FaArrowUp, FaArrowDown, FaEdit, FaTrash } from 'react-icons/fa';
import './TransactionCardTransacoes.css';

const TransactionCardTransacoes = ({ transacao, onEdit, onDelete }) => {
  const tipoIcon =
    transacao.tipo === 'gasto' ? (
      <FaArrowDown className="tipo-icon gasto" />
    ) : (
      <FaArrowUp className="tipo-icon recebivel" />
    );

  return (
    <div className="transaction-card-transacoes">
      <div className="card-header">
        <div className="card-header-left">
          <h3 className="card-title">{transacao.descricao}</h3>
          <span className="card-date">
            {new Date(transacao.data).toLocaleDateString('pt-BR')}
          </span>
        </div>
        <div className="card-header-right">
          {tipoIcon}
          <span className="card-value">
            R${parseFloat(transacao.valor).toFixed(2)}
          </span>
          <span className={`badge ${transacao.tipo}`}>
            {transacao.tipo === 'gasto' ? 'Gasto' : 'Recebível'}
          </span>
        </div>
      </div>
      <div className="card-details">
        <div className="tag-info">
          {transacao.tags &&
            Object.keys(transacao.tags).map((cat, idx) =>
              transacao.tags[cat].map((tag, jdx) => (
                <span key={`${idx}-${jdx}`} className="tag-chip">
                  {cat}: {tag}
                </span>
              ))
            )}
        </div>
      </div>
      <div className="card-actions">
        <button className="action-btn edit-btn" onClick={() => onEdit(transacao)}>
          <FaEdit /> Editar
        </button>
        <button
          className="action-btn delete-btn"
          onClick={() => onDelete(transacao.id)}
        >
          <FaTrash /> Excluir
        </button>
      </div>
    </div>
  );
};

export default TransactionCardTransacoes;
