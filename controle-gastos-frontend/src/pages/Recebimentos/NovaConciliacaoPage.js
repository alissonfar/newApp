import React from 'react';
import { Link } from 'react-router-dom';
import { Tabs, Tab } from '@mui/material';
import { RecebimentosProvider, useRecebimentos } from './context/RecebimentosContext';
import TabConfiguracao from './components/TabConfiguracao';
import TabFiltro from './components/TabFiltro';
import TabSelecao from './components/TabSelecao';
import TabResumo from './components/TabResumo';
import './Recebimentos.css';

function NovaConciliacaoContent() {
  const { tabAtiva, setTabAtiva } = useRecebimentos();

  return (
    <div className="recebimentos-novo-page">
      <header className="recebimentos-novo-header">
        <div className="header-top">
          <h1>Nova Conciliação</h1>
          <Link to="/recebimentos/historico" className="link-historico">
            Ver Histórico
          </Link>
        </div>
        <Tabs
          value={tabAtiva}
          onChange={(_, v) => setTabAtiva(v)}
          variant="scrollable"
          scrollButtons="auto"
          className="recebimentos-tabs-mui"
        >
          <Tab label="1. Configuração" />
          <Tab label="2. Filtro" />
          <Tab label="3. Seleção de Transações" />
          <Tab label="4. Resumo e Confirmação" />
        </Tabs>
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
