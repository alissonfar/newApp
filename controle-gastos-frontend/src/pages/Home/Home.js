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
          <div className="resumo-cards grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {carregandoDados ? (
              <div className="col-span-full carregando-container flex items-center justify-center p-6 bg-white rounded-lg shadow">
                <FaSpinner className="spinner text-blue-500 mr-2" />
                <p className="text-gray-600">Carregando dados...</p>
              </div>
            ) : (
              <>
                <div className="resumo-card recebiveis bg-green-100 p-4 rounded-lg shadow hover:shadow-md transition-shadow">
                  <h3 className="text-sm font-semibold text-green-800 mb-1">Recebíveis ({periodoSelecionado.replace('Atual', ' Atuais').replace('Passado', ' Passado')})</h3>
                  <p className="text-xl font-bold text-green-900">R$ {resumoPeriodo.totalRecebiveis.toFixed(2)}</p>
                </div>
                <div className="resumo-card gastos bg-red-100 p-4 rounded-lg shadow hover:shadow-md transition-shadow">
                  <h3 className="text-sm font-semibold text-red-800 mb-1">Gastos ({periodoSelecionado.replace('Atual', ' Atuais').replace('Passado', ' Passado')})</h3>
                  <p className="text-xl font-bold text-red-900">R$ {resumoPeriodo.totalGastos.toFixed(2)}</p>
                </div>
                <div className="resumo-card saldo bg-blue-100 p-4 rounded-lg shadow hover:shadow-md transition-shadow">
                  <h3 className="text-sm font-semibold text-blue-800 mb-1">Saldo ({periodoSelecionado.replace('Atual', ' Atuais').replace('Passado', ' Passado')})</h3>
                  <p className="text-xl font-bold text-blue-900">R$ {resumoPeriodo.saldo.toFixed(2)}</p>
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
              <h2 className="text-lg font-semibold text-gray-700 mb-3">Últimas 5 Transações</h2>
              <div className="transacoes-lista space-y-3">
                {transacoes.slice(0, 5).map((t, index) => (
                  <div key={index} className={`transacao-item flex justify-between items-center p-3 rounded border-l-4 ${t.tipo === 'gasto' ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}>
                    <div className="transacao-info">
                      <strong className="text-sm text-gray-800 block">{t.descricao}</strong>
                      <span className="text-xs text-gray-500">{new Date(t.data).toLocaleDateString()}</span>
                    </div>
                    <div className={`transacao-valor font-medium text-sm ${t.tipo === 'gasto' ? 'text-red-600' : 'text-green-600'}`}>
                      {t.tipo === 'gasto' ? '-' : '+'} R$ {t.valor.toFixed(2)}
                    </div>
                  </div>
                ))}
                {transacoes.length === 0 && !carregandoDados && (
                  <p className="text-sm text-gray-500 text-center py-4">Nenhuma transação encontrada.</p>
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
        <ModalTransacao onClose={() => setModalOpen(false)}>
          <NovaTransacaoForm
            onSuccess={() => {
              setModalOpen(false);
              fetchTransacoes();
            }}
            onClose={() => setModalOpen(false)}
            proprietarioPadrao={proprietario}
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
