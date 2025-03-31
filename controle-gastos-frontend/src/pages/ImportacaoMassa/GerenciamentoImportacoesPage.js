import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaPlus, FaSpinner, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import importacaoService from '../../services/importacaoService';
import './GerenciamentoImportacoesPage.css';

const GerenciamentoImportacoesPage = () => {
  const navigate = useNavigate();
  const [importacoes, setImportacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paginacao, setPaginacao] = useState({
    pagina: 1,
    totalPaginas: 1,
    total: 0
  });

  useEffect(() => {
    carregarImportacoes(1);
  }, []);

  const carregarImportacoes = async (pagina = 1) => {
    try {
      setLoading(true);
      setError(null);
      const data = await importacaoService.listarImportacoes(pagina);
      setImportacoes(data.docs || []);
      setPaginacao({
        pagina: data.page || 1,
        totalPaginas: data.totalPages || 1,
        total: data.total || 0
      });
    } catch (error) {
      console.error('Erro ao carregar importações:', error);
      setError('Erro ao carregar lista de importações.');
      toast.error('Erro ao carregar lista de importações.');
      setImportacoes([]);
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

  const handlePaginaAnterior = () => {
    if (paginacao.pagina > 1) {
      carregarImportacoes(paginacao.pagina - 1);
    }
  };

  const handleProximaPagina = () => {
    if (paginacao.pagina < paginacao.totalPaginas) {
      carregarImportacoes(paginacao.pagina + 1);
    }
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
      case 'pendente':
        return 'status-badge pendente';
      case 'processando':
        return 'status-badge processando';
      case 'concluido':
        return 'status-badge concluido';
      case 'concluido_com_erros':
        return 'status-badge concluido-erros';
      case 'erro':
        return 'status-badge erro';
      default:
        return 'status-badge';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pendente':
        return 'Pendente';
      case 'processando':
        return 'Processando';
      case 'concluido':
        return 'Concluído';
      case 'concluido_com_erros':
        return 'Concluído com Erros';
      case 'erro':
        return 'Erro';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="gerenciamento-importacoes">
        <div className="page-header">
          <div className="header-content">
            <h1>Gerenciamento de Importações</h1>
          </div>
        </div>
        <div className="loading-state">
          <FaSpinner className="spinner" />
          <p>Carregando importações...</p>
        </div>
      </div>
    );
  }

  if (error) {
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
        <div className="error-state">
          <p>{error}</p>
          <button onClick={() => carregarImportacoes(1)} className="btn-retry">
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

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

      {importacoes.length === 0 ? (
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
        <>
          <div className="table-container">
            <table className="importacoes-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Progresso</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {importacoes.map((importacao) => (
                  <tr key={importacao.id}>
                    <td>{importacao.descricao}</td>
                    <td>{formatarData(importacao.createdAt)}</td>
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
                            style={{ width: `${importacao.progresso}%` }}
                          />
                        </div>
                        <span className="progresso-text">
                          {importacao.totalSucesso}/{importacao.totalProcessado}
                        </span>
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn-continuar"
                        onClick={() => handleContinuarImportacao(importacao.id)}
                      >
                        Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="paginacao">
            <button 
              onClick={handlePaginaAnterior}
              disabled={paginacao.pagina === 1}
              className="btn-pagina"
            >
              <FaChevronLeft /> Anterior
            </button>
            <span className="info-pagina">
              Página {paginacao.pagina} de {paginacao.totalPaginas}
            </span>
            <button 
              onClick={handleProximaPagina}
              disabled={paginacao.pagina === paginacao.totalPaginas}
              className="btn-pagina"
            >
              Próxima <FaChevronRight />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default GerenciamentoImportacoesPage; 