import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { RecebimentosProvider, useRecebimentos } from './context/RecebimentosContext';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import TabConfiguracao from './components/TabConfiguracao';
import TabSelecao from './components/TabSelecao';
import TabResumo from './components/TabResumo';
import RecebimentosStepper from './components/RecebimentosStepper';
import ConfiguracaoRecebimentosModal from '../../components/Recebimentos/ConfiguracaoRecebimentosModal';
import '../../components/shared/Button.css';
import './Recebimentos.css';

function NovaConciliacaoContent() {
  const { tabAtiva, setTabAtiva, aplicarDefaultsSeVazio } = useRecebimentos();
  const { usuario } = useAuth();
  const { tags = [] } = useData();
  const [modalConfigAberto, setModalConfigAberto] = useState(false);

  // Defaults salvos (podem ser null)
  const tagReceberId = usuario?.preferencias?.tagReceberPadraoId || null;
  const tagRemoverId = usuario?.preferencias?.tagRemoverPadraoId || null;

  // Considera "configurado" se o ID salvo existe em useData().tags
  const tagReceber = useMemo(
    () => tags.find(t => t._id === tagReceberId) || null,
    [tags, tagReceberId]
  );
  const tagRemover = useMemo(
    () => tags.find(t => t._id === tagRemoverId) || null,
    [tags, tagRemoverId]
  );
  const configurado = !!tagReceber;

  // ⚙️ só aparece na aba de Configuração
  const mostrarBotaoConfig = tabAtiva === 0;

  return (
    <div className="recebimentos-novo-page">
      <header className="recebimentos-novo-header">
        <div className="header-top">
          <h1>Nova Conciliação</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {mostrarBotaoConfig && (
              <button
                type="button"
                onClick={() => setModalConfigAberto(true)}
                title="Configurações de Recebimentos"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '8px 14px', borderRadius: 999,
                  border: `1px solid ${configurado ? '#10b981' : '#dc2626'}`,
                  background: configurado ? '#ecfdf5' : '#fef2f2',
                  color: configurado ? '#065f46' : '#991b1b',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  whiteSpace: 'nowrap'
                }}
              >
                <span style={{ fontSize: 16 }}>⚙️</span>
                {configurado ? (
                  <>
                    <span>Recebimentos →</span>
                    <strong>{tagReceber.nome}</strong>
                    {tagRemover && (
                      <>
                        <span style={{ color: '#94a3b8' }}>·</span>
                        <span style={{ color: '#7f1d1d' }}>remover {tagRemover.nome}</span>
                      </>
                    )}
                  </>
                ) : (
                  <strong>Recebimentos: Não configurado</strong>
                )}
              </button>
            )}
            <Link to="/recebimentos/historico" className="ds-button ds-button--ghost ds-button--md">
              Ver Histórico
            </Link>
          </div>
        </div>
        <RecebimentosStepper activeStep={tabAtiva} onStepClick={setTabAtiva} />
      </header>
      <div className="recebimentos-content-area">
        {tabAtiva === 0 && <TabConfiguracao />}
        {tabAtiva === 2 && <TabSelecao />}
        {tabAtiva === 3 && <TabResumo />}
      </div>
      {modalConfigAberto && (
        <ConfiguracaoRecebimentosModal
          aberto={modalConfigAberto}
          onFechar={() => setModalConfigAberto(false)}
          onSalvo={() => {
            // Re-aplica defaults recém-salvos ao state (sem sobrescrever escolha manual)
            aplicarDefaultsSeVazio();
          }}
        />
      )}
    </div>
  );
}

const NovaConciliacaoPage = () => (
  <RecebimentosProvider>
    <NovaConciliacaoContent />
  </RecebimentosProvider>
);

export default NovaConciliacaoPage;
