import React, { useState, useEffect } from 'react';
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
import { FaArrowLeft, FaSpinner } from 'react-icons/fa';
import patrimonioApi from '../../services/patrimonioApi';
import Button from '../../components/shared/Button';
import EmptyState from '../../components/shared/EmptyState';
import { format, subMonths } from 'date-fns';
import { formatDateBR } from '../../utils/dateUtils';
import './EvolucaoPage.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const EvolucaoPage = () => {
  const navigate = useNavigate();
  const [evolucao, setEvolucao] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [dataInicio, setDataInicio] = useState(() => {
    const d = subMonths(new Date(), 6);
    return format(d, 'yyyy-MM-dd');
  });
  const [dataFim, setDataFim] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const carregar = async () => {
      try {
        setCarregando(true);
        const data = await patrimonioApi.obterEvolucaoPatrimonio(dataInicio, dataFim);
        setEvolucao(data);
      } catch (err) {
        console.error(err);
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, [dataInicio, dataFim]);

  const formatarMoeda = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatarData = (d) => d ? formatDateBR(d) : '';

  const dadosGrafico = {
    labels: evolucao.map((e) => formatarData(e.data)),
    datasets: [{
      label: 'Patrimônio Total',
      data: evolucao.map((e) => e.total),
      borderColor: 'rgb(33, 150, 243)',
      backgroundColor: 'rgba(33, 150, 243, 0.1)',
      tension: 0.1,
      fill: true
    }]
  };

  return (
    <div className="evolucao-page">
      <div className="evolucao-header">
        <Button variant="ghost" icon={<FaArrowLeft size={14} />} onClick={() => navigate('/patrimonio')}>
          Voltar
        </Button>
        <h1>Evolução do Patrimônio</h1>
      </div>

      <div className="evolucao-filtros">
        <div className="filtro-group">
          <label>Data Início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div className="filtro-group">
          <label>Data Fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
      </div>

      {carregando ? (
        <div className="evolucao-loading">
          <FaSpinner className="spinner" />
          <p>Carregando evolução...</p>
        </div>
      ) : evolucao.length > 0 ? (
        <div className="evolucao-grafico">
          <Line
            data={dadosGrafico}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => formatarMoeda(ctx.raw)
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { callback: (v) => `R$ ${v}` }
                }
              }
            }}
            height={300}
          />
        </div>
      ) : (
        <EmptyState message="Nenhum dado de evolução no período selecionado. Confirme saldos nas subcontas para gerar histórico." />
      )}
    </div>
  );
};

export default EvolucaoPage;
