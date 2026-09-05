// src/components/Modal/ModalTransacao.js
import React, { useRef } from 'react';
import useModalBehavior from './useModalBehavior';
import './ModalTransacao.css';

const ModalTransacao = ({ onClose, children }) => {
  const modalRef = useRef(null);
  useModalBehavior(modalRef);

  return (
    <div className="modal-overlay">
      {/* Não fecha ao clicar no overlay - mantido conforme solicitação do usuário */}
      <div
        className="modal-content"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <button className="modal-close" onClick={onClose} aria-label="Fechar modal">
          X
        </button>
        {children}
      </div>
    </div>
  );
};

export default ModalTransacao;
