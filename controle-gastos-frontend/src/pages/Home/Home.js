// src/pages/Home/Home.js
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'react-calendar';
import {
  FaPlus,
  FaCopy,
  FaArrowDown,
  FaArrowUp,
  FaChartLine,
  FaFileInvoiceDollar,
  FaRegStickyNote,
  FaExclamationTriangle,
  FaUserTie,
  FaSpinner,
  FaCalendarDay,
  FaCalendarWeek,
  FaCalendarAlt,
  FaPiggyBank
} from 'react-icons/fa';
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
import IconRenderer from '../../components/shared/IconRenderer';
import StatCard from '../../components/shared/StatCard';
import TransactionRow from '../../components/shared/TransactionRow';
import EmprestimoBadge from '../../components/Emprestimos/EmprestimoBadge';

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
    tagInsights,
    carregandoTagInsights,
    semDados,
    carregandoDados,
    proprietarioExibicao,
    periodoSelecionado,
    setPeriodoSelecionado,
    fetchTransacoes,
    fetchTagInsights
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
    if (t.esconderNaLista) return false;
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

  // Helper: extrair valor de exibição da transação (mantém regra do proprietário)
  const getValorExibicao = (t) => {
    const pagamentoProprietario = t.pagamentos?.find(
      p => p.pessoa && p.pessoa.toLowerCase() === proprietario.toLowerCase()
    );
    return pagamentoProprietario?.valor ?? t.valor;
  };

  // Helper: lista de pessoas da transação
  const getPessoasTransacao = (t) => {
    if (!t.pagamentos || t.pagamentos.length === 0) return null;
    return t.pagamentos.map(p => p.pessoa).join(', ');
  };

  return (
    <div className="cg-home">
      <div className="cg-home__header">
        <h1 className="cg-home__title">
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
          <div className="cg-home__periodo">
            <Button
              variant={periodoSelecionado === 'semanaAtual' ? 'primary' : 'ghost'}
              size="sm"
              startIcon={<FaCalendarWeek />}
              onClick={() => setPeriodoSelecionado('semanaAtual')}
            >
              Semana Atual
            </Button>
            <Button
              variant={periodoSelecionado === 'mesAtual' ? 'primary' : 'ghost'}
              size="sm"
              startIcon={<FaCalendarDay />}
              onClick={() => setPeriodoSelecionado('mesAtual')}
            >
              Mês Atual
            </Button>
            <Button
              variant={periodoSelecionado === 'mesPassado' ? 'primary' : 'ghost'}
              size="sm"
              startIcon={<FaCalendarAlt />}
              onClick={() => setPeriodoSelecionado('mesPassado')}
            >
              Mês Passado
            </Button>
            <Button
              variant={periodoSelecionado === 'anoAtual' ? 'primary' : 'ghost'}
              size="sm"
              startIcon={<FaCalendarAlt />}
              onClick={() => setPeriodoSelecionado('anoAtual')}
            >
              Ano Atual
            </Button>
          </div>
        )}

        {!carregandoUsuario && !semProprietario && !semDados && (
          <div className="cg-home__stat-grid">
            {carregandoDados ? (
              <div className="cg-home__stat-loading">
                <FaSpinner className="spinner" />
                <p>Carregando dados...</p>
              </div>
            ) : (
              <>
                <StatCard
                  label="Recebíveis"
                  value={formatarMoeda(resumoPeriodo.totalRecebiveis)}
                  icon={<FaArrowUp />}
                  accentColor="var(--cg-color-success)"
                  detailLabel="Média diária"
                  detail={formatarMoeda(mediaDiariaRecebiveis)}
                />
                <StatCard
                  label="Gastos"
                  value={formatarMoeda(resumoPeriodo.totalGastos)}
                  icon={<FaArrowDown />}
                  accentColor="var(--cg-color-error)"
                  detailLabel="Média diária"
                  detail={formatarMoeda(mediaDiariaGastos)}
                />
                <StatCard
                  label="Saldo do Período"
                  value={formatarMoeda(resumoPeriodo.saldo)}
                  icon={<FaPiggyBank />}
                  accentColor="var(--cg-color-info)"
                  detailLabel={taxaEconomia >= 0 ? 'Economia' : 'Déficit'}
                  detail={`${taxaEconomia >= 0 ? '+' : ''}${taxaEconomia.toFixed(1)}%`}
                  positive={taxaEconomia >= 0}
                />
                <StatCard
                  label="Projeção Mensal"
                  value={formatarMoeda(projecaoMes)}
                  icon={<FaChartLine />}
                  accentColor="var(--cg-color-warning)"
                  detailLabel="Progresso"
                  detail={`${getDiasDecorridos()}/${getDiasNoMes()} dias`}
                />
              </>
            )}
          </div>
        )}
      </div>

      {!carregandoUsuario && (
        <div className="cg-home__grid">
          {!semProprietario && (
          <div className="cg-home__column cg-home__column--main">
            <Card variant="glass" padding="md" className="dashboard-section atalhos">
              <CardContent>
                <SectionHeader title="Atalhos" />
                <div className="atalhos-grid">
                  <Button
                    variant="glass"
                    className="atalho-btn"
                    onClick={handleNovaTransacao}
                    startIcon={<FaPlus />}
                  >
                    Nova Transação
                  </Button>
                  <Button
                    variant="glass"
                    className="atalho-btn"
                    onClick={handleVerRelatorio}
                    startIcon={<FaChartLine />}
                  >
                    Ver Relatório
                  </Button>
                  <Button
                    variant="glass"
                    className="atalho-btn"
                    onClick={handleVerTransacoes}
                    startIcon={<FaFileInvoiceDollar />}
                  >
                    Ver Transações
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card variant="glass" padding="md" className="dashboard-section grafico">
              <CardContent>
                <SectionHeader title="Evolução Financeira (Últimos 6 Meses)" />
                <div className="grafico-container">
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
              </CardContent>
            </Card>

            <Card variant="glass" padding="none" className="dashboard-section ultimas-transacoes">
              <CardHeader>
                <SectionHeader
                  title="Últimas Transações"
                  subtitle="Últimas 10 movimentações"
                  action={
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleVerTransacoes}
                    >
                      Ver todas →
                    </Button>
                  }
                />
              </CardHeader>
              <CardContent className="ultimas-transacoes-content">
                {/* Busca e Filtros */}
                <div className="ultimas-transacoes__filtros">
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

                {/* Lista de Transações */}
                <div className="cg-home__transacoes">
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
                      {transacoesFiltradas.slice(0, 10).map((t) => {
                        const valorExibicao = getValorExibicao(t);
                        const pessoas = getPessoasTransacao(t);
                        return (
                          <TransactionRow
                            key={t._id || t.id}
                            type={t.tipo}
                            description={
                              <>
                                {t.descricao}
                                {t.emprestimoInfo && <EmprestimoBadge emprestimoInfo={t.emprestimoInfo} variant="chip" />}
                              </>
                            }
                            secondaryText={pessoas}
                            date={formatDateBR(t.data)}
                            formattedValue={`${t.tipo === 'gasto' ? '-' : '+'} ${formatarMoeda(valorExibicao)}`}
                            actions={
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<FaCopy size={12} />}
                                onClick={() => handleDuplicarTransacao(t)}
                                title="Duplicar transação"
                                aria-label="Duplicar transação"
                                className="transacao-btn-duplicar"
                              />
                            }
                          />
                        );
                      })}
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
          )}

          <div className={`cg-home__column ${!semProprietario ? 'cg-home__column--side' : 'cg-home__column--full'}`}>
            <Card variant="glass" padding="md" className="dashboard-section insights">
              <CardContent>
                <SectionHeader title="Insights" />
                {carregandoTagInsights ? (
                  <div className="insights-loading">
                    <FaSpinner className="spinner" />
                    <span>Carregando...</span>
                  </div>
                ) : tagInsights.length === 0 ? (
                  <EmptyState message="Nenhuma tag marcada para o dashboard. Edite uma tag e ative 'Mostrar no Dashboard'." />
                ) : (
                  <div className="insights-cards-grid">
                    {tagInsights.map((item) => {
                      const total = Number(item.total) ?? 0;
                      const qtd = Number(item.quantidadePagamentos) ?? 0;
                      return (
                        <div
                          key={item.tagId}
                          className="insight-card"
                          style={{ '--insight-accent': item.cor || '#6366f1' }}
                        >
                          <div className="insight-card__bar" />
                          <div className="insight-card__content">
                            <div className="insight-card__icon">
                              <IconRenderer nome={item.icone || 'tag'} size={20} cor={item.cor || '#6366f1'} />
                            </div>
                            <h3 className="insight-card__title">{item.nome}</h3>
                            <p className="insight-card__value">{formatarMoeda(total)}</p>
                            <div className="insight-card__divider" />
                            <p className="insight-card__detail">
                              <span className="insight-card__label">{qtd} pagamento{qtd !== 1 ? 's' : ''}</span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card variant="glass" padding="md" className="dashboard-section calendario">
              <CardContent>
                <SectionHeader title="Calendário" />
                <Calendar
                  onChange={setCalendarDate}
                  onClickDay={handleDayClick}
                  value={calendarDate}
                  tileContent={tileContent}
                  className="react-calendar"
                />
              </CardContent>
            </Card>

            <Card variant="glass" padding="md" className="dashboard-section notas">
              <CardContent>
                <SectionHeader title="Notas Rápidas" />
                <form onSubmit={adicionarNota} className="nova-nota-form">
                  <input
                    type="text"
                    value={novaNota}
                    onChange={(e) => setNovaNota(e.target.value)}
                    placeholder="Digite uma nova nota..."
                    className="input-field"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    icon={<FaRegStickyNote />}
                    aria-label="Adicionar nota"
                  />
                </form>
                <div className="notas-lista">
                  {notas.length === 0 && <p className="notas-vazia">Nenhuma nota ainda.</p>}
                  {notas.map(nota => (
                    <div key={nota.id} className="nota-item">
                      <div>
                        <p>{nota.texto}</p>
                        <small>{formatDateBR(nota.data)}</small>
                      </div>
                      <button
                        onClick={() => removerNota(nota.id)}
                        className="nota-item__remover"
                        aria-label="Remover nota"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
              fetchTransacoes();
              fetchTagInsights?.();
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
        proprietario={proprietario}
        onClose={() => setIsDayModalOpen(false)}
      />
    </div>
  );
};

export default Home;
