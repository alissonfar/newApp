import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaPlus, FaSpinner, FaChevronLeft, FaChevronRight, FaTrash, FaExclamationTriangle } from 'react-icons/fa';
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

  const mostrarConfirmacao = (mensagem, tipo) => {
    return new Promise((resolve) => {
      const toastId = toast.warn(
        <div className="confirmacao-toast-content">
          <div className="titulo">
            <FaExclamationTriangle />
            <span>Confirmação Necessária</span>
          </div>
          <div className="mensagem">
            {mensagem}
          </div>
          <div className="acoes">
            <button
              onClick={() => {
                toast.dismiss(toastId);
                resolve(false);
              }}
              className="btn-cancelar"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                toast.dismiss(toastId);
                resolve(true);
              }}
              className={`btn-confirmar ${tipo}`}
            >
              Confirmar
            </button>
          </div>
        </div>,
        {
          position: "top-center",
          autoClose: false,
          closeOnClick: false,
          draggable: false,
          closeButton: false,
          className: 'confirmacao-toast'
        }
      );
    });
  };

  const handleExcluirImportacao = async (importacaoId, status) => {
    if (status === 'finalizada' || status === 'estornada') {
      toast.error('Não é possível excluir uma importação com status ' + status + '.');
      return;
    }

    const mensagemConfirmacao = (
      <div>
        <p>Tem certeza que deseja excluir esta importação?</p>
        <p>Todas as transações importadas associadas (pendentes ou com erro) também serão removidas.</p>
        <p>Esta ação não pode ser desfeita.</p>
      </div>
    );

    const confirmado = await mostrarConfirmacao(mensagemConfirmacao, 'excluir');
    if (!confirmado) return;

    try {
      setLoading(true);
      await importacaoService.excluirImportacao(importacaoId);
      toast.success('Importação excluída com sucesso!');
      await carregarImportacoes(paginacao.pagina);
    } catch (error) {
      console.error('Erro ao excluir importação:', error);
      toast.error(error.message || 'Erro ao excluir importação.');
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
    switch (status.toLowerCase()) {
      case 'finalizada':
        return 'status-badge finalizada';
      case 'estornada':
        return 'status-badge estornada';
      case 'processando':
        return 'status-badge processando';
      case 'pendente':
        return 'status-badge pendente';
      case 'erro':
        return 'status-badge erro';
      case 'validado':
        return 'status-badge validado';
      default:
        return 'status-badge';
    }
  };

  const getStatusText = (status) => {
    switch (status.toLowerCase()) {
      case 'finalizada':
        return 'Finalizada';
      case 'estornada':
        return 'Estornada';
      case 'processando':
        return 'Processando';
      case 'pendente':
        return 'Pendente';
      case 'erro':
        return 'Erro';
      case 'validado':
        return 'Validado';
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
      <div className="page-title">
        <h1>Gerenciamento de Importações</h1>
        <button 
          className="btn-nova-importacao"
          onClick={handleNovaImportacao}
        >
          + Nova Importação
        </button>
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
                  <tr key={importacao.id || importacao._id}>
                    <td>{importacao.descricao}</td>
                    <td>{formatarData(importacao.createdAt || importacao.data)}</td>
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
                              width: `${(importacao.totalProcessado / importacao.totalRegistros) * 100 || 100}%` 
                            }}
                          />
                        </div>
                        <span className="progresso-text">
                          {importacao.totalProcessado || importacao.total || 0}/
                          {importacao.totalRegistros || importacao.total || 0}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="acoes-cell">
                        <button
                          className="btn-detalhes btn-acao"
                          onClick={() => handleContinuarImportacao(importacao.id || importacao._id)}
                          title="Ver detalhes da importação"
                        >
                          Detalhes
                        </button>
                        <button
                          className="btn-excluir btn-acao"
                          onClick={() => handleExcluirImportacao(importacao.id || importacao._id, importacao.status)}
                          disabled={importacao.status === 'finalizada' || importacao.status === 'estornada'}
                          title={importacao.status === 'finalizada' || importacao.status === 'estornada' 
                                 ? 'Não é possível excluir importações finalizadas ou estornadas' 
                                 : 'Excluir esta importação'}
                        >
                          <FaTrash />
                        </button>
                      </div>
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