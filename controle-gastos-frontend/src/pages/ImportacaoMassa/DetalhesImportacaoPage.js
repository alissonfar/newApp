import React, { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaSpinner, FaEdit, FaExclamationTriangle, FaTrash, FaChevronDown, FaChevronRight, FaUser, FaTag, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import NovaTransacaoForm from '../../components/Transaction/NovaTransacaoForm';
import importacaoService from '../../services/importacaoService';
import { useData } from '../../context/DataContext';
import { AuthContext } from '../../context/AuthContext';
import './DetalhesImportacaoPage.css';

const DetalhesImportacaoPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { usuario } = useContext(AuthContext);
    const proprietario = usuario?.preferencias?.proprietario || '';
    const [importacao, setImportacao] = useState(null);
    const [transacoes, setTransacoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingTransacoes, setLoadingTransacoes] = useState(true);
    const [showFormTransacao, setShowFormTransacao] = useState(false);
    const [transacaoEmEdicao, setTransacaoEmEdicao] = useState(null);

    // Estado para controlar quais linhas estão expandidas
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [expandirTodas, setExpandirTodas] = useState(false);

    // Obter categorias e tags do contexto para exibir nomes ao invés de IDs
    const { categorias = [], tags: allTags = [] } = useData();

    useEffect(() => {
        carregarDetalhes();
    }, [id]);

    const carregarDetalhes = async () => {
        try {
            setLoading(true);
            const dados = await importacaoService.obterImportacao(id);
            setImportacao(dados);
            await carregarTransacoes();
        } catch (error) {
            console.error('Erro ao carregar detalhes da importação:', error);
            toast.error('Erro ao carregar detalhes da importação');
            navigate('/importacao');
        } finally {
            setLoading(false);
        }
    };

    const carregarTransacoes = async () => {
        try {
            setLoadingTransacoes(true);
            const response = await importacaoService.listarTransacoes(id, 1, 1000);
            setTransacoes(response.items || []);
        } catch (error) {
            console.error('Erro ao carregar transações:', error);
            toast.error('Erro ao carregar transações');
        } finally {
            setLoadingTransacoes(false);
        }
    };

    const handleValidarTransacao = async (transacaoId) => {
        try {
            await importacaoService.validarTransacao(id, transacaoId);
            toast.success('Transação validada com sucesso');
            await carregarTransacoes(); // Recarrega a lista
        } catch (error) {
            console.error('Erro ao validar transação:', error);
            toast.error('Erro ao validar transação');
        }
    };

    const handleEditarTransacao = (transacao) => {
        // Log da transação recebida para edição
        console.log('[DEBUG] Transação recebida para edição:', {
            id: transacao.id || transacao._id,
            pagamentos: transacao.pagamentos,
            tags: transacao.tags
        });
        
        if (!transacao.importacao) {
            console.error('[DEBUG] ID da importação não encontrado na transação');
            toast.error('Erro ao editar: ID da importação não encontrado');
            return;
        }

        // Converter a transação importada para o formato esperado pelo NovaTransacaoForm
        const transacaoFormatada = {
            _id: transacao.id || transacao._id,
            importacao: transacao.importacao,
            tipo: transacao.tipo,
            descricao: transacao.descricao,
            data: transacao.data,
            valor: transacao.valor,
            observacao: transacao.observacao || '',
            pagamentos: transacao.pagamentos && transacao.pagamentos.length > 0 
                ? transacao.pagamentos.map(p => ({
                    _id: p._id,
                    pessoa: p.pessoa,
                    valor: p.valor,
                    tags: p.tags || {}
                }))
                : [{
                    pessoa: 'Eu',
                    valor: transacao.valor,
                    tags: {}
                }]
        };
        
        // Log da transação após formatação
        console.log('[DEBUG] Transação formatada para edição:', {
            _id: transacaoFormatada._id,
            pagamentos: transacaoFormatada.pagamentos
        });
        
        setTransacaoEmEdicao(transacaoFormatada);
        setShowFormTransacao(true);
    };

    const handleSaveTransacao = async (transacaoEditada) => {
        try {
            // Log dos dados antes da atualização
            console.log('[DEBUG] Dados para atualização:', {
                transacaoEmEdicao: {
                    _id: transacaoEmEdicao?._id,
                    pagamentos: transacaoEmEdicao?.pagamentos
                },
                transacaoEditada: {
                    _id: transacaoEditada._id,
                    pagamentos: transacaoEditada.pagamentos
                },
                importacaoId: id
            });

            // Garantindo que temos o ID da importação
            const importacaoId = id || transacaoEmEdicao?.importacao;
            
            if (!importacaoId) {
                throw new Error('ID da importação não encontrado');
            }

            // Garantindo que todos os dados necessários estão presentes e alterando o status para 'revisada'
            const dadosAtualizados = {
                ...transacaoEditada,
                importacao: importacaoId,
                status: 'revisada' // Força o status para 'revisada' após qualquer edição
            };

            // Log dos dados finais que serão enviados para o backend
            console.log('[DEBUG] Dados finais para atualização:', {
                _id: dadosAtualizados._id,
                importacaoId,
                pagamentos: dadosAtualizados.pagamentos,
                status: dadosAtualizados.status
            });
            
            await importacaoService.atualizarTransacao(
                importacaoId,
                transacaoEditada._id || transacaoEditada.id,
                dadosAtualizados
            );
            
            toast.success('Transação atualizada com sucesso!');
            setShowFormTransacao(false);
            carregarTransacoes();
        } catch (error) {
            console.error('[DEBUG] Erro ao atualizar transação:', error);
            toast.error(error.message || 'Erro ao atualizar transação.');
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

    const formatarValor = (valor) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    };

    // Função auxiliar para obter o nome da tag pelo ID
    const obterNomeTag = (tagId) => {
        const tag = allTags.find(t => t._id === tagId);
        return tag ? tag.nome : tagId;
    };

    // Função auxiliar para obter o nome da categoria pelo ID
    const obterNomeCategoria = (categoriaId) => {
        const categoria = categorias.find(c => c._id === categoriaId);
        return categoria ? categoria.nome : categoriaId;
    };

    // Verifica se todas as transações foram validadas (não apenas revisadas)
    const todasTransacoesValidadas = transacoes?.every(t => t.status === 'validada');

    // Função para mostrar confirmação customizada
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

    // Função para excluir uma transação
    const handleExcluirTransacao = async (transacaoId) => {
        const mensagemConfirmacao = (
            <div>
                <p>Tem certeza que deseja excluir esta transação importada?</p>
                <p>Esta ação não pode ser desfeita.</p>
            </div>
        );

        const confirmado = await mostrarConfirmacao(mensagemConfirmacao, 'excluir');
        if (!confirmado) return;

        try {
            await importacaoService.excluirTransacao(transacaoId);
            toast.success('Transação excluída com sucesso!');
            // Remove a transação do estado local para atualizar a UI imediatamente
            setTransacoes(prevTransacoes => prevTransacoes.filter(t => t.id !== transacaoId));
            // Opcional: recarregar detalhes para atualizar contadores, se necessário
            await carregarDetalhes();
        } catch (error) {
            console.error('Erro ao excluir transação:', error);
            toast.error(error.message || 'Erro ao excluir transação.');
        }
    };

    // Função para finalizar importação
    const handleFinalizarImportacao = async () => {
        const mensagemConfirmacao = (
            <div>
                <p>Ao finalizar:</p>
                <ul>
                    <li>Todas as transações validadas serão criadas no sistema</li>
                    <li>A importação não poderá mais ser editada</li>
                    <li>Você só poderá estornar a importação depois</li>
                </ul>
            </div>
        );

        const confirmado = await mostrarConfirmacao(mensagemConfirmacao, 'finalizar');
        if (!confirmado) return;

        try {
            await importacaoService.finalizarImportacao(id);
            toast.success('Importação finalizada com sucesso!');
            await carregarDetalhes();
        } catch (error) {
            console.error('Erro ao finalizar importação:', error);
            toast.error(error.message || 'Erro ao finalizar importação');
        }
    };

    // Funções para gerenciar expansão das linhas
    const toggleRow = (transacaoId) => {
        const newExpandedRows = new Set(expandedRows);
        if (newExpandedRows.has(transacaoId)) {
            newExpandedRows.delete(transacaoId);
        } else {
            newExpandedRows.add(transacaoId);
        }
        setExpandedRows(newExpandedRows);
    };

    const toggleExpandirTodas = () => {
        if (expandirTodas) {
            setExpandedRows(new Set());
        } else {
            const allIds = new Set(transacoes.map(t => t.id));
            setExpandedRows(allIds);
        }
        setExpandirTodas(!expandirTodas);
    };

    // Função para verificar se a importação pode ser editada
    const podeEditar = (importacao) => {
        return !['finalizada', 'estornada'].includes(importacao.status);
    };

    // Função para verificar se a importação pode ser finalizada
    const podeFinalizar = (importacao) => {
        const todasValidadas = transacoes?.every(t => t.status === 'validada');
        return importacao.status !== 'finalizada' && todasValidadas;
    };

    // Função para verificar se a importação pode ser estornada
    const podeEstornar = (importacao) => {
        return importacao.status === 'finalizada';
    };

    // Função para estornar importação
    const handleEstornarImportacao = async () => {
        const mensagemConfirmacao = (
            <div>
                <p>Ao estornar:</p>
                <ul>
                    <li>Todas as transações serão marcadas como estornadas</li>
                    <li>As transações originais serão mantidas no histórico</li>
                    <li>Esta ação não pode ser desfeita</li>
                </ul>
            </div>
        );

        const confirmado = await mostrarConfirmacao(mensagemConfirmacao, 'estornar');
        if (!confirmado) return;

        try {
            await importacaoService.estornarImportacao(id);
            toast.success('Importação estornada com sucesso!');
            await carregarDetalhes();
        } catch (error) {
            console.error('Erro ao estornar importação:', error);
            toast.error('Erro ao estornar importação');
        }
    };

    if (loading) {
        return (
            <div className="carregando-container">
                <FaSpinner className="spinner" />
                <p>Carregando...</p>
            </div>
        );
    }

    if (!importacao) {
        return (
            <div className="carregando-container">
                <p className="erro-mensagem">Importação não encontrada</p>
            </div>
        );
    }

    return (
        <div className="detalhes-importacao-container">
            <div className="page-header">
                <button onClick={() => navigate(-1)} className="btn-voltar">
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Voltar
                </button>
                <h1>Detalhes da Importação</h1>
            </div>

            <div className="importacao-card">
                <div className="importacao-header">
                    <h2 className="importacao-titulo">{importacao.descricao}</h2>
                    <span className={`status-badge ${importacao.status}`}>
                        {importacao.status.charAt(0).toUpperCase() + importacao.status.slice(1)}
                    </span>
                </div>

                <div className="importacao-info">
                    <div className="info-item">
                        <label>Nome do Arquivo</label>
                        <span>{importacao.nomeArquivo || 'Não informado'}</span>
                    </div>
                    <div className="info-item">
                        <label>Data de Criação</label>
                        <span>{formatarData(importacao.createdAt)}</span>
                    </div>
                    <div className="info-item">
                        <label>Total de Transações</label>
                        <span>{transacoes.length}</span>
                    </div>
                    <div className="info-item">
                        <label>Valor Total</label>
                        <span>{formatarValor(transacoes.reduce((sum, t) => sum + (t.valor || 0), 0))}</span>
                    </div>
                </div>

                <div className="resumo-status">
                    <h3>Resumo do Status</h3>
                    <div className="status-grid">
                        <div className="status-card validadas">
                            <label>Validadas</label>
                            <span>{transacoes.filter(t => t.status === 'validada').length}</span>
                        </div>
                        <div className="status-card pendentes">
                            <label>Pendentes</label>
                            <span>{transacoes.filter(t => t.status === 'pendente').length}</span>
                        </div>
                        <div className="status-card processadas">
                            <label>Processadas</label>
                            <span>{transacoes.filter(t => t.status === 'processada').length}</span>
                        </div>
                        <div className="status-card erro">
                            <label>Com Erro</label>
                            <span>{transacoes.filter(t => t.status === 'erro').length}</span>
                        </div>
                    </div>
                </div>

                <div className="acoes-principais">
                    {podeFinalizar(importacao) && (
                        <button
                            className="btn-finalizar"
                            onClick={handleFinalizarImportacao}
                        >
                            Finalizar Importação
                        </button>
                    )}
                    {podeEstornar(importacao) && (
                        <button
                            className="btn-estornar"
                            onClick={handleEstornarImportacao}
                        >
                            Estornar Importação
                        </button>
                    )}
                </div>
            </div>

            <div className="importacao-card">
                <div className="lista-header">
                    <h3>Lista de Transações</h3>
                    <button
                        className="btn-expandir-todas"
                        onClick={toggleExpandirTodas}
                        title={expandirTodas ? "Recolher todas" : "Expandir todas"}
                    >
                        {expandirTodas ? (
                            <>
                                <FaChevronRight /> Recolher Todas
                            </>
                        ) : (
                            <>
                                <FaChevronDown /> Expandir Todas
                            </>
                        )}
                    </button>
                </div>
                <table className="transacoes-table">
                    <thead>
                        <tr>
                            <th style={{ width: '40px' }}></th>
                            <th>Descrição</th>
                            <th>Valor</th>
                            <th>Data</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transacoes.map((transacao) => (
                            <React.Fragment key={transacao.id}>
                                <tr
                                    className={`status-${transacao.status}`}
                                >
                                    <td className="expand-cell">
                                        <button
                                            className="btn-expand"
                                            onClick={() => toggleRow(transacao.id)}
                                            title={expandedRows.has(transacao.id) ? "Recolher detalhes" : "Expandir detalhes"}
                                        >
                                            {expandedRows.has(transacao.id) ? (
                                                <FaChevronDown />
                                            ) : (
                                                <FaChevronRight />
                                            )}
                                        </button>
                                    </td>
                                    <td>{transacao.descricao}</td>
                                    <td>{formatarValor(transacao.valor)}</td>
                                    <td>{formatarData(transacao.data)}</td>
                                    <td>
                                        <span className={`status-badge ${transacao.status}`}>
                                            {transacao.status.charAt(0).toUpperCase() + transacao.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="acoes-cell">
                                        {podeEditar(importacao) && (
                                            <>
                                                <button
                                                    onClick={() => handleEditarTransacao(transacao)}
                                                    className="btn-acao btn-editar"
                                                    title="Ao editar, a transação voltará para o status 'Revisada'"
                                                >
                                                    Editar
                                                </button>
                                                {transacao.status !== 'validada' && (
                                                    <button
                                                        onClick={() => handleValidarTransacao(transacao.id)}
                                                        className="btn-acao btn-validar"
                                                    >
                                                        Validar
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleExcluirTransacao(transacao.id)}
                                                    className="btn-acao btn-excluir"
                                                    title="Excluir esta transação"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>

                                {/* Linha de resumo expansível */}
                                {expandedRows.has(transacao.id) && (
                                    <tr className="resumo-row">
                                        <td colSpan="6">
                                            <div className="mini-resumo">
                                                {/* Tipo da Transação */}
                                                <div className="resumo-item">
                                                    <div className="resumo-label">
                                                        {transacao.tipo === 'gasto' ? <FaArrowDown /> : <FaArrowUp />}
                                                        <span>Tipo</span>
                                                    </div>
                                                    <div className={`resumo-valor tipo-${transacao.tipo}`}>
                                                        {transacao.tipo === 'gasto' ? 'Gasto' : 'Recebível'}
                                                    </div>
                                                </div>

                                                {/* Pessoas */}
                                                <div className="resumo-item">
                                                    <div className="resumo-label">
                                                        <FaUser />
                                                        <span>Pessoa(s)</span>
                                                    </div>
                                                    <div className="resumo-valor">
                                                        {transacao.pagamentos && transacao.pagamentos.length > 0 ? (
                                                            transacao.pagamentos.map((pag, index) => (
                                                                <span key={index} className="pessoa-badge">
                                                                    {pag.pessoa}
                                                                    {pag.valor && (
                                                                        <span className="pessoa-valor">
                                                                            {formatarValor(pag.valor)}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="texto-vazio">Nenhuma pessoa atribuída</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Tags */}
                                                <div className="resumo-item">
                                                    <div className="resumo-label">
                                                        <FaTag />
                                                        <span>Tags</span>
                                                    </div>
                                                    <div className="resumo-valor">
                                                        {transacao.pagamentos && transacao.pagamentos.length > 0 ? (
                                                            (() => {
                                                                // Coleta todas as tags de todos os pagamentos
                                                                const todasAsTags = [];
                                                                transacao.pagamentos.forEach(pag => {
                                                                    if (pag.tags && typeof pag.tags === 'object') {
                                                                        Object.entries(pag.tags).forEach(([categoriaId, tagsList]) => {
                                                                            if (Array.isArray(tagsList) && tagsList.length > 0) {
                                                                                const nomeCategoria = obterNomeCategoria(categoriaId);
                                                                                tagsList.forEach(tagId => {
                                                                                    const nomeTag = obterNomeTag(tagId);
                                                                                    todasAsTags.push({
                                                                                        categoriaId,
                                                                                        nomeCategoria,
                                                                                        tagId,
                                                                                        nomeTag
                                                                                    });
                                                                                });
                                                                            }
                                                                        });
                                                                    }
                                                                });

                                                                return todasAsTags.length > 0 ? (
                                                                    todasAsTags.map((tag, index) => (
                                                                        <span key={index} className="tag-badge" title={`${tag.nomeCategoria}: ${tag.nomeTag}`}>
                                                                            {tag.nomeTag}
                                                                        </span>
                                                                    ))
                                                                ) : (
                                                                    <span className="texto-vazio">Nenhuma tag atribuída</span>
                                                                );
                                                            })()
                                                        ) : (
                                                            <span className="texto-vazio">Nenhuma tag atribuída</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {showFormTransacao && (
                <div className="modal">
                    <div className="modal-content">
                        <NovaTransacaoForm
                            transacao={transacaoEmEdicao}
                            onSuccess={handleSaveTransacao}
                            onClose={() => {
                                setShowFormTransacao(false);
                                setTransacaoEmEdicao(null);
                            }}
                            proprietarioPadrao={proprietario}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DetalhesImportacaoPage; 