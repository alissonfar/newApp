// src/components/Relatorio/RelatorioResultsPanel.js
// Painel de resultados do Relatório:
//   - Toolbar (busca, agrupar por)
//   - BulkActionBar (condicional, quando há linhas selecionadas)
//   - DataTable (header sticky, ordenação, seleção, agrupamento)
//   - EmptyState (sem dados / antes do primeiro filtro)
//   - Pagination (componente compartilhado)
import React, { useMemo } from 'react';
import { FaUndo, FaTrash } from 'react-icons/fa';
import { formatDateBR } from '../../utils/dateUtils';
import { formatarMoeda } from '../../utils/format';
import Card, { CardHeader } from '../shared/Card';
import DataTable from '../shared/DataTable';
import EmptyState from '../shared/EmptyState';
import BulkActionBar from '../shared/BulkActionBar';
import Pagination from '../shared/Pagination';
import IconRenderer from '../shared/IconRenderer';
import Button from '../shared/Button';
import EmprestimoBadge from '../Emprestimos/EmprestimoBadge';

/**
 * RelatorioResultsPanel — resultados do relatório.
 *
 * Props:
 *  - rows: Array de linhas planas (já flattenTransactions pelo pai)
 *  - total: total de registros (do backend)
 *  - page: página atual
 *  - totalPages: total de páginas
 *  - categorias, tags: para resolver tags
 *  - selectedIds: Set
 *  - setSelectedIds: (newSet) => void
 *  - groupBy: string | ''
 *  - setGroupBy: (v) => void
 *  - sortColumn, sortDirection, onSortChange
 *  - onPageChange: (page) => void
 *  - onEdit, onDelete
 *  - onBulkEstornar, onBulkDelete (opcional)
 *  - hasAppliedFilters: boolean — se false, mostra empty state "Pronto para começar?"
 */
const RelatorioResultsPanel = ({
  rows = [],
  total = 0,
  page = 1,
  totalPages = 1,
  categorias = [],
  tags = [],
  selectedIds,
  setSelectedIds,
  groupBy = '',
  setGroupBy,
  sortColumn = 'data',
  sortDirection = 'desc',
  onSortChange,
  onPageChange,
  onEdit,
  onDelete,
  onBulkEstornar,
  onBulkDelete,
  hasAppliedFilters = false
}) => {
  // Helper: renderiza valor da célula de uma linha.
  // Memoizado para não recriar a cada render.
  const renderCell = useMemo(() => (row, col) => {
    switch (col.key) {
      case 'descricao':
        return (
          <>
            {row.descricao}
            {row.emprestimoInfo && <EmprestimoBadge emprestimoInfo={row.emprestimoInfo} variant="chip" />}
          </>
        );
      case 'data':
        return formatDateBR(row.data);
      case 'pessoa':
        return row.pessoa || '—';
      case 'valorPagamento':
        return formatarMoeda(row.valorPagamento || 0);
      case 'tipo':
        return (
          <span className={row.tipo?.toLowerCase() === 'gasto' ? 'tipo-gasto' : row.tipo?.toLowerCase() === 'recebivel' ? 'tipo-recebivel' : ''}>
            {row.tipo}
          </span>
        );
      case 'tags':
        return (
          <div className="relatorio-tags-cell">
            {Object.entries(row.tagsPagamento || {}).map(([catId, tagIds], i) => {
              const categoria = categorias.find(c =>
                c._id === catId || c.nome === catId
              );
              if (!categoria) return null;

              return tagIds.map((tagId, j) => {
                const tag = tags.find(t =>
                  t._id === tagId || t.nome === tagId
                );
                if (!tag) return null;

                return (
                  <span
                    key={`${row.id}-${i}-${j}`}
                    className="tag-chip"
                    style={{
                      backgroundColor: `${tag.cor}20`,
                      color: tag.cor,
                      border: `1px solid ${tag.cor}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.85rem'
                    }}
                    title={`${categoria.nome}: ${tag.nome}`}
                  >
                    <IconRenderer nome={tag.icone || 'tag'} size={14} cor={tag.cor} />
                    {`${categoria.nome}: ${tag.nome}`}
                  </span>
                );
              });
            })}
          </div>
        );
      case 'acoes':
        return (
          <div className="relatorio-acoes-cell">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit?.(row)}
              title="Editar"
              aria-label="Editar transação"
            >
              Editar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDelete?.(row)}
              title="Excluir"
              aria-label="Excluir transação"
            >
              Excluir
            </Button>
          </div>
        );
      default:
        return row[col.key];
    }
  }, [categorias, tags, onEdit, onDelete]);

  // Group header — visual padrão, pode ser customizado pelo pai se quiser
  const renderGroupHeader = (groupValue, rowsInGroup) => {
    // Para campo "data" usa formatDateBR para ficar legível
    let display = groupValue;
    if (groupBy === 'data' && groupValue) {
      display = formatDateBR(groupValue);
    } else if (groupBy === 'tipo' && groupValue) {
      display = groupValue === 'gasto' ? 'Gastos' : groupValue === 'recebivel' ? 'Recebíveis' : groupValue;
    }
    return (
      <div className="cg-data-table__group-header">
        <span className="cg-data-table__group-header-label">— {display} —</span>
        <span className="cg-data-table__group-header-count">({rowsInGroup.length})</span>
      </div>
    );
  };

  // Colunas — order importa: select (40px) é adicionada automaticamente via selectable
  const columns = [
    { key: 'descricao', label: 'Descrição' },
    { key: 'data', label: 'Data', width: 110 },
    { key: 'pessoa', label: 'Pessoa (Pagamento)', width: 150 },
    { key: 'valorPagamento', label: 'Valor (Pagamento)', align: 'right', width: 140, meta: { type: 'currency' } },
    { key: 'tipo', label: 'Tipo', width: 120 },
    { key: 'tags', label: 'Tags (Pagamento)' },
    { key: 'acoes', label: 'Ações', width: 180 }
  ];

  const selectedCount = selectedIds ? (selectedIds instanceof Set ? selectedIds.size : selectedIds.length) : 0;

  // Soma das linhas selecionadas (soma do valorPagamento)
  // Aparece no BulkActionBar como pílula "Valor: R$ X em N selecionadas"
  const selectedSummary = useMemo(() => {
    if (!selectedIds || selectedCount === 0) return null;
    const total = rows
      .filter((row) => {
        const id = row.id || row._id;
        return selectedIds instanceof Set ? selectedIds.has(id) : selectedIds.includes(id);
      })
      .reduce((acc, row) => acc + (parseFloat(row.valorPagamento) || 0), 0);
    return { valor: total };
  }, [rows, selectedIds, selectedCount]);

  const bulkActions = [];
  if (onBulkEstornar) {
    bulkActions.push({
      label: 'Estornar grupo',
      icon: <FaUndo />,
      onClick: onBulkEstornar,
      variant: 'danger'
    });
  }
  if (onBulkDelete) {
    bulkActions.push({
      label: 'Excluir selecionadas',
      icon: <FaTrash />,
      onClick: onBulkDelete,
      variant: 'danger'
    });
  }

  return (
    <Card variant="glass" padding="md" className="relatorio-results-card">
      <CardHeader>
        <h3 className="relatorio-results-card__title">
          Resultados <span className="relatorio-results-card__count">({rows.length} desta página, {total} no total)</span>
        </h3>
      </CardHeader>

      {/* Toolbar: busca + agrupar por */}
      <div className="relatorio-results-card__toolbar">
        <div className="relatorio-results-card__group">
          <label htmlFor="relatorio-groupby" className="relatorio-results-card__group-label">Agrupar por:</label>
          <select
            id="relatorio-groupby"
            className="relatorio-results-card__group-select"
            value={groupBy || ''}
            onChange={(e) => setGroupBy?.(e.target.value || null)}
          >
            <option value="">Nenhum</option>
            <option value="data">Data</option>
            <option value="pessoa">Pessoa</option>
            <option value="categoria">Categoria</option>
            <option value="tipo">Tipo</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar (condicional) */}
      {selectedCount > 0 && (
        <BulkActionBar
          selectedCount={selectedCount}
          totalCount={rows.length}
          onClearSelection={() => setSelectedIds?.(new Set())}
          onSelectAll={() => {
            const newSet = new Set(rows.map(r => r.id || r._id));
            setSelectedIds?.(newSet);
          }}
          actions={bulkActions}
          selectedSummary={selectedSummary}
          summaryFormatter={(key, value) => ({
            label: 'Valor',
            formatted: formatarMoeda(value)
          })}
        />
      )}

      {/* Grid / Empty state */}
      {rows.length > 0 ? (
        <DataTable
          id="relatorio-tx"
          variant="glass"
          columns={columns}
          rows={rows}
          renderCell={renderCell}
          stickyHeader
          selectable
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={onSortChange}
          groupBy={groupBy || null}
          renderGroupHeader={groupBy ? renderGroupHeader : null}
          clampLines={2}
          showFooter
        />
      ) : hasAppliedFilters ? (
        <EmptyState
          title="Nenhum registro encontrado"
          description="Tente ajustar os filtros ou expandir o período de busca."
        />
      ) : (
        <EmptyState
          title="Pronto para começar?"
          description="Utilize os filtros acima e clique em Filtrar para buscar transações."
        />
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalRecords={total}
          onPageChange={onPageChange}
        />
      )}
    </Card>
  );
};

export default RelatorioResultsPanel;
