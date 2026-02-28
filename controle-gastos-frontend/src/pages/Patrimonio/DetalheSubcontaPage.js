import React, { useState, useEffect } from 'react';
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
import { FaArrowLeft, FaCheck, FaSpinner, FaExclamationTriangle } from 'react-icons/fa';
import patrimonioApi from '../../services/patrimonioApi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import './DetalheSubcontaPage.css';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

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

  const carregar = async () => {
    if (!subcontaId) return;
    try {
      setCarregando(true);
      const [sc, hist, rend, trans] = await Promise.all([
        patrimonioApi.obterSubconta(subcontaId),
        patrimonioApi.obterHistorico(subcontaId),
        patrimonioApi.obterRendimentoEstimado(subcontaId),
        patrimonioApi.listarTransacoesPorSubconta(subcontaId)
      ]);
      setSubconta(sc);
      setHistorico(hist);
      setRendimento(rend);
      setTransacoes(trans);
      setNovoSaldo(String(sc?.saldoAtual || 0));
    } catch (err) {
      console.error(err);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
  }, [subcontaId]);

  const formatarMoeda = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatarData = (d) => d ? format(new Date(d), 'dd/MM/yyyy', { locale: ptBR }) : '-';

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

  const handleConfirmarSaldo = async () => {
    const saldoNum = parseFloat(novoSaldo);
    if (isNaN(saldoNum)) return;
    try {
      setConfirmando(true);
      await patrimonioApi.confirmarSaldo(subcontaId, { saldo: saldoNum, observacao });
      setModalConfirmar(false);
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
        <p>Subconta não encontrada.</p>
        <button onClick={() => navigate('/patrimonio/contas')}>Voltar</button>
      </div>
    );
  }

  return (
    <div className="detalhe-subconta-page">
      <div className="detalhe-header">
        <button className="btn-voltar" onClick={() => navigate('/patrimonio/contas')}>
          <FaArrowLeft /> Voltar
        </button>
        <h1>{subconta.instituicao?.nome} - {subconta.nome}</h1>
      </div>

      <div className="detalhe-cards">
        <div className="detalhe-card">
          <h3>Saldo Confirmado</h3>
          <p className="valor">{formatarMoeda(subconta.saldoAtual)}</p>
          <span className="data-confirmacao">
            Última confirmação: {formatarData(subconta.dataUltimaConfirmacao)}
          </span>
        </div>
        {rendimento && (rendimento.rendimentoMensal > 0 || rendimento.rendimentoDiario > 0) && (
          <div className="detalhe-card estimativa">
            <h3>Rendimento Estimado (mês)</h3>
            <p className="valor">{formatarMoeda(rendimento.rendimentoMensal)}</p>
            <span className="badge-estimativa">Estimativa - {rendimento.percentualCDI}% CDI</span>
          </div>
        )}
      </div>

      <div className="detalhe-section">
        <div className="section-header">
          <h3>Histórico de Saldo</h3>
          <button className="btn-confirmar" onClick={() => setModalConfirmar(true)}>
            <FaCheck /> Confirmar Saldo
          </button>
        </div>
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
                    ticks: { callback: (v) => `R$ ${v}` }
                  }
                }
              }}
              height={200}
            />
          </div>
        ) : (
          <p className="sem-dados">Nenhum histórico ainda. Confirme o saldo para criar o primeiro registro.</p>
        )}
      </div>

      <div className="detalhe-section">
        <h3>Registros de Histórico</h3>
        {historico.length > 0 ? (
          <table className="tabela-historico">
            <thead>
              <tr>
                <th>Data</th>
                <th>Saldo</th>
                <th>Origem</th>
                <th>Observação</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((h) => (
                <tr key={h._id}>
                  <td>{formatarData(h.data)}</td>
                  <td>{formatarMoeda(h.saldo)}</td>
                  <td>{h.origem}</td>
                  <td>{h.observacao || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="detalhe-section">
        <h3>Transações Vinculadas</h3>
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
          <p className="sem-dados">Nenhuma transação vinculada a esta subconta.</p>
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
              <label>Observação (opcional)</label>
              <input
                type="text"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex: Conferência do extrato"
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setModalConfirmar(false)}>Cancelar</button>
              <button onClick={handleConfirmarSaldo} disabled={confirmando}>
                {confirmando ? <FaSpinner className="spinner-inline" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DetalheSubcontaPage;
