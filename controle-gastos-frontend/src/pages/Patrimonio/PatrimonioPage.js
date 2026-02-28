import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPiggyBank, FaBuilding, FaChartPie, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
import patrimonioApi from '../../services/patrimonioApi';
import PatrimonioStatCard from '../../components/Patrimonio/PatrimonioStatCard';
import PatrimonioAlerta from '../../components/Patrimonio/PatrimonioAlerta';
import SectionHeader from '../../components/shared/SectionHeader';
import Button from '../../components/shared/Button';
import Card from '../../components/shared/Card';
import EmptyState from '../../components/shared/EmptyState';
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
        <Button variant="primary" onClick={() => navigate('/patrimonio/contas')}>
          Gerenciar Contas
        </Button>
      </div>

      <div className="patrimonio-cards">
        <PatrimonioStatCard
          label="Total Geral"
          valor={formatarMoeda(resumo?.totalGeral)}
          icon="piggybank"
        />
        <PatrimonioStatCard
          label="Rendimento Estimado (mês)"
          valor={formatarMoeda(resumo?.rendimentoEstimadoConsolidado)}
          icon="chartline"
          badge={{ label: 'Estimativa', variant: 'neutral' }}
        />
      </div>

      {resumo?.subcontasDesatualizadas?.length > 0 && (
        <PatrimonioAlerta
          subcontasDesatualizadas={resumo.subcontasDesatualizadas}
          onNavigateSubconta={(path) => navigate(path)}
        />
      )}

      <div className="patrimonio-grid">
        <Card className="patrimonio-section">
          <SectionHeader title="Por Instituição" icon={<FaBuilding />} />
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
            <EmptyState message="Nenhuma instituição cadastrada." />
          )}
        </Card>
        <Card className="patrimonio-section">
          <SectionHeader title="Por Propósito" icon={<FaChartPie />} />
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
            <EmptyState message="Nenhuma subconta cadastrada." />
          )}
        </Card>
      </div>

      <div className="patrimonio-actions">
        <Button variant="success" onClick={() => navigate('/patrimonio/evolucao')}>
          Ver Evolução
        </Button>
        <Button variant="primary" onClick={() => navigate('/patrimonio/importacoes-ofx')}>
          Importar OFX
        </Button>
        <Button variant="primary" onClick={() => navigate('/patrimonio/transferencias')}>
          Transferências
        </Button>
      </div>
    </div>
  );
};

export default PatrimonioPage;
