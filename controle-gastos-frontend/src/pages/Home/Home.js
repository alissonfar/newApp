// src/pages/Home/Home.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'react-calendar';
import { FaPlus, FaChartLine, FaFileInvoiceDollar, FaRegStickyNote } from 'react-icons/fa';
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
import './Home.css';

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
  const [modalOpen, setModalOpen] = useState(false);
  const [transacoes, setTransacoes] = useState([]);
  const [resumoMes, setResumoMes] = useState({
    totalGastos: 0,
    totalRecebiveis: 0,
    saldo: 0
  });
  const [notas, setNotas] = useState(() => {
    const notasSalvas = localStorage.getItem('notas');
    return notasSalvas ? JSON.parse(notasSalvas) : [];
  });
  const [novaNota, setNovaNota] = useState('');
  const [date, setDate] = useState(new Date());
  const [transacoesPorData, setTransacoesPorData] = useState({});
  const [dadosGrafico, setDadosGrafico] = useState({
    labels: [],
    datasets: [
      {
        label: 'Gastos',
        data: [],
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
      },
      {
        label: 'Recebíveis',
        data: [],
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      }
    ]
  });

  // Função para carregar transações
  const fetchTransacoes = async () => {
    try {
      const response = await obterTransacoes();
      setTransacoes(response.transacoes);
      
      // Calcular resumo do mês
      const hoje = new Date();
      const transacoesMes = response.transacoes.filter(t => {
        const dataTransacao = new Date(t.data);
        return dataTransacao.getMonth() === hoje.getMonth() &&
               dataTransacao.getFullYear() === hoje.getFullYear();
      });

      const resumo = transacoesMes.reduce((acc, t) => {
        if (t.tipo === 'gasto') {
          acc.totalGastos += t.valor;
        } else {
          acc.totalRecebiveis += t.valor;
        }
        return acc;
      }, { totalGastos: 0, totalRecebiveis: 0 });

      resumo.saldo = resumo.totalRecebiveis - resumo.totalGastos;
      setResumoMes(resumo);

      // Agrupar transações por data para o calendário
      const porData = response.transacoes.reduce((acc, t) => {
        const data = t.data.split('T')[0];
        if (!acc[data]) acc[data] = [];
        acc[data].push(t);
        return acc;
      }, {});
      setTransacoesPorData(porData);

      // Calcular dados para o gráfico
      const ultimosMeses = [];
      const gastosUltimosMeses = [];
      const recebiveisUltimosMeses = [];

      for (let i = 5; i >= 0; i--) {
        const data = new Date();
        data.setMonth(data.getMonth() - i);
        const mes = data.toLocaleString('pt-BR', { month: 'short' });
        const ano = data.getFullYear();
        
        ultimosMeses.push(`${mes}/${ano}`);

        const transacoesMes = response.transacoes.filter(t => {
          const dataTransacao = new Date(t.data);
          return dataTransacao.getMonth() === data.getMonth() &&
                 dataTransacao.getFullYear() === data.getFullYear();
        });

        const gastosMes = transacoesMes
          .filter(t => t.tipo === 'gasto')
          .reduce((acc, t) => acc + t.valor, 0);

        const recebiveisMes = transacoesMes
          .filter(t => t.tipo === 'recebivel')
          .reduce((acc, t) => acc + t.valor, 0);

        gastosUltimosMeses.push(gastosMes);
        recebiveisUltimosMeses.push(recebiveisMes);
      }

      setDadosGrafico({
        labels: ultimosMeses,
        datasets: [
          {
            label: 'Gastos',
            data: gastosUltimosMeses,
            borderColor: 'rgb(255, 99, 132)',
            tension: 0.1
          },
          {
            label: 'Recebíveis',
            data: recebiveisUltimosMeses,
            borderColor: 'rgb(75, 192, 192)',
            tension: 0.1
          }
        ]
      });

    } catch (error) {
      console.error('Erro ao carregar transações:', error);
      toast.error('Erro ao carregar dados do dashboard');
    }
  };

  // Carregar transações inicialmente
  useEffect(() => {
    fetchTransacoes();
  }, []);

  // Gerenciamento de notas
  const adicionarNota = (e) => {
    e.preventDefault();
    if (!novaNota.trim()) return;

    const novasNotas = [...notas, {
      id: Date.now(),
      texto: novaNota,
      data: new Date().toISOString()
    }];
    setNotas(novasNotas);
    localStorage.setItem('notas', JSON.stringify(novasNotas));
    setNovaNota('');
  };

  const removerNota = (id) => {
    const novasNotas = notas.filter(nota => nota.id !== id);
    setNotas(novasNotas);
    localStorage.setItem('notas', JSON.stringify(novasNotas));
  };

  // Função para renderizar o conteúdo do tile do calendário
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    
    const dataFormatada = date.toISOString().split('T')[0];
    const transacoesDia = transacoesPorData[dataFormatada] || [];
    
    if (transacoesDia.length === 0) return null;

    return (
      <div className="calendar-tile-content">
        <div className="transaction-dot" />
      </div>
    );
  };

  // Navegação
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
    <div className="home-container">
      {/* Cabeçalho com Resumo */}
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="resumo-cards">
          <div className="resumo-card recebiveis">
            <h3>Recebíveis do Mês</h3>
            <p>R$ {resumoMes.totalRecebiveis.toFixed(2)}</p>
          </div>
          <div className="resumo-card gastos">
            <h3>Gastos do Mês</h3>
            <p>R$ {resumoMes.totalGastos.toFixed(2)}</p>
          </div>
          <div className="resumo-card saldo">
            <h3>Saldo do Mês</h3>
            <p>R$ {resumoMes.saldo.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Coluna Esquerda */}
        <div className="dashboard-column">
          {/* Atalhos */}
          <section className="dashboard-section atalhos">
            <h2>Atalhos</h2>
            <div className="atalhos-grid">
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

          {/* Gráfico */}
          <section className="dashboard-section grafico">
            <h2>Evolução Financeira</h2>
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
          </section>

          {/* Últimas Transações */}
          <section className="dashboard-section ultimas-transacoes">
            <h2>Últimas Transações</h2>
            <div className="transacoes-lista">
              {transacoes.slice(0, 5).map((t, index) => (
                <div key={index} className={`transacao-item ${t.tipo}`}>
                  <div className="transacao-info">
                    <strong>{t.descricao}</strong>
                    <span>{new Date(t.data).toLocaleDateString()}</span>
                  </div>
                  <div className="transacao-valor">
                    R$ {t.valor.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Coluna Direita */}
        <div className="dashboard-column">
          {/* Calendário */}
          <section className="dashboard-section calendario">
            <h2>Calendário</h2>
            <Calendar
              onChange={setDate}
              value={date}
              tileContent={tileContent}
              className="react-calendar"
            />
          </section>

          {/* Notas */}
          <section className="dashboard-section notas">
            <h2>Notas Rápidas</h2>
            <form onSubmit={adicionarNota} className="nova-nota-form">
              <input
                type="text"
                value={novaNota}
                onChange={(e) => setNovaNota(e.target.value)}
                placeholder="Digite uma nova nota..."
              />
              <button type="submit">
                <FaRegStickyNote />
              </button>
            </form>
            <div className="notas-lista">
              {notas.map(nota => (
                <div key={nota.id} className="nota-item">
                  <p>{nota.texto}</p>
                  <small>{new Date(nota.data).toLocaleDateString()}</small>
                  <button onClick={() => removerNota(nota.id)}>×</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Modal de Nova Transação */}
      {modalOpen && (
        <ModalTransacao onClose={() => setModalOpen(false)}>
          <NovaTransacaoForm
            onSuccess={() => {
              setModalOpen(false);
              fetchTransacoes();
            }}
            onClose={() => setModalOpen(false)}
          />
        </ModalTransacao>
      )}
    </div>
  );
};

export default Home;
