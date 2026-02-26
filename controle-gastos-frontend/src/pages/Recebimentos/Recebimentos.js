// src/pages/Recebimentos/Recebimentos.js
import React, { useState, useEffect, useContext } from 'react';
import { toast } from 'react-toastify';
import { AuthContext } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import {
  listarSettlements,
  listarRecebimentosDisponiveis,
  listarPendentes,
  criarSettlement,
  excluirSettlement,
  obterPessoasDistintas
} from '../../api';
import { formatDateBR } from '../../utils/dateUtils';
import './Recebimentos.css';

const Recebimentos = () => {
  const { usuario } = useContext(AuthContext);
  const { tags } = useData();
  const proprietario = usuario?.preferencias?.proprietario || '';

  const [abaAtiva, setAbaAtiva] = useState('nova');
  const [recebimentosDisponiveis, setRecebimentosDisponiveis] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [settlements, setSettlements] = useState({ items: [], total: 0, page: 1, totalPages: 1 });
  const [pessoasOptions, setPessoasOptions] = useState([]);

  const [recebimentoSelecionado, setRecebimentoSelecionado] = useState(null);
  const [tagSelecionada, setTagSelecionada] = useState('');
  const [filtroPessoa, setFiltroPessoa] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [transacoesSelecionadas, setTransacoesSelecionadas] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingPendentes, setLoadingPendentes] = useState(false);
  const [loadingSettlements, setLoadingSettlements] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const carregarRecebimentosDisponiveis = async () => {
    setLoading(true);
    try {
      const filtros = {};
      if (filtroDataInicio) filtros.dataInicio = filtroDataInicio;
      if (filtroDataFim) filtros.dataFim = filtroDataFim;
      const transacoes = await listarRecebimentosDisponiveis(filtros);
      setRecebimentosDisponiveis(transacoes);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar recebimentos.');
      setRecebimentosDisponiveis([]);
    } finally {
      setLoading(false);
    }
  };

  const carregarPendentes = async () => {
    if (!recebimentoSelecionado) return;
    setLoadingPendentes(true);
    try {
      const filtros = {};
      if (filtroPessoa) filtros.pessoa = filtroPessoa;
      if (filtroDataInicio) filtros.dataInicio = filtroDataInicio;
      if (filtroDataFim) filtros.dataFim = filtroDataFim;
      filtros.excludeTransactionId = recebimentoSelecionado._id;
      const transacoes = await listarPendentes(filtros);
      setPendentes(transacoes);
      setTransacoesSelecionadas(new Set());
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar pendentes.');
      setPendentes([]);
    } finally {
      setLoadingPendentes(false);
    }
  };

  const carregarSettlements = async (page = 1) => {
    setLoadingSettlements(true);
    try {
      const resultado = await listarSettlements({ page, limit: 15 });
      setSettlements(resultado);
    } catch (err) {
      toast.error(err.message || 'Erro ao carregar conciliações.');
      setSettlements({ items: [], total: 0, page: 1, totalPages: 1 });
    } finally {
      setLoadingSettlements(false);
    }
  };

  const carregarPessoas = async () => {
    try {
      const pessoas = await obterPessoasDistintas();
      setPessoasOptions(pessoas);
    } catch {
      setPessoasOptions([]);
    }
  };

  useEffect(() => {
    if (abaAtiva === 'nova') {
      carregarRecebimentosDisponiveis();
    } else if (abaAtiva === 'historico') {
      carregarSettlements();
    }
  }, [abaAtiva, filtroDataInicio, filtroDataFim]);

  useEffect(() => {
    if (recebimentoSelecionado) {
      carregarPendentes();
    } else {
      setPendentes([]);
      setTransacoesSelecionadas(new Set());
    }
  }, [recebimentoSelecionado, filtroPessoa, filtroDataInicio, filtroDataFim]);

  useEffect(() => {
    carregarPessoas();
  }, []);

  const toggleSelecao = (id) => {
    setTransacoesSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalSelecionado = pendentes
    .filter(t => transacoesSelecionadas.has(t._id))
    .reduce((s, t) => s + Math.abs(parseFloat(t.valor) || 0), 0);

  const valorRecebimento = recebimentoSelecionado ? Math.abs(parseFloat(recebimentoSelecionado.valor) || 0) : 0;
  const sobra = Math.round((valorRecebimento - totalSelecionado) * 100) / 100;
  const podeConfirmar = recebimentoSelecionado && tagSelecionada && transacoesSelecionadas.size > 0 && totalSelecionado <= valorRecebimento;

  const handleConfirmar = async () => {
    if (!podeConfirmar) return;
    setConfirmando(true);
    try {
      await criarSettlement({
        receivingTransactionId: recebimentoSelecionado._id,
        appliedTransactionIds: Array.from(transacoesSelecionadas),
        tagId: tagSelecionada
      });
      toast.success('Conciliação realizada com sucesso!');
      setRecebimentoSelecionado(null);
      setTagSelecionada('');
      setTransacoesSelecionadas(new Set());
      carregarRecebimentosDisponiveis();
      carregarSettlements();
    } catch (err) {
      toast.error(err.message || 'Erro ao criar conciliação.');
    } finally {
      setConfirmando(false);
    }
  };

  const handleExcluir = async (id) => {
    if (!window.confirm('Excluir esta conciliação? Todas as alterações serão revertidas.')) return;
    try {
      await excluirSettlement(id);
      toast.success('Conciliação excluída.');
      carregarSettlements();
      carregarRecebimentosDisponiveis();
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir.');
    }
  };

  const formatarValor = (v) => {
    const n = parseFloat(v);
    return isNaN(n) ? '0,00' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="recebimentos-page">
      <header className="recebimentos-header">
        <h1>Módulo de Recebimentos</h1>
        <p className="recebimentos-subtitle">Conciliação de Recebíveis — vincule recebimentos às dívidas quitadas</p>
      </header>

      <div className="recebimentos-tabs">
        <button
          className={`tab ${abaAtiva === 'nova' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('nova')}
        >
          Nova Conciliação
        </button>
        <button
          className={`tab ${abaAtiva === 'historico' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('historico')}
        >
          Histórico
        </button>
      </div>

      {abaAtiva === 'nova' && (
        <div className="recebimentos-conteudo">
          <section className="recebimentos-secao">
            <h2>1. Selecione o recebimento</h2>
            <p className="dica">Transações do tipo recebível que ainda não foram conciliadas.</p>
            <div className="filtros-row">
              <input
                type="date"
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
                placeholder="Data início"
              />
              <input
                type="date"
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
                placeholder="Data fim"
              />
              <button onClick={carregarRecebimentosDisponiveis} disabled={loading}>
                {loading ? 'Carregando...' : 'Atualizar'}
              </button>
            </div>
            <div className="lista-recebimentos">
              {loading ? (
                <p>Carregando...</p>
              ) : recebimentosDisponiveis.length === 0 ? (
                <p className="sem-dados">Nenhum recebimento disponível para conciliação.</p>
              ) : (
                recebimentosDisponiveis.map((t) => (
                  <div
                    key={t._id}
                    className={`recebimento-item ${recebimentoSelecionado?._id === t._id ? 'selecionado' : ''}`}
                    onClick={() => setRecebimentoSelecionado(t)}
                  >
                    <span className="recebimento-desc">{t.descricao}</span>
                    <span className="recebimento-data">{formatDateBR(t.data)}</span>
                    <span className="recebimento-valor">R$ {formatarValor(t.valor)}</span>
                  </div>
                ))
              )}
            </div>
          </section>

          {recebimentoSelecionado && (
            <>
              <section className="recebimentos-secao">
                <h2>2. Selecione a tag para aplicar</h2>
                <p className="dica">Tag que será aplicada às transações quitadas (ex: Conta Paga).</p>
                <select
                  value={tagSelecionada}
                  onChange={(e) => setTagSelecionada(e.target.value)}
                  className="tag-select"
                >
                  <option value="">-- Escolha uma tag --</option>
                  {(tags || []).map((tag) => (
                    <option key={tag._id} value={tag._id}>
                      {tag.nome}
                    </option>
                  ))}
                </select>
                {tags?.length === 0 && (
                  <p className="aviso">Configure tags em Gerenciar Tags antes de conciliar.</p>
                )}
              </section>

              <section className="recebimentos-secao">
                <h2>3. Selecione os gastos a quitar</h2>
                <p className="dica">Filtre por pessoa e período. Marque os gastos (dívidas pagas por terceiros) que serão quitados com este recebimento.</p>
                <div className="filtros-row">
                  <select
                    value={filtroPessoa}
                    onChange={(e) => setFiltroPessoa(e.target.value)}
                  >
                    <option value="">Todas as pessoas</option>
                    {pessoasOptions.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="lista-pendentes">
                  {loadingPendentes ? (
                    <p>Carregando gastos pendentes...</p>
                  ) : pendentes.length === 0 ? (
                    <p className="sem-dados">Nenhum gasto pendente para o filtro.</p>
                  ) : (
                    <table className="tabela-pendentes">
                      <thead>
                        <tr>
                          <th></th>
                          <th>Data</th>
                          <th>Descrição</th>
                          <th>Pessoa</th>
                          <th>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendentes.map((t) => {
                          const pessoa = t.pagamentos?.[0]?.pessoa || '-';
                          return (
                            <tr key={t._id}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={transacoesSelecionadas.has(t._id)}
                                  onChange={() => toggleSelecao(t._id)}
                                />
                              </td>
                              <td>{formatDateBR(t.data)}</td>
                              <td>{t.descricao}</td>
                              <td>{pessoa}</td>
                              <td>R$ {formatarValor(t.valor)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              <section className="recebimentos-resumo">
                <h2>4. Resumo e confirmação</h2>
                <div className="resumo-valores">
                  <div className="resumo-item">
                    <span>Valor do recebimento:</span>
                    <strong>R$ {formatarValor(valorRecebimento)}</strong>
                  </div>
                  <div className="resumo-item">
                    <span>Total selecionado:</span>
                    <strong>R$ {formatarValor(totalSelecionado)}</strong>
                  </div>
                  <div className="resumo-item sobra">
                    <span>Sobra (receita real):</span>
                    <strong>R$ {formatarValor(sobra)}</strong>
                  </div>
                </div>
                {sobra > 0 && (
                  <p className="info-sobra">
                    Será criada uma transação de receita real de R$ {formatarValor(sobra)} para {proprietario || 'Titular'}.
                  </p>
                )}
                {totalSelecionado > valorRecebimento && (
                  <p className="erro-total">O total selecionado excede o valor do recebimento. Desmarque algumas transações.</p>
                )}
                <button
                  className="btn-confirmar"
                  onClick={handleConfirmar}
                  disabled={!podeConfirmar || confirmando}
                >
                  {confirmando ? 'Processando...' : 'Confirmar Conciliação'}
                </button>
              </section>
            </>
          )}
        </div>
      )}

      {abaAtiva === 'historico' && (
        <div className="recebimentos-conteudo historico">
          <section className="recebimentos-secao">
            <h2>Conciliações realizadas</h2>
            {loadingSettlements ? (
              <p>Carregando...</p>
            ) : settlements.items.length === 0 ? (
              <p className="sem-dados">Nenhuma conciliação registrada.</p>
            ) : (
              <div className="lista-settlements">
                {settlements.items.map((s) => (
                  <div key={s._id} className="settlement-card">
                    <div className="settlement-header">
                      <span className="settlement-data">{formatDateBR(s.createdAt)}</span>
                      <span className="settlement-tag">{s.tagId?.nome}</span>
                      <button
                        className="btn-excluir"
                        onClick={() => handleExcluir(s._id)}
                        title="Excluir conciliação"
                      >
                        Excluir
                      </button>
                    </div>
                    <div className="settlement-recebimento">
                      Recebimento: {s.receivingTransactionId?.descricao} — R$ {formatarValor(s.receivingTransactionId?.valor)}
                    </div>
                    <div className="settlement-aplicado">
                      {s.appliedTransactions?.length || 0} transação(ões) quitada(s) — Total: R$ {formatarValor(s.totalApplied)}
                    </div>
                    {s.leftoverAmount > 0 && (
                      <div className="settlement-sobra">
                        Sobra: R$ {formatarValor(s.leftoverAmount)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {settlements.totalPages > 1 && (
              <div className="paginacao">
                <button
                  disabled={settlements.page <= 1}
                  onClick={() => carregarSettlements(settlements.page - 1)}
                >
                  Anterior
                </button>
                <span>Página {settlements.page} de {settlements.totalPages}</span>
                <button
                  disabled={settlements.page >= settlements.totalPages}
                  onClick={() => carregarSettlements(settlements.page + 1)}
                >
                  Próxima
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default Recebimentos;
