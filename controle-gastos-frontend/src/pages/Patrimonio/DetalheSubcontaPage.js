import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { FaArrowLeft, FaCheck, FaSpinner } from 'react-icons/fa';
import patrimonioApi from '../../services/patrimonioApi';
import { calcularPeriodoFatura } from '../../utils/faturaUtils';
import { formatDateBR, PERIODOS_RAPIDOS } from '../../utils/dateUtils';
import PatrimonioStatCard from '../../components/Patrimonio/PatrimonioStatCard';
import EventosLedgerTable, { LABEL_POR_TIPO_EVENTO } from '../../components/Patrimonio/EventosLedgerTable';
import PeriodQuickFilter from '../../components/shared/PeriodQuickFilter';
import Pagination from '../../components/shared/Pagination';
import SectionHeader from '../../components/shared/SectionHeader';
import Button from '../../components/shared/Button';
import EmptyState from '../../components/shared/EmptyState';
import { useBreadcrumbOverride } from '../../context/BreadcrumbContext';
import '../../components/Patrimonio/PatrimonioForm.css';
import './DetalheSubcontaPage.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

function getMonthRangeFromAnoMes(anoMes) {
  const partes = String(anoMes).split('-');
  const ano = parseInt(partes[0]);
  const mes = parseInt(partes[1]) - 1;
  const inicio = ano + '-' + String(mes + 1).padStart(2, '0') + '-01';
  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  const fim = ano + '-' + String(mes + 1).padStart(2, '0') + '-' + String(ultimoDia).padStart(2, '0');
  return { inicio, fim, ano, mes };
}

function gerarOpcoesMes() {
  const hoje = new Date();
  const opcoes = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const value = ano + '-' + mes;
    opcoes.push({ value, label });
  }
  return opcoes;
}

function mesAtual() {
  const hoje = new Date();
  return hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
}

const DetalheSubcontaPage = () => {
  const { subcontaId } = useParams();
  const navigate = useNavigate();
  const [subconta, setSubconta] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [rendimento, setRendimento] = useState(null);
  const [transacoes, setTransacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [modalConfirmar, setModalConfirmar] = useState(false);
  const [novoSaldo, setNovoSaldo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [tipoRegistro, setTipoRegistro] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [agruparPorTipo, setAgruparPorTipo] = useState(false);
  const [eventosLedger, setEventosLedger] = useState([]);
  const [saldoLedger, setSaldoLedger] = useState(null);
  const [filtroTipoLedger, setFiltroTipoLedger] = useState('');
  const [faturaMes, setFaturaMes] = useState(null);
  const [totalComprasMes, setTotalComprasMes] = useState(null);
  const [totalPagamentosMes, setTotalPagamentosMes] = useState(null);
  const [faturaMesPeriodo, setFaturaMesPeriodo] = useState(null);
  const [anoMes, setAnoMes] = useState(mesAtual());

  const [ledgerDraftInicio, setLedgerDraftInicio] = useState('');
  const [ledgerDraftFim, setLedgerDraftFim] = useState('');
  const [ledgerDataInicio, setLedgerDataInicio] = useState('');
  const [ledgerDataFim, setLedgerDataFim] = useState('');
  const [ledgerPagina, setLedgerPagina] = useState(1);
  const [ledgerLimite, setLedgerLimite] = useState(50);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerTotalPaginas, setLedgerTotalPaginas] = useState(0);

  const OPCOES_MES = gerarOpcoesMes();

  const carregar = useCallback(async () => {
    if (!subcontaId) return;
    try {
      setCarregando(true);
      const [sc, hist, rend, trans, saldoL] = await Promise.all([
        patrimonioApi.obterSubconta(subcontaId),
        patrimonioApi.obterHistorico(subcontaId, filtroTipo ? { tipo: filtroTipo } : {}),
        patrimonioApi.obterRendimentoEstimado(subcontaId),
        patrimonioApi.listarTransacoesPorSubconta(subcontaId),
        patrimonioApi.obterSaldoPorLedger(subcontaId)
      ]);
      setSubconta(sc);
      setHistorico(hist);
      setRendimento(rend);
      setTransacoes(trans);
      setSaldoLedger(saldoL?.saldo ?? null);
      setNovoSaldo(String(sc?.saldoAtual || 0));

      if (sc?.tipo === 'cartao_credito') {
        const periodo = calcularPeriodoFatura(sc.fechamentoFatura, anoMes);
        setFaturaMesPeriodo(periodo);

        const range = getMonthRangeFromAnoMes(anoMes);
        const filtrosCred = {
          dataInicio: periodo ? periodo.dataInicio.toISOString() : range.inicio,
          dataFim: periodo ? periodo.dataFim.toISOString() : range.fim,
          limit: 100
        };
        let compras = 0;
        let pagamentos = 0;
        let credPage = 1;
        let hasMore = true;
        while (hasMore) {
          const result = await patrimonioApi.obterEventosLedger(subcontaId, { ...filtrosCred, page: credPage });
          const events = result.data || [];
          for (const ev of events) {
            if (ev.tipoEvento === 'compra_credito') {
              compras += Math.abs(ev.valor);
            } else if (ev.tipoEvento === 'pagamento_fatura') {
              pagamentos += ev.valor;
            }
          }
          hasMore = credPage < (result.totalPages || 1);
          credPage++;
        }
        setTotalComprasMes(compras);
        setTotalPagamentosMes(pagamentos);
        setFaturaMes(compras);
      } else {
        setFaturaMes(null);
        setTotalComprasMes(null);
        setTotalPagamentosMes(null);
        setFaturaMesPeriodo(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  }, [subcontaId, filtroTipo, anoMes]);

  useEffect(() => {
    carregar();
  }, [carregar, subcontaId]);

  const carregarLedger = useCallback(async () => {
    if (!subcontaId) return;
    try {
      const filtros = {};
      if (filtroTipoLedger) filtros.tipoEvento = filtroTipoLedger;
      if (ledgerDataInicio) filtros.dataInicio = ledgerDataInicio;
      if (ledgerDataFim) filtros.dataFim = ledgerDataFim;
      filtros.page = ledgerPagina;
      filtros.limit = ledgerLimite;
      const result = await patrimonioApi.obterEventosLedger(subcontaId, filtros);
      setEventosLedger(result.data || []);
      setLedgerTotal(result.total || 0);
      setLedgerTotalPaginas(result.totalPages || 0);
    } catch (err) {
      console.error('Erro ao carregar ledger paginado:', err);
    }
  }, [subcontaId, filtroTipoLedger, ledgerDataInicio, ledgerDataFim, ledgerPagina, ledgerLimite]);

  useEffect(() => {
    carregarLedger();
  }, [carregarLedger]);

  const handleAplicarFiltroLedger = () => {
    setLedgerDataInicio(ledgerDraftInicio);
    setLedgerDataFim(ledgerDraftFim);
    setLedgerPagina(1);
  };

  const handleLedgerLimiteChange = (e) => {
    setLedgerLimite(Number(e.target.value));
    setLedgerPagina(1);
  };

  useBreadcrumbOverride(subconta?.nome);

  const formatarMoeda = (v) => 'R$ ' + ((v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const formatarData = (d) => d ? formatDateBR(d) : '-';

  const obterClasseVariacao = (delta, tipo) => {
    if (tipo === 'rendimento') return 'variacao-rendimento';
    if (delta > 0) return 'variacao-positiva';
    if (delta < 0) return 'variacao-negativa';
    return '';
  };

  const TIPOS_OPCOES = [
    { value: '', label: 'Todos' },
    { value: 'rendimento', label: 'Rendimento' },
    { value: 'aporte', label: 'Aporte' },
    { value: 'transferencia_entrada', label: 'Transferência entrada' },
    { value: 'transferencia_saida', label: 'Transferência saída' },
    { value: 'ajuste', label: 'Ajuste' }
  ];

  const LABEL_POR_TIPO = Object.fromEntries(TIPOS_OPCOES.filter((o) => o.value).map((o) => [o.value, o.label]));

  const TIPOS_EVENTO_OPCOES = [
    { value: '', label: 'Todos' },
    ...Object.entries(LABEL_POR_TIPO_EVENTO).map(([value, label]) => ({ value, label }))
  ];

  const consistente = saldoLedger != null && subconta && Math.abs((subconta.saldoAtual ?? 0) - saldoLedger) <= 0.01;
  const isCartaoCredito = subconta?.tipo === 'cartao_credito';

  const calcularEstatisticas = () => {
    const stats = { aportes: 0, rendimentos: 0, transferenciasEntrada: 0, transferenciasSaida: 0 };
    historico.forEach((h, i) => {
      const saldoAnterior = historico[i + 1]?.saldo;
      if (saldoAnterior == null) return;
      const delta = h.saldo - saldoAnterior;
      const tipo = h.tipo || 'ajuste';
      if (tipo === 'aporte' && delta > 0) stats.aportes += delta;
      if (tipo === 'rendimento') stats.rendimentos += delta;
      if (tipo === 'transferencia_entrada') stats.transferenciasEntrada += delta;
      if (tipo === 'transferencia_saida') stats.transferenciasSaida += Math.abs(delta);
    });
    return stats;
  };

  const historicoAgrupado = agruparPorTipo
    ? Object.entries(
        historico.reduce((acc, h) => {
          const t = h.tipo || 'ajuste';
          if (!acc[t]) acc[t] = [];
          acc[t].push(h);
          return acc;
        }, {})
      ).sort((a, b) => a[0].localeCompare(b[0]))
    : null;

  const formatarVariacao = (h, index) => {
    const saldoAnterior = historico[index + 1]?.saldo;
    if (saldoAnterior == null) return { texto: '—', classe: '' };
    const delta = h.saldo - saldoAnterior;
    const tipo = h.tipo || 'ajuste';
    const classe = obterClasseVariacao(delta, tipo);
    const sinal = delta > 0 ? '+' : '';
    return { texto: sinal + formatarMoeda(delta), classe };
  };

  const dadosGrafico = {
    labels: historico.slice().reverse().map((h) => formatarData(h.data)),
    datasets: [{
      label: 'Saldo',
      data: historico.slice().reverse().map((h) => h.saldo),
      borderColor: 'rgb(33, 150, 243)',
      tension: 0.1,
      fill: false
    }]
  };

  const TIPOS_CONFIRMAR = isCartaoCredito
    ? [{ value: 'ajuste', label: 'Ajuste' }]
    : [
        { value: 'rendimento', label: 'Rendimento' },
        { value: 'aporte', label: 'Aporte' },
        { value: 'transferencia_entrada', label: 'Transferência entrada' },
        { value: 'transferencia_saida', label: 'Transferência saída' },
        { value: 'ajuste', label: 'Ajuste' }
      ];

  const handleConfirmarSaldo = async () => {
    const saldoNum = parseFloat(novoSaldo);
    if (isNaN(saldoNum)) return;
    if (!tipoRegistro) return;
    try {
      setConfirmando(true);
      await patrimonioApi.confirmarSaldo(subcontaId, { saldo: saldoNum, observacao, tipo: tipoRegistro });
      setModalConfirmar(false);
      setTipoRegistro('');
      carregar();
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmando(false);
    }
  };

  if (carregando) {
    return (
      <div className="detalhe-subconta-page">
        <div className="detalhe-loading">
          <FaSpinner className="spinner" />
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!subconta) {
    return (
      <div className="detalhe-subconta-page">
        <EmptyState message="Subconta não encontrada.">
          <Button variant="primary" icon={<FaArrowLeft size={14} />} onClick={() => navigate('/patrimonio/contas')}>
            Voltar
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="detalhe-subconta-page">
      <div className="detalhe-header">
        <Button variant="ghost" icon={<FaArrowLeft size={14} />} onClick={() => navigate('/patrimonio/contas')}>
          Voltar
        </Button>
        <h1>{subconta.instituicao?.nome} - {subconta.nome}</h1>
      </div>

      <div className="detalhe-cards">
        <PatrimonioStatCard
          label={isCartaoCredito ? 'Saldo Devedor' : 'Saldo Confirmado'}
          valor={formatarMoeda(subconta.saldoAtual)}
          icon={isCartaoCredito ? 'creditcard' : 'piggybank'}
          badge={saldoLedger != null ? {
             label: consistente ? 'Consistente com ledger' : 'Verificar consist\u00eancia',
            variant: consistente ? 'success' : 'warning'
          } : null}
        />
        {isCartaoCredito && (
          <div className="detalhe-mes-filtro">
            <label>{'M\u00eas da fatura:'}</label>
            <select
              value={anoMes}
              onChange={(e) => setAnoMes(e.target.value)}
            >
              {OPCOES_MES.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}
        {isCartaoCredito && faturaMes != null && (
          <PatrimonioStatCard
            label={'Fatura do m\u00eas'}
            valor={formatarMoeda(faturaMes)}
            icon="creditcard"
            badge={{ label: faturaMesPeriodo?.label || 'M\u00eas atual', variant: faturaMes > 0 ? 'warning' : 'success' }}
            corBorda="#f44336"
          />
        )}
        {isCartaoCredito && totalComprasMes != null && (
          <PatrimonioStatCard
            label={'Compras no M\u00eas'}
            valor={formatarMoeda(totalComprasMes)}
            icon="chartline"
            badge={{ label: 'Compras no per\u00edodo', variant: 'neutral' }}
          />
        )}
        {isCartaoCredito && totalPagamentosMes != null && (
          <PatrimonioStatCard
            label={'Pagamentos no M\u00eas'}
            valor={formatarMoeda(totalPagamentosMes)}
            icon="chartline"
            badge={{ label: 'Pagamentos no per\u00edodo', variant: 'neutral' }}
          />
        )}
        {!isCartaoCredito && subconta.percentualCDI > 0 && rendimento && (
          <div className="projecao-rendimento-card">
            <h4>Projeção de Rendimento</h4>
            <p><strong>Saldo hoje:</strong> {formatarMoeda(rendimento.saldoAtual)}</p>
            <p><strong>Amanhã:</strong> {formatarMoeda((rendimento.saldoAtual || 0) + (rendimento.rendimentoDiario || 0))} <span className="variacao-positiva">(+{formatarMoeda(rendimento.rendimentoDiario)})</span></p>
            <p><strong>Projeção mensal estimada:</strong> <span className="variacao-positiva">+{formatarMoeda(rendimento.rendimentoMensal)}</span></p>
          </div>
        )}
        {!isCartaoCredito && rendimento && (rendimento.rendimentoMensal > 0 || rendimento.rendimentoDiario > 0) && (
          <PatrimonioStatCard
            label="Rendimento Estimado (mês)"
            valor={formatarMoeda(rendimento.rendimentoMensal)}
            icon="chartline"
            badge={{
              label: (
                <>
                  {'Estimativa - ' + rendimento.percentualCDI + '% CDI · '}
                  <button
                    type="button"
                    className="detalhe-subconta-simular-link"
                    onClick={() => navigate(
                      '/patrimonio/simulador?valor=' + encodeURIComponent(subconta?.saldoAtual || 0) + '&percentual=' + encodeURIComponent(rendimento.percentualCDI || 100)
                    )}
                  >
                    Simular
                  </button>
                </>
              ),
              variant: 'neutral'
            }}
          />
        )}
      </div>
      <p className="detalhe-data-confirmacao">
        Última confirmação: {formatarData(subconta.dataUltimaConfirmacao)}
      </p>

      {!isCartaoCredito && (
        <>
          <div className="detalhe-section">
            <SectionHeader title="Histórico de Saldo">
              <Button variant="success" icon={<FaCheck size={14} />} onClick={() => setModalConfirmar(true)}>
                Confirmar Saldo
              </Button>
            </SectionHeader>
            {historico.length > 0 ? (
              <div className="grafico-container">
                <Line
                  data={dadosGrafico}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: { callback: (v) => 'R$ ' + v }
                      }
                    }
                  }}
                  height={200}
                />
              </div>
            ) : (
              <EmptyState message="Nenhum histórico ainda. Confirme o saldo para criar o primeiro registro." />
            )}
          </div>

          <div className="detalhe-section">
            <SectionHeader title="Registros de Histórico" />
            {historico.length > 0 && (
              <>
                <div className="historico-filtros">
                  <div className="historico-filtro-item">
                    <label htmlFor="filtro-tipo">Filtro por tipo:</label>
                    <select
                      id="filtro-tipo"
                      value={filtroTipo}
                      onChange={(e) => setFiltroTipo(e.target.value)}
                    >
                      {TIPOS_OPCOES.map((opt) => (
                        <option key={opt.value || 'todos'} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <label className="historico-agrupar">
                    <input
                      type="checkbox"
                      checked={agruparPorTipo}
                      onChange={(e) => setAgruparPorTipo(e.target.checked)}
                    />
                    Agrupar por tipo
                  </label>
                </div>
                {(() => {
                  const stats = calcularEstatisticas();
                  const temStats = stats.aportes > 0 || stats.rendimentos > 0 || stats.transferenciasEntrada > 0 || stats.transferenciasSaida > 0;
                  return temStats ? (
                    <div className="historico-estatisticas">
                      {stats.aportes > 0 && <span>Total aportes: {formatarMoeda(stats.aportes)}</span>}
                      {stats.rendimentos > 0 && <span>Total rendimentos: {formatarMoeda(stats.rendimentos)}</span>}
                      {stats.transferenciasEntrada > 0 && <span>Transferências entrada: {formatarMoeda(stats.transferenciasEntrada)}</span>}
                      {stats.transferenciasSaida > 0 && <span>Transferências saída: {formatarMoeda(stats.transferenciasSaida)}</span>}
                    </div>
                  ) : null;
                })()}
              </>
            )}
            {historico.length > 0 ? (
              agruparPorTipo && historicoAgrupado ? (
                <div className="historico-agrupado">
                  {historicoAgrupado.map(([tipo, itens]) => (
                    <div key={tipo} className="historico-grupo">
                      <h5>{LABEL_POR_TIPO[tipo] || tipo}</h5>
                      <table className="tabela-historico">
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Saldo</th>
                            <th>Variação</th>
                            <th>Origem</th>
                            <th>Observação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itens.map((h, idx) => {
                            const idxGlobal = historico.indexOf(h);
                            const { texto, classe } = formatarVariacao(h, idxGlobal);
                            return (
                              <tr key={h._id}>
                                <td>{formatarData(h.data)}</td>
                                <td>{formatarMoeda(h.saldo)}</td>
                                <td className={classe ? 'tabela-historico-variacao ' + classe : ''}>{texto}</td>
                                <td>{h.origem}</td>
                                <td>{h.observacao || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ) : (
              <table className="tabela-historico">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Saldo</th>
                    <th>Variação</th>
                    <th>Origem</th>
                    <th>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h, index) => {
                    const { texto, classe } = formatarVariacao(h, index);
                    return (
                      <tr key={h._id}>
                        <td>{formatarData(h.data)}</td>
                        <td>{formatarMoeda(h.saldo)}</td>
                        <td className={classe ? 'tabela-historico-variacao ' + classe : ''}>{texto}</td>
                        <td>{h.origem}</td>
                        <td>{h.observacao || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              )
            ) : null}
          </div>
        </>
      )}

      <div className="detalhe-section">
        <SectionHeader title="Eventos do Ledger (Auditoria)">
          {isCartaoCredito && (
            <Button variant="success" icon={<FaCheck size={14} />} onClick={() => setModalConfirmar(true)}>
              Confirmar Saldo
            </Button>
          )}
        </SectionHeader>
        <div className="historico-filtros">
          <div className="historico-filtro-item">
            <label htmlFor="filtro-tipo-ledger">Tipo:</label>
            <select
              id="filtro-tipo-ledger"
              value={filtroTipoLedger}
              onChange={(e) => { setFiltroTipoLedger(e.target.value); setLedgerPagina(1); }}
            >
              {TIPOS_EVENTO_OPCOES.map((opt) => (
                <option key={opt.value || 'todos'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="historico-filtro-item">
            <label>Limite:</label>
            <select value={ledgerLimite} onChange={handleLedgerLimiteChange}>
              <option value={10}>10</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
        <div className="ledger-filtro-periodo">
          <PeriodQuickFilter
            dataInicio={ledgerDraftInicio}
            dataFim={ledgerDraftFim}
            onChange={({ dataInicio, dataFim }) => {
              setLedgerDraftInicio(dataInicio);
              setLedgerDraftFim(dataFim);
            }}
            onPeriodSelect={() => {}}
            periods={[
              PERIODOS_RAPIDOS.MES_ATUAL,
              PERIODOS_RAPIDOS.MES_ANTERIOR,
              PERIODOS_RAPIDOS.ULTIMOS_7_DIAS,
              PERIODOS_RAPIDOS.ULTIMOS_30_DIAS,
              PERIODOS_RAPIDOS.ULTIMOS_60_DIAS
            ]}
            compact
          />
          <Button variant="primary" size="sm" onClick={handleAplicarFiltroLedger}>
            Aplicar
          </Button>
        </div>
        {eventosLedger.length > 0 ? (
          <>
            <EventosLedgerTable
              eventos={eventosLedger}
              formatarMoeda={formatarMoeda}
              formatarData={formatarData}
            />
            <Pagination
              page={ledgerPagina}
              totalPages={ledgerTotalPaginas}
              totalRecords={ledgerTotal}
              onPageChange={setLedgerPagina}
            />
          </>
        ) : (
          <EmptyState message="Nenhum evento encontrado para os filtros selecionados." />
        )}
      </div>

      <div className="detalhe-section">
        <SectionHeader title="Transações Vinculadas" />
        {transacoes.length > 0 ? (
          <ul className="lista-transacoes">
            {transacoes.map((t) => (
              <li key={t._id || t.id}>
                <span>{formatarData(t.data)}</span>
                <span>{t.descricao}</span>
                <span className={t.tipo === 'recebivel' ? 'positivo' : 'negativo'}>
                  {t.tipo === 'recebivel' ? '+' : '-'}{formatarMoeda(t.valor)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Nenhuma transação vinculada a esta subconta." />
        )}
      </div>

      {modalConfirmar && (
        <div className="patrimonio-modal-overlay" onClick={() => setModalConfirmar(false)}>
          <div className="patrimonio-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Confirmar Saldo</h3>
            <div className="form-group">
              <label>Novo saldo</label>
              <input
                type="number"
                step="0.01"
                value={novoSaldo}
                onChange={(e) => setNovoSaldo(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Tipo do registro <span className="obrigatorio">*</span></label>
              <div className="form-radio-group">
                {TIPOS_CONFIRMAR.map((opt) => (
                  <label key={opt.value} className="form-radio-label">
                    <input
                      type="radio"
                      name="tipoRegistro"
                      value={opt.value}
                      checked={tipoRegistro === opt.value}
                      onChange={(e) => setTipoRegistro(e.target.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Observação (opcional)</label>
              <input
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Conferência do extrato"
              />
            </div>
            <div className="form-actions">
              <Button type="button" variant="ghost" onClick={() => setModalConfirmar(false)}>Cancelar</Button>
              <Button onClick={handleConfirmarSaldo} disabled={confirmando || !tipoRegistro}>
                {confirmando ? <FaSpinner className="spinner-inline" /> : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetalheSubcontaPage;
