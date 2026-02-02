// src/pages/Home/Home.js
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'react-calendar';
import { FaPlus, FaChartLine, FaFileInvoiceDollar, FaRegStickyNote, FaExclamationTriangle, FaUserTie, FaSpinner, FaCalendarDay, FaCalendarWeek, FaCalendarAlt } from 'react-icons/fa';
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
import { obterTransacoes } from '../../api';
import { toast } from 'react-toastify';
import ModalTransacao from '../../components/Modal/ModalTransacao';
import NovaTransacaoForm from '../../components/Transaction/NovaTransacaoForm';
import DayDetailModal from '../../components/Modal/DayDetailModal';
import { AuthContext } from '../../context/AuthContext';
import './Home.css';
import { getCurrentDateBR, formatDateBR, toISOStringBR, getTodayBR } from '../../utils/dateUtils';
import useDashboardData from '../../hooks/useDashboardData';

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
    navigate('/transacoes');
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
    <div className="home-container p-4 md:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="dashboard-header mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
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
          <div className="periodo-controles mb-4 flex flex-wrap gap-2">
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
          <div className="resumo-cards-glass grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Atalhos</h2>
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
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Evolução Financeira (Últimos 6 Meses)</h2>
              <div className="grafico-container h-64 md:h-80">
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

            <section className="dashboard-section ultimas-transacoes bg-white p-4 rounded-lg shadow">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold text-gray-700">Últimas Transações</h2>
              </div>

              {/* Busca e Filtros */}
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <input
                  type="text"
                  placeholder="Buscar por descrição ou pessoa..."
                  value={buscaTransacao}
                  onChange={(e) => setBuscaTransacao(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setFiltroTipo('todos')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filtroTipo === 'todos'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setFiltroTipo('gasto')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filtroTipo === 'gasto'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Gastos
                  </button>
                  <button
                    onClick={() => setFiltroTipo('recebivel')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filtroTipo === 'recebivel'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Recebíveis
                  </button>
                </div>
              </div>

              <div className="transacoes-lista space-y-3 max-h-96 overflow-y-auto">
                {transacoesFiltradas.slice(0, 10).map((t, index) => (
                  <div key={index} className={`transacao-item flex justify-between items-center p-3 rounded border-l-4 group ${t.tipo === 'gasto' ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}>
                    <div className="transacao-info flex-1">
                      <strong className="text-sm text-gray-800 block">{t.descricao}</strong>
                      <span className="text-xs text-gray-500">{new Date(t.data).toLocaleDateString()}</span>
                      {t.pagamentos && t.pagamentos.length > 0 && (
                        <span className="text-xs text-gray-600 block mt-1">
                          {t.pagamentos.map(p => p.pessoa).join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDuplicarTransacao(t)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 rounded"
                        title="Duplicar transação"
                      >
                        <FaPlus className="text-blue-600 text-xs" />
                      </button>
                      <div className={`transacao-valor font-medium text-sm ${t.tipo === 'gasto' ? 'text-red-600' : 'text-green-600'}`}>
                        {t.tipo === 'gasto' ? '-' : '+'} R$ {t.valor.toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))}
                {transacoesFiltradas.length === 0 && !carregandoDados && (
                  <p className="text-sm text-gray-500 text-center py-4">
                    {buscaTransacao || filtroTipo !== 'todos'
                      ? 'Nenhuma transação encontrada com os filtros aplicados.'
                      : 'Nenhuma transação encontrada.'}
                  </p>
                )}
                {transacoesFiltradas.length > 10 && (
                  <button
                    onClick={handleVerTransacoes}
                    className="w-full py-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Ver todas as {transacoesFiltradas.length} transações →
                  </button>
                )}
              </div>
            </section>
          </div>

          <div className="dashboard-column lg:col-span-1 flex flex-col gap-6">
            <section className="dashboard-section calendario bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Calendário</h2>
              <Calendar
                onChange={setCalendarDate}
                onClickDay={handleDayClick}
                value={calendarDate}
                tileContent={tileContent}
                className="react-calendar"
              />
            </section>

            <section className="dashboard-section notas bg-white p-4 rounded-lg shadow">
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Notas Rápidas</h2>
              <form onSubmit={adicionarNota} className="nova-nota-form flex gap-2 mb-3">
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
              <div className="notas-lista max-h-48 overflow-y-auto space-y-2 pr-2">
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
