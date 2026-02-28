import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaSpinner, FaExclamationTriangle, FaTrash, FaChevronDown, FaChevronRight, FaUser, FaTag, FaArrowUp, FaArrowDown, FaCopy } from 'react-icons/fa';
import NovaTransacaoForm from '../../components/Transaction/NovaTransacaoForm';
import importacaoService from '../../services/importacaoService';
import patrimonioApi from '../../services/patrimonioApi';
import SubcontaSelect from '../../components/shared/SubcontaSelect';
import { useData } from '../../context/DataContext';
import { obterCategorias } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { useConfirmacao } from '../../hooks/useConfirmacao';
import './DetalhesImportacaoPage.css';

const DetalhesImportacaoPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { mostrarConfirmacao } = useConfirmacao();
    const { usuario } = useContext(AuthContext);
    const proprietario = usuario?.preferencias?.proprietario || '';
    const [importacao, setImportacao] = useState(null);
    const [transacoes, setTransacoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showFormTransacao, setShowFormTransacao] = useState(false);
    const [transacaoEmEdicao, setTransacaoEmEdicao] = useState(null);

    // Estado para controlar quais linhas estão expandidas
    const [expandedRows, setExpandedRows] = useState(new Set());
    const [expandirTodas, setExpandirTodas] = useState(false);
    const [duplicando, setDuplicando] = useState(false);
    const [abaAtiva, setAbaAtiva] = useState('novas'); // 'novas' | 'ja_importadas' | 'ignoradas'
    const [selecionados, setSelecionados] = useState(new Set());
    const [executandoAcaoMassa, setExecutandoAcaoMassa] = useState(false);
    const [modalAtualizarSaldo, setModalAtualizarSaldo] = useState(false);
    const [subcontas, setSubcontas] = useState([]);
    const [saldoSubcontaId, setSaldoSubcontaId] = useState('');
    const [saldoSubcontaValor, setSaldoSubcontaValor] = useState('');
    const [atualizandoSaldo, setAtualizandoSaldo] = useState(false);

    // Obter tags do contexto; categorias (incluindo inativas) para exibir nomes no histórico
    const { tags: allTags = [] } = useData();
    const [categorias, setCategorias] = useState([]);

    useEffect(() => {
        async function loadCategorias() {
            try {
                const cats = await obterCategorias(true);
                setCategorias(cats);
            } catch (e) {
                console.error('Erro ao carregar categorias:', e);
            }
        }
        loadCategorias();
    }, []);

    const carregarDetalhes = useCallback(async () => {
        try {
            setLoading(true);
            const dados = await importacaoService.obterImportacao(id);
            setImportacao(dados);
            const options = {};
            if (abaAtiva === 'ignoradas') {
                options.status = 'ignorada';
            } else if (dados?.tipoImportacao === 'complementar') {
                if (abaAtiva === 'novas') options.status_not = 'ja_importada';
                else if (abaAtiva === 'ja_importadas') options.status = 'ja_importada';
            }
            const response = await importacaoService.listarTransacoes(id, 1, 1000, options);
            setTransacoes(response.items || []);
        } catch (error) {
            console.error('Erro ao carregar detalhes da importação:', error);
            toast.error('Erro ao carregar detalhes da importação');
            navigate('/importacao');
        } finally {
            setLoading(false);
        }
    }, [id, abaAtiva, navigate]);

    useEffect(() => {
        carregarDetalhes();
    }, [carregarDetalhes]);

    const carregarTransacoes = async (aba = abaAtiva, importacaoRef = null) => {
        const imp = importacaoRef || importacao;
        try {
            const options = {};
            if (aba === 'ignoradas') {
                options.status = 'ignorada';
            } else if (imp?.tipoImportacao === 'complementar') {
                if (aba === 'novas') options.status_not = 'ja_importada'; // Backend também exclui ignorada
                else if (aba === 'ja_importadas') options.status = 'ja_importada';
            }
            const response = await importacaoService.listarTransacoes(id, 1, 1000, options);
            setTransacoes(response.items || []);
        } catch (error) {
            console.error('Erro ao carregar transações:', error);
            toast.error('Erro ao carregar transações');
        }
    };

    const handleTrocarAba = (aba) => {
        setAbaAtiva(aba);
        setSelecionados(new Set());
        carregarTransacoes(aba, importacao);
    };

    const toggleSelecao = (transacaoId) => {
        setSelecionados(prev => {
            const next = new Set(prev);
            if (next.has(transacaoId)) next.delete(transacaoId);
            else next.add(transacaoId);
            return next;
        });
    };

    const toggleSelecionarTodas = () => {
        if (selecionados.size === transacoes.length) {
            setSelecionados(new Set());
        } else {
            setSelecionados(new Set(transacoes.map(t => t.id)));
        }
    };

    const handleAcaoMassa = async (acao) => {
        const ids = Array.from(selecionados);
        if (ids.length === 0) {
            toast.warn('Selecione pelo menos uma transação.');
            return;
        }
        const mensagem = acao === 'ignorar'
            ? `Ignorar ${ids.length} transação(ões)? Elas não reaparecerão em importações futuras.`
            : `Validar ${ids.length} transação(ões)?`;
        const confirmado = await mostrarConfirmacao(mensagem, acao === 'ignorar' ? 'excluir' : 'finalizar');
        if (!confirmado) return;
        try {
            setExecutandoAcaoMassa(true);
            const resultado = await importacaoService.acoesMassa(ids, acao);
            toast.success(`${resultado.sucessos} transação(ões) processada(s) com sucesso.`);
            if (resultado.erros > 0) {
                toast.warn(`${resultado.erros} transação(ões) não puderam ser processadas.`);
            }
            setSelecionados(new Set());
            await carregarDetalhes();
        } catch (error) {
            toast.error(error.message || 'Erro ao executar ação em massa.');
        } finally {
            setExecutandoAcaoMassa(false);
        }
    };

    const handleValidarTransacao = async (transacaoId) => {
        try {
            await importacaoService.validarTransacao(id, transacaoId);
            toast.success('Transação validada com sucesso');
            await carregarDetalhes();
        } catch (error) {
            console.error('Erro ao validar transação:', error);
            toast.error('Erro ao validar transação');
        }
    };

    const handleEditarTransacao = (transacao) => {
        if (!transacao.importacao) {
            toast.error('Erro ao editar: ID da importação não encontrado');
            return;
        }

        // Para parcelamento: detectar se valor é total ou parcela (1 linha = total, N linhas = parcela)
        let valorEhTotalNaImportacao = true;
        if (transacao.isInstallment && transacao.installmentGroupId && transacao.installmentTotal >= 2) {
            const mesmoGrupo = transacoes.filter(t =>
                t.installmentGroupId && String(t.installmentGroupId) === String(transacao.installmentGroupId)
            );
            valorEhTotalNaImportacao = mesmoGrupo.length < transacao.installmentTotal;
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
                }],
            isInstallment: transacao.isInstallment || false,
            installmentTotal: transacao.installmentTotal,
            installmentNumber: transacao.installmentNumber,
            installmentIntervalMonths: transacao.installmentIntervalMonths,
            installmentIntervalDays: transacao.installmentIntervalDays,
            valorEhTotalNaImportacao
        };
        
        setTransacaoEmEdicao(transacaoFormatada);
        setShowFormTransacao(true);
    };

    const handleSaveTransacao = async (transacaoEditada) => {
        try {
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

            await importacaoService.atualizarTransacao(
                importacaoId,
                transacaoEditada._id || transacaoEditada.id,
                dadosAtualizados
            );
            
            toast.success('Transação atualizada com sucesso!');
            setShowFormTransacao(false);
            await carregarDetalhes();
        } catch (error) {
            console.error('Erro ao atualizar transação:', error);
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

    // Para importação complementar: pode finalizar se houver pelo menos uma validada
    // Para importação normal: pode finalizar se todas as transações (exceto ja_importada) forem validadas
    const temTransacoesValidadas = importacao?.estatisticas?.transacoesSucesso > 0;
    const transacoesNaoJaImportadas = transacoes?.filter(t => t.status !== 'ja_importada') || [];
    const todasNovasValidadas = transacoesNaoJaImportadas.length > 0 &&
        transacoesNaoJaImportadas.every(t => t.status === 'validada' || t.status === 'erro');
    const podeFinalizarImportacao = importacao?.status !== 'finalizada' &&
        (importacao?.tipoImportacao === 'complementar' ? temTransacoesValidadas : todasNovasValidadas);

    // Função para excluir uma transação
    const handleExcluirTransacao = async (transacaoId) => {
        const mensagemConfirmacao = (
            <div>
                <p>Tem certeza que deseja ignorar esta transação?</p>
                <p>Ela não reaparecerá em importações complementares futuras.</p>
            </div>
        );

        const confirmado = await mostrarConfirmacao(mensagemConfirmacao, 'excluir');
        if (!confirmado) return;

        try {
            await importacaoService.excluirTransacao(transacaoId);
            toast.success('Transação ignorada com sucesso!');
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
            const subcontasList = await patrimonioApi.listarSubcontas().catch(() => []);
            setSubcontas(subcontasList);
            if (subcontasList.length > 0) {
                setModalAtualizarSaldo(true);
                setSaldoSubcontaId('');
                setSaldoSubcontaValor('');
            }
        } catch (error) {
            console.error('Erro ao finalizar importação:', error);
            toast.error(error.message || 'Erro ao finalizar importação');
        }
    };

    const handleConfirmarAtualizarSaldo = async () => {
        const valor = parseFloat(saldoSubcontaValor);
        if (!saldoSubcontaId || isNaN(valor)) {
            toast.error('Selecione uma subconta e informe o saldo.');
            return;
        }
        try {
            setAtualizandoSaldo(true);
            await patrimonioApi.confirmarSaldo(saldoSubcontaId, {
                saldo: valor,
                observacao: `Importação #${id}`,
                origem: 'importacao_csv'
            });
            toast.success('Saldo atualizado com sucesso!');
            setModalAtualizarSaldo(false);
        } catch (error) {
            toast.error(error.message || 'Erro ao atualizar saldo.');
        } finally {
            setAtualizandoSaldo(false);
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
    const podeFinalizar = (imp) => podeFinalizarImportacao && imp?.status !== 'finalizada';

    // Função para verificar se a importação pode ser estornada
    const podeEstornar = (importacao) => {
        return importacao.status === 'finalizada';
    };

    // Função para verificar se a importação pode ser duplicada
    const podeDuplicar = (importacao) => {
        return ['validado', 'finalizada', 'estornada', 'erro'].includes(importacao.status);
    };

    // Função para duplicar importação
    const handleDuplicarImportacao = async () => {
        try {
            setDuplicando(true);
            const novaImportacao = await importacaoService.duplicarImportacao(id);
            toast.success('Importação duplicada com sucesso!');
            navigate(`/importacao/${novaImportacao.id || novaImportacao._id}`);
        } catch (error) {
            console.error('Erro ao duplicar importação:', error);
            toast.error(error.message || 'Erro ao duplicar importação');
        } finally {
            setDuplicando(false);
        }
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
                        <span>{importacao?.estatisticas?.totalTransacoes ?? transacoes.length}</span>
                    </div>
                    <div className="info-item">
                        <label>Valor Total</label>
                        <span>{formatarValor(transacoes.reduce((sum, t) => sum + (t.valor || 0), 0))}</span>
                    </div>
                </div>

                <div className="resumo-status">
                    <h3>Resumo do Status</h3>
                    {importacao?.tipoImportacao === 'complementar' && (
                        <p className="resumo-complementar">
                            {importacao?.estatisticas?.transacoesNovas ?? 0} novas, {importacao?.estatisticas?.transacoesJaImportadas ?? 0} já importadas
                            {(importacao?.estatisticas?.totalIgnoradas ?? 0) > 0 && (
                                <span>, {importacao.estatisticas.totalIgnoradas} ignoradas</span>
                            )}
                        </p>
                    )}
                    <div className="status-grid">
                        <div className="status-card validadas">
                            <label>Validadas</label>
                            <span>{importacao?.estatisticas?.transacoesSucesso ?? transacoes.filter(t => t.status === 'validada').length}</span>
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
                        {importacao?.tipoImportacao === 'complementar' && (
                            <div className="status-card ja-importadas">
                                <label>Já Importadas</label>
                                <span>{importacao?.estatisticas?.transacoesJaImportadas ?? 0}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="acoes-principais">
                    {podeDuplicar(importacao) && (
                        <button
                            className="btn-duplicar"
                            onClick={handleDuplicarImportacao}
                            disabled={duplicando}
                            title="Criar uma cópia desta importação com todas as transações"
                        >
                            {duplicando ? (
                                <>
                                    <FaSpinner className="spinner-inline" />
                                    Duplicando...
                                </>
                            ) : (
                                <>
                                    <FaCopy />
                                    Duplicar
                                </>
                            )}
                        </button>
                    )}
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
                    <div className="lista-header-actions">
                        {(importacao?.tipoImportacao === 'complementar' || (importacao?.estatisticas?.totalIgnoradas ?? 0) > 0) && (
                            <div className="abas-transacoes">
                                <button
                                    className={`aba-btn ${abaAtiva === 'novas' ? 'ativa' : ''}`}
                                    onClick={() => handleTrocarAba('novas')}
                                >
                                    {importacao?.tipoImportacao === 'complementar' ? 'Transações Novas' : 'Transações'}
                                </button>
                                {importacao?.tipoImportacao === 'complementar' && (
                                    <button
                                        className={`aba-btn ${abaAtiva === 'ja_importadas' ? 'ativa' : ''}`}
                                        onClick={() => handleTrocarAba('ja_importadas')}
                                    >
                                        Já Importadas
                                    </button>
                                )}
                                {(importacao?.estatisticas?.totalIgnoradas ?? 0) > 0 && (
                                    <button
                                        className={`aba-btn ${abaAtiva === 'ignoradas' ? 'ativa' : ''}`}
                                        onClick={() => handleTrocarAba('ignoradas')}
                                    >
                                        Ignoradas
                                    </button>
                                )}
                            </div>
                        )}
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
                </div>
                {selecionados.size > 0 && podeEditar(importacao) && abaAtiva !== 'ignoradas' && (
                    <div className="barra-acoes-massa">
                        <span className="contador-selecionados">{selecionados.size} selecionada(s)</span>
                        <div className="botoes-acoes-massa">
                            <button
                                className="btn-acao-massa btn-validar"
                                onClick={() => handleAcaoMassa('validar')}
                                disabled={executandoAcaoMassa}
                            >
                                Validar
                            </button>
                            <button
                                className="btn-acao-massa btn-ignorar"
                                onClick={() => handleAcaoMassa('ignorar')}
                                disabled={executandoAcaoMassa}
                                title="Ignorar - não reaparecerão em importações futuras"
                            >
                                Ignorar
                            </button>
                            <button
                                className="btn-acao-massa btn-limpar"
                                onClick={() => setSelecionados(new Set())}
                            >
                                Limpar seleção
                            </button>
                        </div>
                    </div>
                )}
                <table className="transacoes-table">
                    <thead>
                        <tr>
                            {podeEditar(importacao) && abaAtiva !== 'ignoradas' && (
                                <th style={{ width: '40px' }} className="th-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={transacoes.length > 0 && selecionados.size === transacoes.length}
                                        onChange={toggleSelecionarTodas}
                                        title="Selecionar todas"
                                    />
                                </th>
                            )}
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
                                    {podeEditar(importacao) && abaAtiva !== 'ignoradas' && (
                                        <td className="checkbox-cell">
                                            {['pendente', 'revisada', 'erro', 'ja_importada'].includes(transacao.status) && (
                                                <input
                                                    type="checkbox"
                                                    checked={selecionados.has(transacao.id)}
                                                    onChange={() => toggleSelecao(transacao.id)}
                                                />
                                            )}
                                        </td>
                                    )}
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
                                            {transacao.status === 'ja_importada' ? 'Já Importada' : transacao.status.charAt(0).toUpperCase() + transacao.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="acoes-cell">
                                        {podeEditar(importacao) && abaAtiva !== 'ignoradas' && (
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
                                                        title={transacao.status === 'ja_importada' ? 'Validar para forçar duplicação' : 'Validar'}
                                                    >
                                                        {transacao.status === 'ja_importada' ? 'Validar (duplicar)' : 'Validar'}
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleExcluirTransacao(transacao.id)}
                                                    className="btn-acao btn-excluir"
                                                    title="Ignorar - não reaparecerá em importações futuras"
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
                                        <td colSpan={podeEditar(importacao) && abaAtiva !== 'ignoradas' ? 7 : 6}>
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
                            mostrarParcelamentoEmEdicao={true}
                        />
                    </div>
                </div>
            )}

            {modalAtualizarSaldo && (
                <div className="modal" onClick={() => setModalAtualizarSaldo(false)}>
                    <div className="modal-content modal-atualizar-saldo" onClick={e => e.stopPropagation()}>
                        <h3>Atualizar saldo de subconta</h3>
                        <p>Deseja atualizar o saldo de alguma subconta com base nesta importação?</p>
                        <div className="form-group">
                            <label>Subconta</label>
                            <SubcontaSelect
                                subcontas={subcontas}
                                value={saldoSubcontaId}
                                onChange={setSaldoSubcontaId}
                                placeholder="Selecione..."
                                allowEmpty
                            />
                        </div>
                        <div className="form-group">
                            <label>Saldo</label>
                            <input
                                type="number"
                                step="0.01"
                                value={saldoSubcontaValor}
                                onChange={e => setSaldoSubcontaValor(e.target.value)}
                                placeholder="0,00"
                            />
                        </div>
                        <div className="modal-actions">
                            <button onClick={() => setModalAtualizarSaldo(false)}>Não, obrigado</button>
                            <button
                                className="btn-confirmar"
                                onClick={handleConfirmarAtualizarSaldo}
                                disabled={atualizandoSaldo || !saldoSubcontaId || !saldoSubcontaValor}
                            >
                                {atualizandoSaldo ? 'Atualizando...' : 'Atualizar saldo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DetalhesImportacaoPage; 