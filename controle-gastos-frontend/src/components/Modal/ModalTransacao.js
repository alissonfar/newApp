// src/components/Modal/ModalTransacao.js
import React, { useEffect, useRef } from 'react';
import './ModalTransacao.css';

const ModalTransacao = ({ onClose, children }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Confina Tab dentro do modal (focus trap)
      if (e.key === 'Tab') {
        if (!modalRef.current) return;

        // Encontra todos os elementos focáveis dentro do modal
        const focusableElements = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        // Shift+Tab no primeiro elemento → volta para o último
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
        // Tab no último elemento → volta para o primeiro
        else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="modal-overlay">
      {/* Não fecha ao clicar no overlay - mantido conforme solicitação do usuário */}
      <div
        className="modal-content"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
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
