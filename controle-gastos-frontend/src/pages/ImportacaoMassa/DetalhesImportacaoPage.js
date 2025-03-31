import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaSpinner, FaEdit, FaExclamationTriangle } from 'react-icons/fa';
import NovaTransacaoForm from '../../components/Transaction/NovaTransacaoForm';
import importacaoService from '../../services/importacaoService';
import './DetalhesImportacaoPage.css';

const DetalhesImportacaoPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [importacao, setImportacao] = useState(null);
    const [transacoes, setTransacoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingTransacoes, setLoadingTransacoes] = useState(true);
    const [showFormTransacao, setShowFormTransacao] = useState(false);
    const [transacaoEmEdicao, setTransacaoEmEdicao] = useState(null);

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
            const response = await importacaoService.listarTransacoes(id);
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
                <h3>Lista de Transações</h3>
                <table className="transacoes-table">
                    <thead>
                        <tr>
                            <th>Descrição</th>
                            <th>Valor</th>
                            <th>Data</th>
                            <th>Status</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transacoes.map((transacao) => (
                            <tr 
                                key={transacao.id} 
                                className={`status-${transacao.status}`}
                            >
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
                                        </>
                                    )}
                                </td>
                            </tr>
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
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default DetalhesImportacaoPage; 