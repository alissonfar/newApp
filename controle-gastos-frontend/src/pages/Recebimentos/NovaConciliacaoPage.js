import React from 'react';
import { Link } from 'react-router-dom';
import { RecebimentosProvider, useRecebimentos } from './context/RecebimentosContext';
import TabConfiguracao from './components/TabConfiguracao';
import TabFiltro from './components/TabFiltro';
import TabSelecao from './components/TabSelecao';
import TabResumo from './components/TabResumo';
import RecebimentosStepper from './components/RecebimentosStepper';
import '../../components/shared/Button.css';
import './Recebimentos.css';

function NovaConciliacaoContent() {
  const { tabAtiva, setTabAtiva } = useRecebimentos();

  return (
    <div className="recebimentos-novo-page">
      <header className="recebimentos-novo-header">
        <div className="header-top">
          <h1>Nova Conciliação</h1>
          <Link to="/recebimentos/historico" className="ds-button ds-button--ghost ds-button--md">
            Ver Histórico
          </Link>
        </div>
        <RecebimentosStepper activeStep={tabAtiva} onStepClick={setTabAtiva} />
      </header>
      <div className="recebimentos-content-area">
        {tabAtiva === 0 && <TabConfiguracao />}
        {tabAtiva === 1 && <TabFiltro />}
        {tabAtiva === 2 && <TabSelecao />}
        {tabAtiva === 3 && <TabResumo />}
      </div>
    </div>
  );
}

const NovaConciliacaoPage = () => (
  <RecebimentosProvider>
    <NovaConciliacaoContent />
  </RecebimentosProvider>
);

export default NovaConciliacaoPage;
