// src/components/Modal/ModalCompacto.js
import React, { useRef } from 'react';
import useModalBehavior from './useModalBehavior';
import './ModalCompacto.css';

const ModalCompacto = ({ onClose, children }) => {
  const modalRef = useRef(null);
  useModalBehavior(modalRef);

  return (
    <div className="modal-compacto-overlay">
      <div
        className="modal-compacto-content"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
      >
        <button className="modal-compacto-close" onClick={onClose} aria-label="Fechar modal">
          X
        </button>
        {children}
      </div>
    </div>
  );
};

export default ModalCompacto;
