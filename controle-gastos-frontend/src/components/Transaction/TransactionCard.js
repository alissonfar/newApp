import React from 'react';
import { FaArrowUp, FaArrowDown, FaEdit, FaTrash } from 'react-icons/fa';
import './TransactionCardTransacoes.css';

const TransactionCardTransacoes = ({ transacao, onEdit, onDelete }) => {
  // Define o ícone de acordo com o tipo
  const tipoIcon =
    transacao.tipo === 'gasto' ? (
      <FaArrowDown className="tipo-icon gasto" />
    ) : (
      <FaArrowUp className="tipo-icon recebivel" />
    );

  return (
    <div className="transaction-card-transacoes">
      <div className="card-header">
        <h3 className="card-title">{transacao.descricao}</h3>
        <div className="card-header-icon">
          {tipoIcon}
        </div>
      </div>
      <hr className="divider" />
      <div className="card-info">
        <div className="info-date">
          {new Date(transacao.data).toLocaleDateString('pt-BR')}
        </div>
        <div className="info-value">
          R${parseFloat(transacao.valor).toFixed(2)}
          <span className="badge">
            {transacao.tipo === 'gasto' ? 'Gasto' : 'Recebível'}
          </span>
        </div>
      </div>

      {/* Exibe cada pagamento, incluindo tags do pagamento */}
      {transacao.pagamentos && transacao.pagamentos.length > 0 && (
        <div className="card-payments">
          {transacao.pagamentos.map((pg, idx) => (
            <div key={idx} className="payment-line">
              {/* Exemplo: mostra pessoa e valor do pagamento */}
              <div className="payment-info">
                <strong>{pg.pessoa}:</strong> R${parseFloat(pg.valor).toFixed(2)}
              </div>
              
              {/* Exibe tags do pagamento */}
              <div className="payment-tags">
                {Object.keys(pg.paymentTags || {}).map((cat, i) =>
                  pg.paymentTags[cat].map((tag, j) => (
                    <span key={`${cat}-${tag}-${j}`} className="tag-chip">
                      {cat}: {tag}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card-actions">
        <button className="action-btn edit-btn" onClick={() => onEdit(transacao)}>
          <FaEdit /> Editar
        </button>
        <button className="action-btn delete-btn" onClick={() => onDelete(transacao.id)}>
          <FaTrash /> Excluir
        </button>
      </div>
    </div>
  );
};

export default TransactionCardTransacoes;
