// src/components/Transaction/TransactionCardTransacoes.js
import React from 'react';
import { FaArrowUp, FaArrowDown, FaEdit, FaTrash } from 'react-icons/fa';
import './TransactionCardTransacoes.css';
import { formatDateBR } from '../../utils/dateUtils';

const TransactionCardTransacoes = ({ transacao, onEdit, onDelete }) => {
  // Define o ícone de acordo com o tipo da transação
  const tipoIcon =
    transacao.tipo === 'gasto' ? (
      <FaArrowDown className="tipo-icon gasto" />
    ) : (
      <FaArrowUp className="tipo-icon recebivel" />
    );

  // Formata a data usando a função utilitária
  const formattedDate = formatDateBR(transacao.data);

  return (
    <div className="transaction-card-transacoes">
      <div className="card-header">
        <div className="card-header-left">
          <h3 className="card-title">{transacao.descricao}</h3>
          <span className="card-date">{formattedDate}</span>
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
        {/* Se houver pagamentos, exibe informações detalhadas */}
        {transacao.pagamentos && transacao.pagamentos.length > 0 && (
          <div className="payments-info">
            <h4>Pagamentos</h4>
            {transacao.pagamentos.map((pg, idx) => (
              <div key={idx} className="payment-item">
                <div className="payment-info">
                  <span className="payment-person">
                    <strong>Pessoa:</strong> {pg.pessoa}
                  </span>
                </div>
                {/* Exibe tags associadas a esse pagamento, se houver */}
                {pg.tags && Object.keys(pg.tags).length > 0 ? (
                  <div className="payment-tags">
                    {Object.keys(pg.tags).map((cat, i) =>
                      pg.tags[cat].map((tag, j) => (
                        <span key={`${cat}-${tag}-${j}`} className="tag-chip">
                          {cat}: {tag}
                        </span>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="payment-tags">
                    <span className="no-tags">Sem tags</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}


      </div>

      <div className="card-actions">
        <button className="btn-action edit-btn" onClick={() => onEdit(transacao)}>
          <FaEdit /> Editar
        </button>
        <button className="btn-action delete-btn" onClick={() => onDelete(transacao.id)}>
          <FaTrash /> Excluir
        </button>
      </div>
    </div>
  );
};

export default TransactionCardTransacoes;