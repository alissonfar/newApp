// src/pages/Home/Home.js
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'react-calendar';
import { FaPlus, FaCopy, FaArrowDown, FaArrowUp, FaChartLine, FaFileInvoiceDollar, FaRegStickyNote, FaExclamationTriangle, FaUserTie, FaSpinner, FaCalendarDay, FaCalendarWeek, FaCalendarAlt } from 'react-icons/fa';
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
import ModalTransacao from '../../components/Modal/ModalTransacao';
import NovaTransacaoForm from '../../components/Transaction/NovaTransacaoForm';
import DayDetailModal from '../../components/Modal/DayDetailModal';
import { AuthContext } from '../../context/AuthContext';
import './Home.css';
import { formatDateBR, getTodayBR } from '../../utils/dateUtils';
import { formatarMoeda } from '../../utils/format';
import useDashboardData from '../../hooks/useDashboardData';
import Card, { CardHeader, CardContent } from '../../components/shared/Card';
import SectionHeader from '../../components/shared/SectionHeader';
import SegmentedControl from '../../components/shared/SegmentedControl';
import Button from '../../components/shared/Button';
import EmptyState from '../../components/shared/EmptyState';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const Home = () => {
  const navigate = useNavigate();
  const { usuario, carregando: carregandoUsuario } = useContext(AuthContext);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDateTransactions, setSelectedDateTransactions] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDayModalOpen, setIsDayModalOpen] = useState(false);
  const [notas, setNotas] = useState(() => {
    const notasSalvas = localStorage.getItem('notas');
    return notasSalvas ? JSON.parse(notasSalvas) : [];
  });
  const [novaNota, setNovaNota] = useState('');
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Novos estados para filtros e busca
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [buscaTransacao, setBuscaTransacao] = useState('');
  const [transacaoDuplicar, setTransacaoDuplicar] = useState(null);

  const proprietario = usuario?.preferencias?.proprietario || '';
  const usuarioCarregado = !carregandoUsuario;

  const {
    transacoes,
    resumoPeriodo,
    transacoesPorData,
    dadosGrafico,
    semDados,
    carregandoDados,
    proprietarioExibicao,
    periodoSelecionado,
    setPeriodoSelecionado,
    fetchTransacoes
  } = useDashboardData(proprietario, usuarioCarregado);

  const semProprietario = usuarioCarregado && !proprietario;

  useEffect(() => {
    localStorage.setItem('notas', JSON.stringify(notas));
  }, [notas]);

  const adicionarNota = (e) => {
    e.preventDefault();
    if (!novaNota.trim()) return;

    const novasNotas = [...notas, {
      id: Date.now(),
      texto: novaNota,
      data: getTodayBR()
    }];
    setNotas(novasNotas);
    setNovaNota('');
  };

  const removerNota = (id) => {
    const novasNotas = notas.filter(nota => nota.id !== id);
    setNotas(novasNotas);
  };

  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    
    const dataFormatada = new Date(date.setHours(0, 0, 0, 0)).toISOString().split('T')[0];
    const transacoesDia = transacoesPorData[dataFormatada] || [];
    
    if (transacoesDia.length === 0) return null;

    return (
      <div className="calendar-tile-content">
        <div className="transaction-dot" />
      </div>
    );
  };

  const handleDayClick = (value) => {
    const dataFormatada = new Date(value.setHours(0, 0, 0, 0)).toISOString().split('T')[0];
    const transacoesDoDia = transacoesPorData[dataFormatada] || [];

    if (transacoesDoDia.length > 0) {
      transacoesDoDia.sort((a, b) => a.descricao.localeCompare(b.descricao)); 
      setSelectedDateTransactions(transacoesDoDia);
      setSelectedDate(value);
      setIsDayModalOpen(true);
    } else {
      setCalendarDate(value);
    }
  };

  const handleNovaTransacao = () => {
    setModalOpen(true);
  };

  const handleVerRelatorio = () => {
    navigate('/relatorio');
  };

  const handleVerTransacoes = () => {
    navigate('/relatorio');
  };

  const handleDuplicarTransacao = (transacao) => {
    setTransacaoDuplicar(transacao);
    setModalOpen(true);
  };

  // Filtrar transações para exibição
  const transacoesFiltradas = transacoes.filter(t => {
    const matchTipo = filtroTipo === 'todos' || t.tipo === filtroTipo;
    const matchBusca = !buscaTransacao ||
      t.descricao.toLowerCase().includes(buscaTransacao.toLowerCase()) ||
      t.pagamentos?.some(p => p.pessoa?.toLowerCase().includes(buscaTransacao.toLowerCase()));
    return matchTipo && matchBusca;
  });

  // Calcular estatísticas adicionais
  const getDiasNoMes = () => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  };

  const getDiasDecorridos = () => {
    return new Date().getDate();
  };

  const mediaDiariaGastos = resumoPeriodo.totalGastos / (getDiasDecorridos() || 1);
  const projecaoMes = mediaDiariaGastos * getDiasNoMes();

  // Taxa de economia: percentual do que você economizou em relação ao que recebeu
  // Se recebeu R$ 100 e gastou R$ 30, economizou 70%
  // Se recebeu R$ 100 e gastou R$ 120, teve déficit de -20%
  const taxaEconomia = resumoPeriodo.totalRecebiveis > 0
    ? ((resumoPeriodo.saldo / resumoPeriodo.totalRecebiveis) * 100)
    : 0;

  const mediaDiariaRecebiveis = resumoPeriodo.totalRecebiveis / (getDiasDecorridos() || 1);

  return (
    <div className="home-container p-4 md:p-5 lg:p-6 bg-gray-50 min-h-screen">
      <div className="dashboard-header mb-5">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2">
          Dashboard {proprietarioExibicao ? `- ${proprietarioExibicao}` : ''}
        </h1>
        
        {carregandoUsuario && (
          <div className="carregando-container">
            <FaSpinner className="spinner" />
            <p>Carregando informações do usuário...</p>
          </div>
        )}
        
        {!carregandoUsuario && semProprietario && (
          <div className="sem-dados-alerta proprietario">
            <FaUserTie />
            <p>Nenhum proprietário definido. Configure um proprietário nas preferências do perfil.</p>
            <button onClick={() => navigate('/profile')} className="btn-configurar">
              Configurar Proprietário
            </button>
          </div>
        )}
        
        {!carregandoUsuario && !semProprietario && semDados && (
          <div className="sem-dados-alerta">
            <FaExclamationTriangle />
            <p>Sem informações disponíveis para {proprietarioExibicao}.</p>
          </div>
        )}
        
        {!carregandoUsuario && !semProprietario && !semDados && (
          <div className="periodo-controles mb-3 flex flex-wrap gap-2">
            <button 
              onClick={() => setPeriodoSelecionado('semanaAtual')}
              className={`btn-periodo ${periodoSelecionado === 'semanaAtual' ? 'ativo' : ''}`}
            >
              <FaCalendarWeek className="mr-1" /> Semana Atual
            </button>
            <button 
              onClick={() => setPeriodoSelecionado('mesAtual')}
              className={`btn-periodo ${periodoSelecionado === 'mesAtual' ? 'ativo' : ''}`}
            >
              <FaCalendarDay className="mr-1" /> Mês Atual
            </button>
            <button 
              onClick={() => setPeriodoSelecionado('mesPassado')}
              className={`btn-periodo ${periodoSelecionado === 'mesPassado' ? 'ativo' : ''}`}
            >
              <FaCalendarAlt className="mr-1" /> Mês Passado
            </button>
             <button 
              onClick={() => setPeriodoSelecionado('anoAtual')}
              className={`btn-periodo ${periodoSelecionado === 'anoAtual' ? 'ativo' : ''}`}
            >
               <FaCalendarAlt className="mr-1" /> Ano Atual
            </button>
          </div>
        )}

        {!carregandoUsuario && !semProprietario && !semDados && (
          <div className="resumo-cards-glass mb-5">
            {carregandoDados ? (
              <div className="col-span-full carregando-container flex items-center justify-center p-6 bg-white rounded-lg shadow">
                <FaSpinner className="spinner text-blue-500 mr-2" />
                <p className="text-gray-600">Carregando dados...</p>
              </div>
            ) : (
              <>
                <div className="glass-card recebiveis">
                  <div className="card-icon">💰</div>
                  <div className="card-content">
                    <h3 className="card-title">Recebíveis</h3>
                    <p className="card-value">R$ {resumoPeriodo.totalRecebiveis.toFixed(2)}</p>
                    <div className="card-divider"></div>
                    <p className="card-detail">
                      <span className="detail-label">Média diária</span>
                      <span className="detail-value">R$ {mediaDiariaRecebiveis.toFixed(2)}</span>
                    </p>
                  </div>
                </div>

                <div className="glass-card gastos">
                  <div className="card-icon">💸</div>
                  <div className="card-content">
                    <h3 className="card-title">Gastos</h3>
                    <p className="card-value">R$ {resumoPeriodo.totalGastos.toFixed(2)}</p>
                    <div className="card-divider"></div>
                    <p className="card-detail">
                      <span className="detail-label">Média diária</span>
                      <span className="detail-value">R$ {mediaDiariaGastos.toFixed(2)}</span>
                    </p>
                  </div>
                </div>

                <div className="glass-card saldo">
                  <div className="card-icon">{resumoPeriodo.saldo >= 0 ? '✅' : '⚠️'}</div>
                  <div className="card-content">
                    <h3 className="card-title">Saldo do Período</h3>
                    <p className="card-value">R$ {resumoPeriodo.saldo.toFixed(2)}</p>
                    <div className="card-divider"></div>
                    <p className="card-detail">
                      <span className="detail-label">{taxaEconomia >= 0 ? 'Economia' : 'Déficit'}</span>
                      <span className={`detail-value ${taxaEconomia >= 0 ? 'positive' : 'negative'}`}>
                        {taxaEconomia >= 0 ? '+' : ''}{taxaEconomia.toFixed(1)}%
                      </span>
                    </p>
                  </div>
                </div>

                <div className="glass-card projecao">
                  <div className="card-icon">📊</div>
                  <div className="card-content">
                    <h3 className="card-title">Projeção Mensal</h3>
                    <p className="card-value">R$ {projecaoMes.toFixed(2)}</p>
                    <div className="card-divider"></div>
                    <p className="card-detail">
                      <span className="detail-label">Progresso</span>
                      <span className="detail-value">{getDiasDecorridos()}/{getDiasNoMes()} dias</span>
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {!carregandoUsuario && !semProprietario && (
        <div className="dashboard-grid grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="dashboard-column lg:col-span-2 flex flex-col gap-6">
            <section className="dashboard-section atalhos bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Atalhos</h2>
              <div className="atalhos-grid grid grid-cols-2 sm:grid-cols-3 gap-3">
                <button className="atalho-btn nova-transacao" onClick={handleNovaTransacao}>
                  <FaPlus />
                  <span>Nova Transação</span>
                </button>
                <button className="atalho-btn ver-relatorio" onClick={handleVerRelatorio}>
                  <FaChartLine />
                  <span>Ver Relatório</span>
                </button>
                <button className="atalho-btn ver-transacoes" onClick={handleVerTransacoes}>
                  <FaFileInvoiceDollar />
                  <span>Ver Transações</span>
                </button>
              </div>
            </section>

            <section className="dashboard-section grafico bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Evolução Financeira (Últimos 6 Meses)</h2>
              <div className="grafico-container h-52 md:h-64">
                <Line 
                  data={dadosGrafico}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'top',
                      },
                      title: {
                        display: false
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: (value) => `R$ ${value.toFixed(2)}`
                        }
                      }
                    }
                  }}
                />
              </div>
            </section>

            <Card className="dashboard-section ultimas-transacoes">
              <CardHeader>
                <SectionHeader
                  title="Últimas Transações"
                  children={
                    <button
                      onClick={handleVerTransacoes}
                      className="ultimas-transacoes-ver-todas text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      Ver todas →
                    </button>
                  }
                />
                <p className="ultimas-transacoes-subtitle">Últimas 10 movimentações</p>
              </CardHeader>
              <CardContent className="ultimas-transacoes-content">
                {/* Busca e Filtros */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <input
                    type="text"
                    placeholder="Buscar por descrição ou pessoa..."
                    value={buscaTransacao}
                    onChange={(e) => setBuscaTransacao(e.target.value)}
                    className="input-field flex-1"
                  />
                  <SegmentedControl
                    options={[
                      { value: 'todos', label: 'Todos' },
                      { value: 'gasto', label: 'Gastos', variant: 'error' },
                      { value: 'recebivel', label: 'Recebíveis', variant: 'success' }
                    ]}
                    value={filtroTipo}
                    onChange={setFiltroTipo}
                  />
                </div>

                {/* Lista de Transações - Grid tabular com cards */}
                <div className="transacoes-lista max-h-72 overflow-y-auto">
                  {carregandoDados ? (
                    <div className="transacoes-skeleton">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="transacao-card-skeleton">
                          <div className="loading-skeleton transacao-skeleton-icon" />
                          <div className="transacao-skeleton-content">
                            <div className="loading-skeleton transacao-skeleton-desc" />
                            <div className="loading-skeleton transacao-skeleton-meta" />
                          </div>
                          <div className="loading-skeleton transacao-skeleton-valor" />
                        </div>
                      ))}
                    </div>
                  ) : transacoesFiltradas.length === 0 ? (
                    <EmptyState
                      message={
                        buscaTransacao || filtroTipo !== 'todos'
                          ? 'Nenhuma transação encontrada com os filtros aplicados.'
                          : 'Nenhuma transação encontrada.'
                      }
                    />
                  ) : (
                    <>
                      {/* Tabela unificada - um único grid para alinhamento consistente */}
                      <div className="transacoes-tabela">
                        <div className="transacoes-tabela-header">
                          <span className="transacoes-col-tipo" />
                          <span className="transacoes-col-descricao">Descrição</span>
                          <span className="transacoes-col-data">Data</span>
                          <span className="transacoes-col-valor">Valor</span>
                          <span className="transacoes-col-acao" />
                        </div>
                        {transacoesFiltradas.slice(0, 10).map((t, index) => (
                          <div
                            key={t._id || index}
                            className={`transacao-card group ${t.tipo === 'gasto' ? 'transacao-card--gasto' : 'transacao-card--recebivel'}`}
                          >
                            <div className={`transacoes-col-tipo transacao-tipo ${t.tipo === 'gasto' ? 'transacao-tipo--gasto' : 'transacao-tipo--recebivel'}`}>
                              {t.tipo === 'gasto' ? <FaArrowDown size={14} /> : <FaArrowUp size={14} />}
                            </div>
                            <div className="transacoes-col-descricao transacao-descricao">
                              <span className="transacao-descricao-texto">{t.descricao}</span>
                              {t.pagamentos && t.pagamentos.length > 0 && (
                                <span className="transacao-pessoas">{t.pagamentos.map(p => p.pessoa).join(', ')}</span>
                              )}
                            </div>
                            <div className="transacoes-col-data transacao-data">
                              {new Date(t.data).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="transacoes-col-valor transacao-valor-cell">
                              <span className={`transacao-valor ${t.tipo === 'gasto' ? 'transacao-valor--gasto' : 'transacao-valor--recebivel'}`}>
                                {t.tipo === 'gasto' ? '-' : '+'} {formatarMoeda(t.valor)}
                              </span>
                            </div>
                            <div className="transacoes-col-acao transacao-acao">
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<FaCopy size={12} />}
                                onClick={() => handleDuplicarTransacao(t)}
                                title="Duplicar transação"
                                aria-label="Duplicar transação"
                                className="transacao-btn-duplicar"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      {transacoesFiltradas.length > 10 && (
                        <button
                          onClick={handleVerTransacoes}
                          className="transacoes-ver-todas-btn"
                        >
                          Ver todas as {transacoesFiltradas.length} transações →
                        </button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="dashboard-column lg:col-span-1 flex flex-col gap-6">
            <section className="dashboard-section calendario bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Calendário</h2>
              <Calendar
                onChange={setCalendarDate}
                onClickDay={handleDayClick}
                value={calendarDate}
                tileContent={tileContent}
                className="react-calendar"
              />
            </section>

            <section className="dashboard-section notas bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-700 mb-2">Notas Rápidas</h2>
              <form onSubmit={adicionarNota} className="nova-nota-form flex gap-2 mb-2">
                <input
                  type="text"
                  value={novaNota}
                  onChange={(e) => setNovaNota(e.target.value)}
                  placeholder="Digite uma nova nota..."
                  className="flex-grow input-field"
                />
                <button type="submit" className="btn-icon">
                  <FaRegStickyNote />
                </button>
              </form>
              <div className="notas-lista overflow-y-auto space-y-2 pr-2">
                {notas.length === 0 && <p className="text-sm text-gray-400 text-center py-2">Nenhuma nota ainda.</p>}
                {notas.map(nota => (
                  <div key={nota.id} className="nota-item bg-yellow-50 p-2 rounded border border-yellow-200 flex justify-between items-start">
                    <div>
                      <p className="text-sm text-gray-800">{nota.texto}</p>
                      <small className="text-xs text-gray-500">{formatDateBR(nota.data)}</small>
                    </div>
                    <button onClick={() => removerNota(nota.id)} className="text-gray-400 hover:text-red-500 text-xs ml-2">×</button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {modalOpen && (
        <ModalTransacao onClose={() => {
          setModalOpen(false);
          setTransacaoDuplicar(null);
        }}>
          <NovaTransacaoForm
            onSuccess={() => {
              setModalOpen(false);
              setTransacaoDuplicar(null);
              fetchTransacoes();
            }}
            onClose={() => {
              setModalOpen(false);
              setTransacaoDuplicar(null);
            }}
            proprietarioPadrao={proprietario}
            transacao={transacaoDuplicar ? {
              ...transacaoDuplicar,
              _id: null, // Remove ID para criar nova
              data: getTodayBR() // Atualiza para hoje
            } : null}
          />
        </ModalTransacao>
      )}

      <DayDetailModal
        open={isDayModalOpen}
        transactions={selectedDateTransactions}
        date={selectedDate}
        onClose={() => setIsDayModalOpen(false)}
      />
    </div>
  );
};

export default Home;
