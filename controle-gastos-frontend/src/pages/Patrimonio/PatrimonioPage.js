import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPiggyBank, FaBuilding, FaChartPie, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
import patrimonioApi from '../../services/patrimonioApi';
import './PatrimonioPage.css';

const PatrimonioPage = () => {
  const navigate = useNavigate();
  const [resumo, setResumo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    const carregar = async () => {
      try {
        setCarregando(true);
        const data = await patrimonioApi.obterResumoPatrimonio();
        setResumo(data);
        setErro(null);
      } catch (err) {
        setErro(err.message || 'Erro ao carregar patrimônio');
      } finally {
        setCarregando(false);
      }
    };
    carregar();
  }, []);

  const formatarMoeda = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (carregando) {
    return (
      <div className="patrimonio-page">
        <div className="patrimonio-loading">
          <FaSpinner className="spinner" />
          <p>Carregando patrimônio...</p>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="patrimonio-page">
        <div className="patrimonio-erro">
          <FaExclamationTriangle />
          <p>{erro}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="patrimonio-page">
      <div className="patrimonio-header">
        <h1><FaPiggyBank /> Patrimônio</h1>
        <button className="btn-contas" onClick={() => navigate('/patrimonio/contas')}>
          Gerenciar Contas
        </button>
      </div>

      <div className="patrimonio-cards">
        <div className="patrimonio-card total">
          <div className="card-icon">💰</div>
          <h3>Total Geral</h3>
          <p className="valor">{formatarMoeda(resumo?.totalGeral)}</p>
        </div>
        <div className="patrimonio-card rendimento">
          <div className="card-icon">📈</div>
          <h3>Rendimento Estimado (mês)</h3>
          <p className="valor">{formatarMoeda(resumo?.rendimentoEstimadoConsolidado)}</p>
          <span className="badge-estimativa">Estimativa</span>
        </div>
      </div>

      {resumo?.subcontasDesatualizadas?.length > 0 && (
        <div className="patrimonio-alerta">
          <FaExclamationTriangle />
          <div>
            <strong>Subcontas desatualizadas</strong>
            <p>As seguintes subcontas não tiveram o saldo confirmado nos últimos 7 dias:</p>
            <ul>
              {resumo.subcontasDesatualizadas.map((s) => (
                <li key={s._id}>
                  <button onClick={() => navigate(`/patrimonio/contas/${s._id}`)}>
                    {s.instituicao} - {s.nome}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="patrimonio-grid">
        <div className="patrimonio-section">
          <h3><FaBuilding /> Por Instituição</h3>
          {resumo?.porInstituicao?.length > 0 ? (
            <ul className="lista-distribuicao">
              {resumo.porInstituicao.map((item) => (
                <li key={item.instituicaoId}>
                  <span className="nome">{item.nome}</span>
                  <span className="valor">{formatarMoeda(item.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sem-dados">Nenhuma instituição cadastrada.</p>
          )}
        </div>
        <div className="patrimonio-section">
          <h3><FaChartPie /> Por Propósito</h3>
          {resumo?.porProposito?.length > 0 ? (
            <ul className="lista-distribuicao">
              {resumo.porProposito.map((item) => (
                <li key={item.proposito}>
                  <span className="nome">{item.label}</span>
                  <span className="valor">{formatarMoeda(item.total)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sem-dados">Nenhuma subconta cadastrada.</p>
          )}
        </div>
      </div>

      <div className="patrimonio-actions">
        <button onClick={() => navigate('/patrimonio/evolucao')}>Ver Evolução</button>
        <button onClick={() => navigate('/patrimonio/importacoes-ofx')}>Importar OFX</button>
        <button onClick={() => navigate('/patrimonio/transferencias')}>Transferências</button>
      </div>
    </div>
  );
};

export default PatrimonioPage;
