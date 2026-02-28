import React from 'react';
import { FaListUl } from 'react-icons/fa';
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
    setTabAtiva
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
            message="Selecione um recebimento na aba Configuração e configure os filtros."
            icon={<FaListUl size={48} />}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="tab-selecao-wrapper">
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
                    const pessoa = t.pagamentos?.[0]?.pessoa || '-';
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
                            const pagTags = t.pagamentos?.[0]?.tags;
                            if (!pagTags || typeof pagTags !== 'object') return '-';
                            const tagIds = Object.keys(pagTags).filter((k) => pagTags[k]);
                            if (tagIds.length === 0) return '-';
                            return (
                              <span className="tags-cell">
                                {tagIds.map((tagId) => {
                                  const tag = (tags || []).find((tg) => tg._id === tagId);
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
