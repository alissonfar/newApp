import React from 'react';
import { FaListUl, FaFilter } from 'react-icons/fa';
import { CircularProgress } from '@mui/material';
import { useRecebimentos } from '../context/RecebimentosContext';
import { useData } from '../../../context/DataContext';
import TagBadge from './TagBadge';
import Card, { CardContent } from '../../../components/shared/Card';
import SectionHeader from '../../../components/shared/SectionHeader';
import Button from '../../../components/shared/Button';
import Badge from '../../../components/shared/Badge';
import EmptyState from '../../../components/shared/EmptyState';
import BulkActionBar from '../../../components/shared/BulkActionBar';
import PeriodQuickFilter from '../../../components/shared/PeriodQuickFilter';
import { formatDateBR } from '../../../utils/dateUtils';

const formatarValor = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? '0,00' : n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const TabSelecao = () => {
  const { tags } = useData();
  const {
    recebimentoSelecionado,
    pendentes,
    loadingPendentes,
    transacoesSelecionadasSet,
    toggleSelecao,
    selectAllVisible,
    clearSelection,
    setSelecionadas,
    setTabAtiva,
    draftFiltrosPendentes,
    setDraftFiltrosPendentes,
    applyFiltrosPendentes,
    pessoasOptions,
    hasFiltroPendenteAplicado
  } = useRecebimentos();

  const selectedCount = transacoesSelecionadasSet.size;
  const allVisibleSelected = pendentes.length > 0 && selectedCount === pendentes.length;

  const handleSelectAllHeader = () => {
    if (allVisibleSelected) {
      clearSelection();
    } else {
      selectAllVisible();
    }
  };

  const totalSelecionado = pendentes
    .filter((t) => transacoesSelecionadasSet.has(t._id))
    .reduce((s, t) => s + Math.abs(parseFloat(t.valor) || 0), 0);
  const valorRecebimento = recebimentoSelecionado
    ? Math.abs(parseFloat(recebimentoSelecionado.valor) || 0)
    : 0;
  const diferenca = Math.round((valorRecebimento - totalSelecionado) * 100) / 100;

  let statusVisual = 'neutro';
  let badgeVariant = 'neutral';
  if (Math.abs(diferenca) < 0.01) {
    statusVisual = 'exato';
    badgeVariant = 'success';
  } else if (diferenca > 0) {
    statusVisual = 'falta';
    badgeVariant = 'warning';
  } else {
    statusVisual = 'sobra';
    badgeVariant = 'error';
  }

  if (!recebimentoSelecionado) {
    return (
      <Card>
        <CardContent>
          <EmptyState
            message="Selecione um recebimento na aba Configuração para continuar."
            icon={<FaListUl size={48} />}
          />
        </CardContent>
      </Card>
    );
  }

  const limparFiltrosPendentes = () => {
    setDraftFiltrosPendentes({ pessoa: '', dataInicio: '', dataFim: '' });
    applyFiltrosPendentes({ pessoa: '', dataInicio: '', dataFim: '' });
  };

  // M2 — Sugestão automática de match exato
  const matchesExatos = valorRecebimento > 0
    ? pendentes.filter((t) => Math.abs(Math.abs(parseFloat(t.valor) || 0) - valorRecebimento) < 0.01)
    : [];
  const jaTemSelecao = selectedCount > 0;
  const melhorMatchExato = matchesExatos.length > 0
    ? [...matchesExatos].sort((a, b) => new Date(b.data) - new Date(a.data))[0]
    : null;

  // M6 — Selecionar mais antigas até completar valor (FIFO guloso)
  const somaTodosPendentes = pendentes.reduce((s, t) => s + Math.abs(parseFloat(t.valor) || 0), 0);
  const autoFillDisabled = pendentes.length === 0 || valorRecebimento <= 0 || somaTodosPendentes < valorRecebimento;

  const handleAutoSelecionarMaisAntigas = () => {
    const ordenados = [...pendentes].sort((a, b) => new Date(a.data) - new Date(b.data));
    const ids = [];
    let soma = 0;
    for (const t of ordenados) {
      const v = Math.abs(parseFloat(t.valor) || 0);
      const ultrapassa = soma + v > valorRecebimento + 1; // tolerância de R$ 1
      if (ultrapassa) {
        if (ids.length === 0) {
          ids.push(t._id);
          soma += v;
        }
        break;
      }
      ids.push(t._id);
      soma += v;
      if (Math.abs(soma - valorRecebimento) < 0.01) break;
    }
    setSelecionadas(ids);
  };

  return (
    <div className="tab-selecao-wrapper">
      {melhorMatchExato && !jaTemSelecao && (
        <Card className="tab-selecao-sugestao-card">
          <CardContent>
            <div className="tab-selecao-sugestao">
              <div className="tab-selecao-sugestao-texto">
                <strong>Sugestão detectada:</strong>{' '}
                1 gasto de <strong>R$ {formatarValor(melhorMatchExato.valor)}</strong>
                {matchesExatos.length > 1 && (
                  <> (mais {matchesExatos.length - 1} opção(ões))</>
                )}
                {' '}— <span className="tab-selecao-sugestao-desc">{melhorMatchExato.descricao || 'sem descrição'}</span>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => toggleSelecao(melhorMatchExato._id)}
              >
                Usar sugestão
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card className="tab-selecao-filtros-card">
        <CardContent>
          <div className="tab-selecao-filtros-header">
            <SectionHeader title="Filtros" icon={<FaFilter size={18} />} />
            {(draftFiltrosPendentes?.pessoa || draftFiltrosPendentes?.dataInicio || draftFiltrosPendentes?.dataFim) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={limparFiltrosPendentes}
                title="Limpar todos os filtros"
              >
                Limpar filtros
              </Button>
            )}
          </div>
          <div className="tab-selecao-filtros-campos">
            <div className="filtro-grupo">
              <label>Pessoa</label>
              <select
                className="input-field"
                value={draftFiltrosPendentes?.pessoa || ''}
                onChange={(e) => {
                  setDraftFiltrosPendentes({ pessoa: e.target.value });
                  applyFiltrosPendentes({ pessoa: e.target.value });
                }}
              >
                <option value="">Todas as pessoas</option>
                {pessoasOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="filtro-grupo filtro-grupo--periodo">
              <label>Período</label>
              <PeriodQuickFilter
                dataInicio={draftFiltrosPendentes?.dataInicio || ''}
                dataFim={draftFiltrosPendentes?.dataFim || ''}
                onChange={(range) => setDraftFiltrosPendentes(range)}
                onPeriodSelect={({ dataInicio, dataFim }) => {
                  if (dataInicio && dataFim) {
                    applyFiltrosPendentes({ dataInicio, dataFim });
                  }
                }}
                showCustomInputs={true}
                compact={true}
              />
            </div>
          </div>
          {hasFiltroPendenteAplicado && (
            <div className="tab-selecao-filtros-preview">
              {loadingPendentes ? (
                <div className="tab-loading-inline">
                  <CircularProgress size={16} />
                  <span>Carregando...</span>
                </div>
              ) : (
                <>
                  <span><strong>{pendentes.length}</strong> transação(ões) encontrada(s)</span>
                  <span>·</span>
                  <span>Soma: <strong>R$ {formatarValor(pendentes.reduce((s, t) => s + Math.abs(parseFloat(t.valor) || 0), 0))}</strong></span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="tab-selecao-totais-card">
        <CardContent>
          <div className="tab-selecao-totais">
            <div className="totais-item">
              <span>Total selecionado:</span>
              <strong>R$ {formatarValor(totalSelecionado)}</strong>
            </div>
            <div className={`totais-item diferenca ${statusVisual}`}>
              <span>
                {statusVisual === 'exato' && 'Valor exato'}
                {statusVisual === 'falta' && 'Falta valor'}
                {statusVisual === 'sobra' && 'Sobra valor'}
              </span>
              <Badge variant={badgeVariant}>
                {statusVisual === 'exato' && '✓'}
                {statusVisual === 'falta' && `R$ ${formatarValor(diferenca)}`}
                {statusVisual === 'sobra' && `R$ ${formatarValor(Math.abs(diferenca))}`}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="tab-selecao-card">
        <CardContent>
          <SectionHeader title="Transações pendentes" icon={<FaListUl size={18} />} />
          {pendentes.length > 0 && valorRecebimento > 0 && (
            <div className="tab-selecao-acoes-rapidas">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAutoSelecionarMaisAntigas}
                disabled={autoFillDisabled}
                title={autoFillDisabled
                  ? 'Soma dos pendentes é menor que o recebimento'
                  : 'Seleciona os gastos mais antigos (FIFO) até somar o valor do recebimento'}
              >
                ✨ Selecionar mais antigas até R$ {formatarValor(valorRecebimento)}
              </Button>
            </div>
          )}
          {selectedCount > 0 && (
            <BulkActionBar
              selectedCount={selectedCount}
              totalCount={pendentes.length}
              onClearSelection={clearSelection}
              onSelectAll={selectAllVisible}
              actions={
                statusVisual !== 'sobra' && selectedCount > 0
                  ? [
                      {
                        label: 'Ir para Resumo →',
                        variant: 'primary',
                        size: 'md',
                        onClick: () => setTabAtiva(3)
                      }
                    ]
                  : []
              }
            />
          )}
          <div className="tab-selecao-tabela-wrapper">
            {loadingPendentes ? (
              <div className="tab-loading">
                <CircularProgress size={32} />
                <p>Carregando gastos pendentes...</p>
              </div>
            ) : pendentes.length === 0 ? (
              <EmptyState
                message="Nenhum gasto pendente para o filtro."
                icon={<FaListUl size={48} />}
              />
            ) : (
              <table className="tabela-pendentes">
                <thead>
                  <tr>
                    <th className="tabela-pendentes__th-checkbox">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={handleSelectAllHeader}
                        title={allVisibleSelected ? 'Desmarcar todas' : 'Selecionar todas'}
                      />
                    </th>
                    <th>Valor</th>
                    <th>Data</th>
                    <th>Pessoa</th>
                    <th>Status</th>
                    <th>Tags</th>
                  </tr>
                </thead>
                <tbody>
                  {pendentes.map((t) => {
                    const pessoas = (t.pagamentos || []).map((p) => p?.pessoa).filter(Boolean);
                    const pessoa = pessoas.length > 0 ? pessoas.join(', ') : '-';
                    const isSelected = transacoesSelecionadasSet.has(t._id);
                    return (
                      <tr
                        key={t._id}
                        className={isSelected ? 'tabela-pendentes__row--selected' : ''}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={transacoesSelecionadasSet.has(t._id)}
                            onChange={() => toggleSelecao(t._id)}
                          />
                        </td>
                        <td>R$ {formatarValor(t.valor)}</td>
                        <td>{formatDateBR(t.data)}</td>
                        <td>{pessoa}</td>
                        <td>{t.status || 'ativo'}</td>
                        <td>
                          {(() => {
                            const allTagIds = new Set();
                            (t.pagamentos || []).forEach((pag) => {
                              const pagTags = pag?.tags;
                              if (pagTags && typeof pagTags === 'object') {
                                Object.values(pagTags).forEach((arr) => {
                                  if (Array.isArray(arr)) {
                                    arr.forEach((id) => allTagIds.add(id));
                                  }
                                });
                              }
                            });
                            if (allTagIds.size === 0) return '-';
                            return (
                              <span className="tags-cell">
                                {[...allTagIds].map((tagId) => {
                                  const tag = (tags || []).find((tg) => String(tg._id) === String(tagId));
                                  return tag ? <TagBadge key={tagId} tag={tag} size={12} /> : null;
                                })}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {totalSelecionado > valorRecebimento && (
            <p className="erro-total">O total selecionado excede o valor do recebimento. Desmarque algumas transações.</p>
          )}

          {selectedCount > 0 && statusVisual !== 'sobra' && (
            <Button
              variant="primary"
              size="lg"
              onClick={() => setTabAtiva(3)}
              className="tab-selecao-btn-avancar"
            >
              Ir para Resumo e Confirmação →
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TabSelecao;
