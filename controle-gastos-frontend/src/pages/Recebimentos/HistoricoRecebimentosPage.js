import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FaHistory, FaSearch, FaTimes } from 'react-icons/fa';
import { Accordion, AccordionSummary, AccordionDetails, CircularProgress } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { listarSettlements, excluirSettlement, obterPessoasDistintas } from '../../api';
import { useData } from '../../context/DataContext';
import TagBadge from './components/TagBadge';
import Button from '../../components/shared/Button';
import EmptyState from '../../components/shared/EmptyState';
import Card, { CardContent } from '../../components/shared/Card';
import PeriodQuickFilter from '../../components/shared/PeriodQuickFilter';
import { formatDateBR } from '../../utils/dateUtils';
import '../../components/shared/Button.css';
import './Recebimentos.css';

const formatarValor = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '0,00' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const FILTROS_VAZIOS = { q: '', pessoa: '', tagId: '', dataInicio: '', dataFim: '' };

const HistoricoRecebimentosPage = () => {
  const { tags } = useData();
  const [settlements, setSettlements] = useState({ items: [], total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [pessoasOptions, setPessoasOptions] = useState([]);
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [draftFiltros, setDraftFiltros] = useState(FILTROS_VAZIOS);
  const debounceRef = useRef(null);

  const getTagCompleta = (tagId) => {
    if (!tagId) return null;
    const id = typeof tagId === 'object' ? tagId._id : tagId;
    const idStr = id ? String(id) : null;
    const tag = (tags || []).find((t) => t._id === id || String(t._id) === idStr);
    return tag || (tagId?.nome ? { nome: tagId.nome, cor: tagId.cor || '#64748b', icone: tagId.icone || 'tag' } : null);
  };

  const carregarSettlements = async (page = 1, filtrosAtivos = filtros) => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (filtrosAtivos.q) params.q = filtrosAtivos.q;
      if (filtrosAtivos.pessoa) params.pessoa = filtrosAtivos.pessoa;
      if (filtrosAtivos.tagId) params.tagId = filtrosAtivos.tagId;
      if (filtrosAtivos.dataInicio) params.dataInicio = filtrosAtivos.dataInicio;
      if (filtrosAtivos.dataFim) params.dataFim = filtrosAtivos.dataFim;
      const resultado = await listarSettlements(params);
      setSettlements(resultado);
    } catch (err) {
      setSettlements({ items: [], total: 0, page: 1, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarSettlements(1, FILTROS_VAZIOS);
    obterPessoasDistintas()
      .then((p) => setPessoasOptions(p || []))
      .catch(() => setPessoasOptions([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarFiltros = (novos) => {
    const merged = { ...filtros, ...novos };
    setFiltros(merged);
    carregarSettlements(1, merged);
  };

  const limparFiltros = () => {
    setDraftFiltros(FILTROS_VAZIOS);
    setFiltros(FILTROS_VAZIOS);
    carregarSettlements(1, FILTROS_VAZIOS);
  };

  const handleBuscaChange = (valor) => {
    setDraftFiltros((d) => ({ ...d, q: valor }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      aplicarFiltros({ q: valor });
    }, 300);
  };

  const filtrosAtivos = filtros.q || filtros.pessoa || filtros.tagId || filtros.dataInicio || filtros.dataFim;

  const handleExcluir = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Excluir esta conciliação? Todas as alterações serão revertidas.')) return;
    try {
      await excluirSettlement(id);
      toast.success('Conciliação excluída.');
      carregarSettlements(settlements.page);
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir.');
    }
  };

  const pessoaRecebimento = (s) => {
    const rec = s.receivingTransactionId;
    const pessoas = (rec?.pagamentos || []).map((p) => p?.pessoa).filter(Boolean);
    return pessoas.length > 0 ? pessoas.join(', ') : '-';
  };

  return (
    <div className="recebimentos-historico-page">
      <header className="recebimentos-historico-header">
        <h1>Histórico de Conciliações</h1>
        <Link to="/recebimentos/novo" className="ds-button ds-button--primary ds-button--md" style={{ textDecoration: 'none' }}>
          Nova Conciliação
        </Link>
      </header>

      <div className="recebimentos-historico-content">
        <Card className="historico-filtros-card">
          <CardContent>
            <div className="historico-filtros-grid">
              <div className="filtro-grupo historico-filtro-busca">
                <label>Buscar</label>
                <div className="historico-busca-wrapper">
                  <FaSearch size={14} />
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Descrição do recebimento..."
                    value={draftFiltros.q}
                    onChange={(e) => handleBuscaChange(e.target.value)}
                  />
                  {draftFiltros.q && (
                    <button
                      type="button"
                      onClick={() => handleBuscaChange('')}
                      className="historico-busca-clear"
                      title="Limpar busca"
                    >
                      <FaTimes size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div className="filtro-grupo">
                <label>Pessoa</label>
                <select
                  className="input-field"
                  value={filtros.pessoa}
                  onChange={(e) => aplicarFiltros({ pessoa: e.target.value })}
                >
                  <option value="">Todas</option>
                  {pessoasOptions.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="filtro-grupo">
                <label>Tag</label>
                <select
                  className="input-field"
                  value={filtros.tagId}
                  onChange={(e) => aplicarFiltros({ tagId: e.target.value })}
                >
                  <option value="">Todas</option>
                  {(tags || []).map((t) => (
                    <option key={t._id} value={t._id}>{t.nome}</option>
                  ))}
                </select>
              </div>
              <div className="filtro-grupo filtro-grupo--periodo">
                <label>Período</label>
                <PeriodQuickFilter
                  dataInicio={filtros.dataInicio}
                  dataFim={filtros.dataFim}
                  onChange={(range) => setDraftFiltros((d) => ({ ...d, ...range }))}
                  onPeriodSelect={({ dataInicio, dataFim }) => {
                    if (dataInicio && dataFim) {
                      aplicarFiltros({ dataInicio, dataFim });
                    }
                  }}
                  showCustomInputs={true}
                  compact={true}
                />
              </div>
              {filtrosAtivos && (
                <div className="filtro-grupo filtro-grupo--action">
                  <label>&nbsp;</label>
                  <Button variant="ghost" size="sm" onClick={limparFiltros}>
                    Limpar filtros
                  </Button>
                </div>
              )}
            </div>
            {filtrosAtivos && (
              <div className="historico-filtros-info">
                {settlements.total} conciliação(ões) encontrada(s)
                {filtros.q && <> · busca: <strong>"{filtros.q}"</strong></>}
                {filtros.pessoa && <> · pessoa: <strong>{filtros.pessoa}</strong></>}
                {filtros.tagId && <> · tag: <strong>{(tags || []).find(t => t._id === filtros.tagId)?.nome || filtros.tagId}</strong></>}
              </div>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <div className="historico-loading">
            <CircularProgress />
            <p>Carregando...</p>
          </div>
        ) : settlements.items.length === 0 ? (
          <Card>
            <CardContent>
              <EmptyState
                message={filtrosAtivos ? 'Nenhuma conciliação para os filtros aplicados.' : 'Nenhuma conciliação registrada.'}
                icon={<FaHistory size={48} />}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <div className="historico-accordion-list">
                {settlements.items.map((s) => (
                  <Accordion key={s._id} className="historico-accordion">
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <div className="accordion-summary-content">
                        <span className="accordion-id">#{s._id?.slice(-6)}</span>
                        <span className="accordion-data">{formatDateBR(s.createdAt)}</span>
                        <span className="accordion-pessoa">{pessoaRecebimento(s)}</span>
                        <span className="accordion-valor">
                          R$ {formatarValor(s.receivingTransactionId?.valor)}
                        </span>
                        <span className="accordion-tag">
                          {getTagCompleta(s.tagId) ? <TagBadge tag={getTagCompleta(s.tagId)} size={14} /> : '-'}
                        </span>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={(e) => handleExcluir(s._id, e)}
                          className="btn-excluir-accordion"
                        >
                          Excluir
                        </Button>
                      </div>
                    </AccordionSummary>
                <AccordionDetails>
                  <div className="accordion-details">
                    <div className="detail-row">
                      <span>Valor original:</span>
                      <strong>R$ {formatarValor(s.receivingTransactionId?.valor)}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Valor aplicado:</span>
                      <strong>R$ {formatarValor(s.totalApplied)}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Valor de sobra:</span>
                      <strong>R$ {formatarValor(s.leftoverAmount || 0)}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Tag aplicada:</span>
                      <strong>
                        {getTagCompleta(s.tagId) ? <TagBadge tag={getTagCompleta(s.tagId)} size={14} /> : '-'}
                      </strong>
                    </div>
                    {s.removeTagId && (
                      <div className="detail-row">
                        <span>Tag removida:</span>
                        <strong>
                          {getTagCompleta(s.removeTagId) ? <TagBadge tag={getTagCompleta(s.removeTagId)} size={14} /> : '-'}
                        </strong>
                      </div>
                    )}
                    <div className="transacoes-quitadas">
                      <h4>Transações quitadas</h4>
                      <ul>
                        {(s.appliedTransactions || []).map((at, idx) => (
                          <li key={idx}>
                            {at.transactionId?.descricao || 'N/A'} — R${' '}
                            {formatarValor(at.amountApplied || at.transactionId?.valor)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </AccordionDetails>
                  </Accordion>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {settlements.totalPages > 1 && (
          <div className="paginacao">
            <Button
              variant="ghost"
              disabled={settlements.page <= 1}
              onClick={() => carregarSettlements(settlements.page - 1)}
            >
              Anterior
            </Button>
            <span>
              Página {settlements.page} de {settlements.totalPages}
            </span>
            <Button
              variant="ghost"
              disabled={settlements.page >= settlements.totalPages}
              onClick={() => carregarSettlements(settlements.page + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoricoRecebimentosPage;
