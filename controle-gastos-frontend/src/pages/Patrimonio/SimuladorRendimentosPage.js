import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaCalculator } from 'react-icons/fa';
import useCdiData from '../../hooks/useCdiData';
import CdiDataCard from '../../components/Patrimonio/CdiDataCard';
import SimuladorForm from '../../components/Patrimonio/SimuladorForm';
import ComparacaoRapidaCard from '../../components/Patrimonio/ComparacaoRapidaCard';
import Button from '../../components/shared/Button';
import './SimuladorRendimentosPage.css';

const SimuladorRendimentosPage = () => {
  const navigate = useNavigate();
  const { cdi, loading, error, refetch } = useCdiData();

  return (
    <div className="simulador-rendimentos-page">
      <div className="simulador-rendimentos-header">
        <Button variant="ghost" icon={<FaArrowLeft size={14} />} onClick={() => navigate('/patrimonio')}>
          Voltar
        </Button>
        <h1 className="simulador-rendimentos-title">
          <FaCalculator /> Simulador de Rendimentos
        </h1>
      </div>

      <div className="simulador-rendimentos-grid">
        <div className="simulador-rendimentos-main">
          <CdiDataCard cdi={cdi} loading={loading} error={error} onRefetch={refetch} />
          <SimuladorForm cdi={cdi} />
        </div>
        <aside className="simulador-rendimentos-sidebar">
          <ComparacaoRapidaCard cdi={cdi} />
        </aside>
      </div>
    </div>
  );
};

export default SimuladorRendimentosPage;
