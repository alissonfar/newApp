import React from 'react';

const ShortcutsHelp = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="shortcuts-help-overlay" onClick={onClose}>
      <div className="shortcuts-help-content" onClick={e => e.stopPropagation()}>
        <h3>Atalhos de Teclado</h3>
        <div className="shortcuts-list">
          <div className="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>Space</kbd>
            <span>Salvar e Continuar</span>
          </div>
          <div className="shortcut-item">
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
            <span>Salvar e Fechar</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>H</kbd>
            <span>Definir data como Hoje</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>Y</kbd>
            <span>Definir data como Ontem</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>P</kbd>
            <span>Adicionar novo pagamento</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>R</kbd>
            <span>Remover ultimo pagamento</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>D</kbd>
            <span>Focar na Descricao</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>V</kbd>
            <span>Focar no Valor Total</span>
          </div>
          <div className="shortcut-item">
            <kbd>Alt</kbd> + <kbd>T</kbd>
            <span>Focar no Tipo</span>
          </div>
          <div className="shortcut-item">
            <kbd>Esc</kbd>
            <span>Fechar modal</span>
          </div>
        </div>
        <button className="close-shortcuts-btn" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
};

export default ShortcutsHelp;
