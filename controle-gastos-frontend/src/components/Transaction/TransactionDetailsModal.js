// src/components/Transaction/TransactionDetailsModal.js
import React from 'react';
import ModalTransacao from '../Modal/ModalTransacao';
import './TransactionDetailsModal.css';
import { formatDateBR } from '../../utils/dateUtils';

const TransactionDetailsModal = ({ transacao, onClose }) => {
  if (!transacao) return null;

  // Formata data e valor
  const formattedDate = formatDateBR(transacao.data);
  const formattedValue = parseFloat(transacao.valor).toFixed(2);

  return (
    <ModalTransacao onClose={onClose}>
      <div className="transaction-details">
        <h2>Detalhes da Transação</h2>
        
        <div className="details-section">
          <h3>Informações Gerais</h3>
          <p><strong>Descrição:</strong> {transacao.descricao}</p>
          <p><strong>Data:</strong> {formattedDate}</p>
          <p><strong>Tipo:</strong> {transacao.tipo}</p>
          <p><strong>Valor Total:</strong> R${formattedValue}</p>
          {transacao.observacao && (
            <p><strong>Observação:</strong> {transacao.observacao}</p>
          )}
          
          {transacao.tags && Object.keys(transacao.tags).length > 0 && (
            <div className="tags-section">
              <h4>Tags da Transação:</h4>
              {Object.keys(transacao.tags).map((cat, idx) => (
                <div key={idx}>
                  <strong>{cat}:</strong>
                  {transacao.tags[cat].map((tag, jdx) => (
                    <span key={jdx} className="tag-chip">{tag}</span>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="details-section">
          <h3>Pagamentos</h3>
          {transacao.pagamentos && transacao.pagamentos.length > 0 ? (
            transacao.pagamentos.map((pag, idx) => (
              <div key={idx} className="payment-detail">
                <p><strong>Pessoa:</strong> {pag.pessoa}</p>
                <p><strong>Valor:</strong> R${parseFloat(pag.valor).toFixed(2)}</p>
                {pag.tags && Object.keys(pag.tags).length > 0 ? (
                  <div className="tags-section">
                    <h4>Tags do Pagamento:</h4>
                    {Object.keys(pag.tags).map((cat, i) => (
                      <div key={i}>
                        <strong>{cat}:</strong>
                        {pag.tags[cat].map((tag, j) => (
                          <span key={j} className="tag-chip">{tag}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-tags">Sem tags</p>
                )}
                <hr />
              </div>
            ))
          ) : (
            <p>Sem pagamentos.</p>
          )}
        </div>
      </div>
    </ModalTransacao>
  );
};

export default TransactionDetailsModal;
