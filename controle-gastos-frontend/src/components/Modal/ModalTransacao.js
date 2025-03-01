// src/components/Modal/ModalTransacao.js
import React from 'react';
import './ModalTransacao.css';

const ModalTransacao = ({ onClose, children }) => {
  return (
    <div className="modal-overlay">
      {/* Não colocamos onClick={onClose} aqui */}
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>X</button>
        {children}
      </div>
    </div>
  );
};

export default ModalTransacao;
