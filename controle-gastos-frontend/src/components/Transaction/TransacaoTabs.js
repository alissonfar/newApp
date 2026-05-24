import React, { useState, useCallback } from 'react';
import { Tooltip } from '@mui/material';

const TABS = [
  { id: 'principal', label: 'Principal' },
  { id: 'pagamentos', label: 'Pagamentos' },
  { id: 'avancado', label: 'Avançado' },
  { id: 'resumo', label: 'Resumo' }
];

const TransacaoTabs = ({
  children,
  onSubmitSaveClose,
  onSubmitSaveContinue,
  isEditing,
  isSaving = false,
  tabErrors = {}
}) => {
  const [activeTab, setActiveTab] = useState('principal');

  const handleTabKeyDown = useCallback((e, tabId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setActiveTab(tabId);
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const idx = TABS.findIndex(t => t.id === activeTab);
      const next = TABS[(idx + 1) % TABS.length];
      setActiveTab(next.id);
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const idx = TABS.findIndex(t => t.id === activeTab);
      const next = TABS[(idx - 1 + TABS.length) % TABS.length];
      setActiveTab(next.id);
    }
  }, [activeTab]);

  return (
    <div className="transacao-tabs-container">
      <div className="transacao-tabs-bar" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`transacao-tab ${activeTab === tab.id ? 'active' : ''} ${tabErrors[tab.id] ? 'has-error' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
            tabIndex={0}
          >
            {tab.label}
            {tabErrors[tab.id] && <span className="tab-error-dot" title={tabErrors[tab.id]} />}
          </button>
        ))}
      </div>

      <div className="transacao-tab-content">
        {React.Children.map(children, child => {
          if (!child) return null;
          const tabId = child.props['data-tab'];
          if (tabId !== activeTab) return null;
          return child;
        })}
      </div>

      <div className="transacao-tabs-footer">
        <Tooltip title="Ctrl + Enter">
          <button
            type="button"
            className="submit-btn"
            onClick={onSubmitSaveClose}
            disabled={isSaving}
            tabIndex={91}
          >
            {isSaving ? 'Salvando...' : isEditing ? 'Atualizar e Fechar' : 'Salvar e Fechar'}
          </button>
        </Tooltip>
        <Tooltip title="Ctrl + Space">
          <button
            type="button"
            className="submit-btn"
            onClick={onSubmitSaveContinue}
            disabled={isSaving}
            tabIndex={92}
          >
            {isSaving ? 'Salvando...' : isEditing ? 'Atualizar e Continuar' : 'Salvar e Continuar'}
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

export default TransacaoTabs;
