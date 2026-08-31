// src/pages/Fechamento/Fechamento.js
import React, { useState } from 'react';
import { FaPlus, FaFileDownload } from 'react-icons/fa';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { toast } from 'react-toastify';
import PageHeader from '../../components/shared/PageHeader';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import StatCard from '../../components/shared/StatCard';
import PeriodQuickFilter from '../../components/shared/PeriodQuickFilter';
import FechamentoInstanciaCard from '../../components/Fechamento/FechamentoInstanciaCard';
import NovaInstanciaModal from '../../components/Fechamento/NovaInstanciaModal';
import LinkarRecebimentoModal from '../../components/Fechamento/LinkarRecebimentoModal';
import useFechamento from '../../hooks/useFechamento';
import { obterTransacoesInstanciaFechamento } from '../../api';
import { useData } from '../../context/DataContext';
import { exportDataToPDF } from '../../utils/export/exportPDF';
import { exportarFechamentosEmLote } from '../../utils/export/exportFechamentoZip';
import { extrairValorModelo } from '../../utils/fechamentoResumo';
import { PERIODOS_RAPIDOS } from '../../utils/dateUtils';
import './Fechamento.css';

const PERIODOS_FECHAMENTO = [
  PERIODOS_RAPIDOS.MES_ATUAL,
  PERIODOS_RAPIDOS.PROXIMO_MES,
  PERIODOS_RAPIDOS.PROXIMOS_30_DIAS,
  PERIODOS_RAPIDOS.ULTIMOS_7_DIAS,
  PERIODOS_RAPIDOS.ULTIMOS_30_DIAS,
  PERIODOS_RAPIDOS.ESTE_ANO,
  PERIODOS_RAPIDOS.MES_ANTERIOR
];

function mesAtualISO() {
  const hoje = new Date();
  const inicio = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth(), 1));
  const fim = new Date(Date.UTC(hoje.getFullYear(), hoje.getMonth() + 1, 0));
  return {
    dataInicio: inicio.toISOString().slice(0, 10),
    dataFim: fim.toISOString().slice(0, 10)
  };
}

const Fechamento = () => {
  const { categorias = [], tags = [] } = useData();
  const [periodo, setPeriodo] = useState(mesAtualISO());
  const [quickPeriod, setQuickPeriod] = useState(PERIODOS_RAPIDOS.MES_ATUAL);
  const [modalNovaInstancia, setModalNovaInstancia] = useState(false);
  const [instanciaParaLinkar, setInstanciaParaLinkar] = useState(null);
  const [exportandoLote, setExportandoLote] = useState(false);

  const {
    instancias,
    loading,
    expandidas,
    detalhes,
    selecionadas,
    alternarExpandida,
    criarInstancia,
    duplicar,
    atualizarStatus,
    linkarRecebimento,
    alternarSelecao,
    selecionarTodas
  } = useFechamento(periodo);

  const valorModeloDaInstancia = (i) => extrairValorModelo(i.resumoModelo, i.cadastro?.modeloRelatorio?.aggregation);

  const totalAReceber = instancias.reduce((s, i) => s + valorModeloDaInstancia(i), 0);
  const totalRecebido = instancias
    .filter((i) => i.status === 'recebido')
    .reduce((s, i) => s + valorModeloDaInstancia(i), 0);
  const totalAguardando = instancias
    .filter((i) => i.status === 'aguardando_recebimento')
    .reduce((s, i) => s + valorModeloDaInstancia(i), 0);

  const handleGerarPDF = async (instancia) => {
    const detalheExistente = detalhes[instancia._id];
    const detalhe = detalheExistente || await obterTransacoesInstanciaFechamento(instancia._id);
    const rows = detalhe.rows || [];
    const resumo = detalhe.resumoModelo || instancia.resumoModelo;
    const pessoa = instancia.cadastro?.pessoa?.nome || 'pessoa';
    const periodoLabel = `${periodo.dataInicio}_${periodo.dataFim}`;
    await exportDataToPDF(
      rows,
      { dataInicio: periodo.dataInicio, dataFim: periodo.dataFim, selectedPessoas: [pessoa] },
      resumo,
      categorias,
      tags,
      `fechamento-${pessoa}-${periodoLabel}.pdf`,
      instancia.cadastro?.modeloRelatorio?.aggregation || 'default'
    );
  };

  const handleExportarLote = async () => {
    const selecionadasArr = instancias.filter((i) => selecionadas.has(i._id));
    if (selecionadasArr.length === 0) return;
    setExportandoLote(true);
    try {
      await exportarFechamentosEmLote(selecionadasArr, categorias, tags, periodo);
    } catch (err) {
      toast.error(err.message || 'Erro ao exportar em lote.');
    } finally {
      setExportandoLote(false);
    }
  };

  return (
    <div className="fechamento-page">
      <PageHeader
        icon={<AssignmentTurnedInIcon />}
        title="Fechamento"
        subtitle="Acompanhe o fechamento de cada pessoa lado a lado, período a período."
        action={
          <Button variant="primary" onClick={() => setModalNovaInstancia(true)}>
            <FaPlus /> Nova Instância
          </Button>
        }
      />

      <Card variant="glass" padding="md" className="fechamento-filterbar">
        <PeriodQuickFilter
          value={quickPeriod}
          periods={PERIODOS_FECHAMENTO}
          dataInicio={periodo.dataInicio}
          dataFim={periodo.dataFim}
          onChange={setPeriodo}
          onPeriodSelect={({ period }) => setQuickPeriod(period)}
        />
      </Card>

      <div className="fechamento-summary-strip">
        <StatCard label="Instâncias no período" value={instancias.length} />
        <StatCard label="Total a receber" value={totalAReceber.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
        <StatCard label="Já recebido" value={totalRecebido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} accentColor="var(--cg-color-success)" />
        <StatCard label="Aguardando" value={totalAguardando.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} accentColor="var(--cg-color-warning)" />
      </div>

      <div className="fechamento-bulkbar">
        <label className="fechamento-bulkbar__left">
          <input
            type="checkbox"
            checked={selecionadas.size > 0 && selecionadas.size === instancias.length}
            onChange={(e) => selecionarTodas(e.target.checked)}
          />
          Selecionar todos ({instancias.length})
        </label>
        <Button
          variant="ghost"
          size="sm"
          disabled={selecionadas.size === 0}
          loading={exportandoLote}
          onClick={handleExportarLote}
        >
          <FaFileDownload /> Exportar selecionados (.zip)
        </Button>
      </div>

      {loading && <p>Carregando...</p>}
      {!loading && instancias.length === 0 && (
        <p className="fechamento-empty">Nenhuma instância de Fechamento neste período.</p>
      )}

      <div className="fechamento-grid">
        {instancias.map((instancia) => (
          <FechamentoInstanciaCard
            key={instancia._id}
            instancia={instancia}
            expandida={expandidas.has(instancia._id)}
            detalhe={detalhes[instancia._id]}
            selecionada={selecionadas.has(instancia._id)}
            onToggleSelecao={alternarSelecao}
            onToggleExpandir={alternarExpandida}
            onGerarPDF={handleGerarPDF}
            onDuplicar={duplicar}
            onAvancarStatus={atualizarStatus}
            onAbrirLinkRecebimento={setInstanciaParaLinkar}
          />
        ))}
      </div>

      {modalNovaInstancia && (
        <NovaInstanciaModal
          onClose={() => setModalNovaInstancia(false)}
          onCriar={criarInstancia}
        />
      )}

      {instanciaParaLinkar && (
        <LinkarRecebimentoModal
          instancia={instanciaParaLinkar}
          onClose={() => setInstanciaParaLinkar(null)}
          onLinkar={linkarRecebimento}
        />
      )}
    </div>
  );
};

export default Fechamento;
