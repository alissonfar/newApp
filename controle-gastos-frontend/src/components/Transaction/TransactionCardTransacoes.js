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

  // Função que extrai a parte "YYYY-MM-DD" da string ISO e formata como "dd/mm/yyyy"
  const formatDateDDMMYYYY = (isoString) => {
    if (!isoString) return '';
    const datePart = isoString.split('T')[0]; // extrai "YYYY-MM-DD"
    const [year, month, day] = datePart.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="transaction-card-transacoes">
      <div className="card-header">
        <div className="card-header-left">
          <h3 className="card-title">{transacao.descricao}</h3>
          <span className="card-date">
            {formatDateDDMMYYYY(transacao.data)}
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
        {/* Se houver pagamentos, exibimos cada pagante em uma mini-seção */}
        {transacao.pagamentos && transacao.pagamentos.length > 0 && (
          <div className="payments-info">
            <h4>Pagamentos</h4>
            {transacao.pagamentos.map((pg, idx) => (
              <div key={idx} className="payment-item">
                <span className="payment-person">
                  <strong>Pessoa:</strong> {pg.pessoa}
                </span>
              </div>
            ))}
          </div>
        )}

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
