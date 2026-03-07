import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { FaArrowLeft, FaSpinner, FaFilter, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import patrimonioApi from '../../services/patrimonioApi';
import PatrimonioStatCard from '../../components/Patrimonio/PatrimonioStatCard';
import Button from '../../components/shared/Button';
import Card from '../../components/shared/Card';
import EmptyState from '../../components/shared/EmptyState';
import PeriodQuickFilter, { PERIODOS_RAPIDOS } from '../../components/shared/PeriodQuickFilter';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './PatrimonioHistoricoPage.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const TIPOS_CONTA = [
  { value: '', label: 'Todos' },
  { value: 'corrente', label: 'Corrente' },
  { value: 'rendimento_automatico', label: 'Rendimento Automático' },
  { value: 'caixinha', label: 'Caixinha' },
  { value: 'investimento_fixo', label: 'Investimento Fixo' },
];

const PROPOSITOS = [
  { value: '', label: 'Todos' },
  { value: 'disponivel', label: 'Disponível' },
  { value: 'reserva_emergencia', label: 'Reserva de Emergência' },
  { value: 'objetivo', label: 'Objetivo' },
  { value: 'guardado', label: 'Guardado' },
];

const ORIGENS = [
  { value: '', label: 'Todas' },
  { value: 'subconta_criacao', label: 'Criação de conta' },
  { value: 'confirmacao_manual', label: 'Confirmação manual' },
  { value: 'importacao_ofx', label: 'Importação OFX' },
  { value: 'importacao_csv', label: 'Importação CSV' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'correcao', label: 'Correção' },
];

const PERIODOS_EVOLUCAO = [
  PERIODOS_RAPIDOS.ULTIMOS_30_DIAS,
  PERIODOS_RAPIDOS.ULTIMOS_3_MESES,
  PERIODOS_RAPIDOS.ULTIMOS_6_MESES,
  PERIODOS_RAPIDOS.ULTIMOS_12_MESES
];

const PatrimonioHistoricoPage = () => {
  const navigate = useNavigate();
  const [patrimonioData, setPatrimonioData] = useState(null);
  const [evolucao, setEvolucao] = useState([]);
  const [carregandoPatrimonio, setCarregandoPatrimonio] = useState(true);
  const [carregandoEvolucao, setCarregandoEvolucao] = useState(true);
  const [dataSelecionada, setDataSelecionada] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataInicio, setDataInicio] = useState(() => format(subMonths(new Date(), 6), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [filtrosExpandidos, setFiltrosExpandidos] = useState(false);
  const [subcontas, setSubcontas] = useState([]);
  const [filtros, setFiltros] = useState({
    subcontaIds: [],
    tipo: '',
    proposito: '',
    origem: '',
  });

  const formatarMoeda = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatarData = (d) => d ? format(new Date(d), 'dd/MM/yyyy', { locale: ptBR }) : '';

  const buildFiltros = useCallback(() => {
    const f = {};
    if (filtros.subcontaIds?.length) f.subcontaIds = filtros.subcontaIds;
    if (filtros.tipo) f.tipo = filtros.tipo;
    if (filtros.proposito) f.proposito = filtros.proposito;
    if (filtros.origem) f.origem = filtros.origem;
    return f;
  }, [filtros]);

  const carregarPatrimonio = useCallback(async () => {
    try {
      setCarregandoPatrimonio(true);
      const data = await patrimonioApi.obterPatrimonioEmData(dataSelecionada, buildFiltros());
      setPatrimonioData(data);
    } catch (err) {
      console.error(err);
      setPatrimonioData({ total: 0, accounts: [] });
    } finally {
      setCarregandoPatrimonio(false);
    }
  }, [dataSelecionada, buildFiltros]);

  const carregarEvolucao = useCallback(async () => {
    try {
      setCarregandoEvolucao(true);
      const data = await patrimonioApi.obterEvolucaoPatrimonioHistorico(
        dataInicio,
        dataFim,
        'month',
        buildFiltros()
      );
      setEvolucao(data);
    } catch (err) {
      console.error(err);
      setEvolucao([]);
    } finally {
      setCarregandoEvolucao(false);
    }
  }, [dataInicio, dataFim, buildFiltros]);

  useEffect(() => {
    patrimonioApi.listarSubcontas().then(setSubcontas).catch(() => setSubcontas([]));
  }, []);

  useEffect(() => {
    carregarPatrimonio();
  }, [carregarPatrimonio]);

  useEffect(() => {
    carregarEvolucao();
  }, [carregarEvolucao]);

  const handlePeriodChange = ({ dataInicio: di, dataFim: df }) => {
    if (di != null) setDataInicio(di);
    if (df != null) setDataFim(df);
  };

  const dadosGrafico = {
    labels: evolucao.map((e) => formatarData(e.date)),
    datasets: [{
      label: 'Patrimônio Total',
      data: evolucao.map((e) => e.total),
      borderColor: 'rgb(33, 150, 243)',
      backgroundColor: 'rgba(33, 150, 243, 0.1)',
      tension: 0.1,
      fill: true,
    }],
  };

  const toggleSubcontaFiltro = (id) => {
    setFiltros((prev) => {
      const ids = prev.subcontaIds || [];
      const has = ids.includes(id);
      return {
        ...prev,
        subcontaIds: has ? ids.filter((x) => x !== id) : [...ids, id],
      };
    });
  };

  return (
    <div className="patrimonio-historico-page">
      <div className="patrimonio-historico-header">
        <Button variant="ghost" icon={<FaArrowLeft size={14} />} onClick={() => navigate('/patrimonio')}>
          Voltar
        </Button>
        <h1>Patrimônio Histórico</h1>
        <p className="patrimonio-historico-subtitle">
          Baseado no Ledger — consulte quanto você possuía em qualquer data
        </p>
      </div>

      <div className="patrimonio-historico-card-principal">
        <PatrimonioStatCard
          label={dataSelecionada === format(new Date(), 'yyyy-MM-dd') ? 'Patrimônio Total (Atual)' : `Patrimônio em ${formatarData(dataSelecionada)}`}
          valor={carregandoPatrimonio ? '...' : formatarMoeda(patrimonioData?.total)}
          icon="piggybank"
          badge={{ label: 'Ledger', variant: 'neutral' }}
        />
      </div>

      <Card className="patrimonio-historico-secao">
        <h3>Patrimônio em data específica</h3>
        <div className="patrimonio-historico-date-picker">
          <label htmlFor="data-patrimonio">Data:</label>
          <input
            id="data-patrimonio"
            type="date"
            className="input-field period-quick-filter__input"
            value={dataSelecionada}
            onChange={(e) => setDataSelecionada(e.target.value)}
          />
        </div>
      </Card>

      <div className="patrimonio-historico-filtros-toggle" onClick={() => setFiltrosExpandidos(!filtrosExpandidos)}>
        <FaFilter size={14} />
        <span>Filtros avançados</span>
        {filtrosExpandidos ? <FaChevronUp size={14} /> : <FaChevronDown size={14} />}
      </div>

      {filtrosExpandidos && (
        <Card className="patrimonio-historico-filtros">
          <div className="filtro-row">
            <label>Tipo de conta</label>
            <select
              value={filtros.tipo}
              onChange={(e) => setFiltros((p) => ({ ...p, tipo: e.target.value }))}
            >
              {TIPOS_CONTA.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="filtro-row">
            <label>Propósito</label>
            <select
              value={filtros.proposito}
              onChange={(e) => setFiltros((p) => ({ ...p, proposito: e.target.value }))}
            >
              {PROPOSITOS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="filtro-row">
            <label>Origem do evento</label>
            <select
              value={filtros.origem}
              onChange={(e) => setFiltros((p) => ({ ...p, origem: e.target.value }))}
            >
              {ORIGENS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {subcontas.length > 0 && (
            <div className="filtro-row filtro-subcontas">
              <label>Contas</label>
              <div className="filtro-subcontas-list">
                {subcontas.map((sc) => {
                  const inst = sc.instituicao;
                  const nome = inst ? `${inst.nome} - ${sc.nome}` : sc.nome;
                  const checked = (filtros.subcontaIds || []).includes(sc._id);
                  return (
                    <label key={sc._id} className="filtro-checkbox">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSubcontaFiltro(sc._id)}
                      />
                      <span>{nome}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="patrimonio-historico-secao">
        <h3>Evolução do patrimônio</h3>
        <PeriodQuickFilter
          dataInicio={dataInicio}
          dataFim={dataFim}
          onChange={handlePeriodChange}
          periods={PERIODOS_EVOLUCAO}
          showCustomInputs={true}
          compact={true}
        />

        {carregandoEvolucao ? (
          <div className="patrimonio-historico-loading">
            <FaSpinner className="spinner" />
            <p>Carregando evolução...</p>
          </div>
        ) : evolucao.length > 0 ? (
          <div className="patrimonio-historico-grafico">
            <Line
              data={dadosGrafico}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => formatarMoeda(ctx.raw),
                    },
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: { callback: (v) => `R$ ${v}` },
                  },
                },
              }}
              height={300}
            />
          </div>
        ) : (
          <EmptyState message="Nenhum dado de evolução no período. Eventos são criados ao confirmar saldo, importar OFX/CSV e confirmar transferências." />
        )}
      </Card>

      <Card className="patrimonio-historico-secao">
        <h3>Breakdown por contas</h3>
        {carregandoPatrimonio ? (
          <div className="patrimonio-historico-loading pequeno">
            <FaSpinner className="spinner" />
          </div>
        ) : patrimonioData?.accounts?.length > 0 ? (
          <table className="patrimonio-historico-tabela">
            <thead>
              <tr>
                <th>Conta</th>
                <th>Saldo na data</th>
              </tr>
            </thead>
            <tbody>
              {patrimonioData.accounts.map((acc) => (
                <tr key={acc.accountId}>
                  <td>{acc.accountName}</td>
                  <td className="valor">{formatarMoeda(acc.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Nenhuma conta com saldo na data selecionada." />
        )}
      </Card>
    </div>
  );
};

export default PatrimonioHistoricoPage;
