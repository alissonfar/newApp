import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaPlus, FaSpinner } from 'react-icons/fa';
import importacaoService from '../../services/importacaoService';
import './GerenciamentoImportacoesPage.css';

const GerenciamentoImportacoesPage = () => {
  const navigate = useNavigate();
  const [importacoes, setImportacoes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarImportacoes();
  }, []);

  const carregarImportacoes = async () => {
    try {
      const data = await importacaoService.listarImportacoes();
      setImportacoes(data);
    } catch (error) {
      console.error('Erro ao carregar importações:', error);
      toast.error('Erro ao carregar lista de importações.');
    } finally {
      setLoading(false);
    }
  };

  const handleNovaImportacao = () => {
    navigate('/importacao/nova');
  };

  const handleContinuarImportacao = (importacaoId) => {
    navigate(`/importacao/${importacaoId}`);
  };

  const formatarData = (data) => {
    return new Date(data).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'em_andamento':
        return 'status-badge em-andamento';
      case 'finalizada':
        return 'status-badge finalizada';
      default:
        return 'status-badge';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'em_andamento':
        return 'Em Andamento';
      case 'finalizada':
        return 'Finalizada';
      default:
        return status;
    }
  };

  return (
    <div className="gerenciamento-importacoes">
      <div className="page-header">
        <div className="header-content">
          <h1>Gerenciamento de Importações</h1>
          <button 
            className="btn-nova-importacao"
            onClick={handleNovaImportacao}
          >
            <FaPlus /> Nova Importação
          </button>
        </div>
      </div>

      <div className="importacoes-container">
        {loading ? (
          <div className="loading-state">
            <FaSpinner className="spinner" />
            <p>Carregando importações...</p>
          </div>
        ) : importacoes.length === 0 ? (
          <div className="empty-state">
            <p>Nenhuma importação encontrada.</p>
            <button 
              className="btn-primeira-importacao"
              onClick={handleNovaImportacao}
            >
              Criar Primeira Importação
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="importacoes-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Progresso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {importacoes.map((importacao) => (
                  <tr key={importacao.id}>
                    <td>{importacao.descricao}</td>
                    <td>{formatarData(importacao.dataImportacao)}</td>
                    <td className="tipo-arquivo">
                      {importacao.tipoArquivo.toUpperCase()}
                    </td>
                    <td>
                      <span className={getStatusBadgeClass(importacao.status)}>
                        {getStatusText(importacao.status)}
                      </span>
                    </td>
                    <td>
                      <div className="progresso-container">
                        <div className="progresso-bar">
                          <div 
                            className="progresso-fill"
                            style={{ 
                              width: `${(importacao.transacoesSalvas / importacao.totalTransacoes) * 100}%` 
                            }}
                          />
                        </div>
                        <span className="progresso-text">
                          {importacao.transacoesSalvas}/{importacao.totalTransacoes}
                        </span>
                      </div>
                    </td>
                    <td>
                      {importacao.status === 'em_andamento' && (
                        <button
                          className="btn-continuar"
                          onClick={() => handleContinuarImportacao(importacao.id)}
                        >
                          Continuar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GerenciamentoImportacoesPage; 