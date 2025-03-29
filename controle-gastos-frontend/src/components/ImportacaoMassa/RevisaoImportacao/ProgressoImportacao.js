import React from 'react';
import { FaPlay, FaPause, FaCheck, FaTimes, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useImportacao } from '../../../contexts/ImportacaoContext';
import './ProgressoImportacao.css';

const ProgressoImportacao = ({ importacaoId }) => {
  const { 
    progresso, 
    status,
    pausarImportacao,
    continuarImportacao,
    finalizarImportacao,
    cancelarImportacao
  } = useImportacao();

  const handlePausarContinuar = async () => {
    try {
      if (status === 'em_andamento') {
        await pausarImportacao(importacaoId);
        toast.success('Importação pausada com sucesso!');
      } else {
        await continuarImportacao(importacaoId);
        toast.success('Importação retomada com sucesso!');
      }
    } catch (error) {
      toast.error('Erro ao alterar status da importação.');
    }
  };

  const handleFinalizar = async () => {
    if (window.confirm('Tem certeza que deseja finalizar a importação? Esta ação não pode ser desfeita.')) {
      try {
        await finalizarImportacao(importacaoId);
        toast.success('Importação finalizada com sucesso!');
      } catch (error) {
        toast.error('Erro ao finalizar importação.');
      }
    }
  };

  const handleCancelar = async () => {
    if (window.confirm('Tem certeza que deseja cancelar a importação? Esta ação não pode ser desfeita.')) {
      try {
        await cancelarImportacao(importacaoId);
        toast.success('Importação cancelada com sucesso!');
      } catch (error) {
        toast.error('Erro ao cancelar importação.');
      }
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'em_andamento':
        return 'Em Andamento';
      case 'pausada':
        return 'Pausada';
      case 'finalizada':
        return 'Finalizada';
      case 'cancelada':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const getStatusClass = () => {
    switch (status) {
      case 'em_andamento':
        return 'em-andamento';
      case 'pausada':
        return 'pausada';
      case 'finalizada':
        return 'finalizada';
      case 'cancelada':
        return 'cancelada';
      default:
        return '';
    }
  };

  const porcentagemConcluida = Math.round((progresso.transacoesSalvas / progresso.totalTransacoes) * 100);

  return (
    <div className="progresso-importacao">
      <div className="cabecalho-progresso">
        <div className="info-progresso">
          <h3>Progresso da Importação</h3>
          <span className={`status-badge ${getStatusClass()}`}>
            {getStatusText()}
          </span>
        </div>

        <div className="acoes-progresso">
          {status !== 'finalizada' && status !== 'cancelada' && (
            <>
              <button
                className={`btn-acao ${status === 'em_andamento' ? 'pausar' : 'continuar'}`}
                onClick={handlePausarContinuar}
                title={status === 'em_andamento' ? 'Pausar' : 'Continuar'}
              >
                {status === 'em_andamento' ? <FaPause /> : <FaPlay />}
              </button>
              <button
                className="btn-acao finalizar"
                onClick={handleFinalizar}
                title="Finalizar"
              >
                <FaCheck />
              </button>
              <button
                className="btn-acao cancelar"
                onClick={handleCancelar}
                title="Cancelar"
              >
                <FaTimes />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="barra-progresso-container">
        <div className="barra-progresso">
          <div 
            className="progresso-fill"
            style={{ width: `${porcentagemConcluida}%` }}
          />
        </div>
        <div className="detalhes-progresso">
          <span className="porcentagem">{porcentagemConcluida}%</span>
          <span className="contagem">
            {status === 'em_andamento' && <FaSpinner className="spinner" />}
            {progresso.transacoesSalvas} de {progresso.totalTransacoes} transações
          </span>
        </div>
      </div>

      <div className="estatisticas">
        <div className="estatistica">
          <span className="label">Validadas</span>
          <span className="valor">{progresso.transacoesValidadas}</span>
        </div>
        <div className="estatistica">
          <span className="label">Pendentes</span>
          <span className="valor">{progresso.transacoesPendentes}</span>
        </div>
        <div className="estatistica">
          <span className="label">Com Erro</span>
          <span className="valor erro">{progresso.transacoesComErro}</span>
        </div>
      </div>
    </div>
  );
};

export default ProgressoImportacao; 