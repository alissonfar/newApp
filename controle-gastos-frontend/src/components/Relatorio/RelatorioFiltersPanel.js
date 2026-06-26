// src/components/Relatorio/RelatorioFiltersPanel.js
// Painel de filtros do Relatório (versão expandida).
// Recebe props controladas pelo pai (useRelatorioFilters) e dispara callbacks onChange/onApply.
import React from 'react';
import Select from 'react-select';
import {
  Menu,
  MenuItem,
  Divider
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import IconRenderer from '../shared/IconRenderer';
import Card from '../shared/Card';
import Button from '../shared/Button';
import PeriodQuickFilter from '../shared/PeriodQuickFilter';
import SegmentedControl from '../shared/SegmentedControl';

/**
 * RelatorioFiltersPanel — painel de filtros em 5-6 seções.
 *
 * Todas as props são controladas pelo pai (single source of truth).
 * O painel dispara onChange(novosFiltros) — o pai decide se aplica ou não.
 *
 * @param {object} draftFilters - Filtros em rascunho (sendo editados)
 * @param {Array}  pessoasOptions - [{ value, label }] opções para o select de pessoas
 * @param {object} tagsPorCategoria - { [categoriaId]: { nome, tags: [] } }
 * @param {Array}  reportTemplates - [{ id, name }]
 * @param {string} selectedTemplate - ID do template de relatório selecionado
 * @param {string} quickRange - Identificador do atalho de período ativo (legacy)
 * @param {object} exportAnchorEl - anchorEl do menu de exportação (controlado pelo pai)
 * @param {function} onChange - (newDraftFilters) => void
 * @param {function} onApply - () => void  (botão "Filtrar/Buscar/Ordenar")
 * @param {function} onClear - () => void
 * @param {function} onCreate - () => void
 * @param {function} onExportClick - (event) => void
 * @param {function} onExportClose - () => void
 * @param {function} onExportNow - (format) => void
 * @param {string} exportFormat - 'pdf' | 'csv' (controlado pelo pai)
 */
const RelatorioFiltersPanel = ({
  draftFilters,
  pessoasOptions = [],
  tagsPorCategoria = {},
  reportTemplates = [],
  selectedTemplate = 'simples',
  quickRange = '',
  exportAnchorEl = null,
  onChange,
  onApply,
  onClear,
  onCreate,
  onExportClick,
  onExportClose,
  onExportNow
}) => {
  const safeDraft = draftFilters || {};
  const setTipo = (value) => onChange?.({ ...safeDraft, selectedTipo: value });

  return (
    <Card variant="glass" padding="md" className="relatorio-filtros-card">
      <div className="filter-panel">
        {/* Seção 1: Período */}
        <div className="filter-section">
          <h4>Período</h4>
          <PeriodQuickFilter
            value={quickRange}
            dataInicio={safeDraft.dataInicio}
            dataFim={safeDraft.dataFim}
            onChange={({ dataInicio, dataFim }) =>
              onChange?.({ ...safeDraft, dataInicio, dataFim })
            }
            showDayButtons
            showCustomInputs
          />
        </div>

        {/* Seção 2: Transação */}
        <div className="filter-section">
          <h4>Transação</h4>
          <div className="filter-row">
            <div className="filter-group" style={{ flexBasis: '100%' }}>
              <label>Tipo de Transação:</label>
              <SegmentedControl
                options={[
                  { value: 'both', label: 'Ambos' },
                  { value: 'gasto', label: 'Gastos' },
                  { value: 'recebivel', label: 'Recebíveis' }
                ]}
                value={safeDraft.selectedTipo || 'both'}
                onChange={setTipo}
              />
            </div>
          </div>
          <div className="filter-row">
            <div className="filter-group">
              <label>Pessoas (incluir):</label>
              <Select
                isMulti
                options={pessoasOptions}
                value={(safeDraft.selectedPessoas || []).map(p => ({ value: p, label: p }))}
                onChange={(selectedOptions) => {
                  const values = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                  onChange?.({ ...safeDraft, selectedPessoas: values });
                }}
                classNamePrefix="mySelect"
                placeholder="Selecione pessoas..."
              />
            </div>

            <div className="filter-group">
              <label>Excluir pessoas:</label>
              <Select
                isMulti
                options={pessoasOptions}
                value={(safeDraft.excludePessoas || []).map(p => ({ value: p, label: p }))}
                onChange={(selectedOptions) => {
                  const values = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                  onChange?.({ ...safeDraft, excludePessoas: values });
                }}
                classNamePrefix="mySelect"
                placeholder="Excluir pessoas..."
              />
            </div>
          </div>
        </div>

        {/* Seção 3: Tags de Pagamento */}
        <div className="filter-section">
          <h4>Tags de Pagamento</h4>
          <div className="filter-row">
            {Object.entries(tagsPorCategoria).map(([categoriaId, { nome, tags }]) => (
              <div key={categoriaId} className="filter-group">
                <label>{nome}:</label>
                <Select
                  isMulti
                  options={tags.map(tag => ({
                    value: tag._id,
                    label: tag.nome,
                    cor: tag.cor,
                    icone: tag.icone
                  }))}
                  value={((safeDraft.tagFilters || {})[categoriaId] || []).map(tagId => {
                    const tag = tags.find(t => t._id === tagId);
                    return tag ? {
                      value: tag._id,
                      label: tag.nome,
                      cor: tag.cor,
                      icone: tag.icone
                    } : null;
                  }).filter(Boolean)}
                  onChange={(selectedOptions) => {
                    const selected = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                    onChange?.({
                      ...safeDraft,
                      tagFilters: { ...(safeDraft.tagFilters || {}), [categoriaId]: selected }
                    });
                  }}
                  formatOptionLabel={({ value, label, cor, icone }) => (
                    <span
                      className="tag-chip-like"
                      style={{
                        backgroundColor: `${cor || '#ccc'}20`,
                        color: cor || '#666',
                        border: `1px solid ${cor || '#ccc'}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '14px',
                        fontSize: '0.88rem',
                        fontWeight: 500,
                        margin: '2px',
                        cursor: 'pointer'
                      }}
                    >
                      {icone && <IconRenderer nome={icone} size={14} cor={cor || '#ccc'} />}
                      {label}
                    </span>
                  )}
                  components={{
                    MultiValueLabel: (props) => {
                      const { cor, icone } = props.data;
                      return (
                        <span
                          className="tag-chip-like"
                          style={{
                            backgroundColor: `${cor || '#ccc'}20`,
                            color: cor || '#666',
                            border: `1px solid ${cor || '#ccc'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            margin: '1px 2px'
                          }}
                        >
                          {icone && <IconRenderer nome={icone} size={12} cor={cor || '#ccc'} />}
                          {props.children}
                        </span>
                      );
                    }
                  }}
                  classNamePrefix="mySelect"
                  placeholder="Selecione tags..."
                />
              </div>
            ))}
          </div>
        </div>

        {/* Seção 4: Modelo de Relatório */}
        <div className="filter-section">
          <h4>Modelo de Relatório</h4>
          <div className="filter-row">
            <div className="filter-group">
              <label>Template:</label>
              <select
                value={selectedTemplate}
                onChange={(e) => onChange?.({ ...safeDraft, _selectedTemplateLocal: e.target.value })}
              >
                {reportTemplates.length > 0 ? (
                  reportTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))
                ) : (
                  <>
                    <option value="simples">Relatório Simples</option>
                    <option value="devedor">Relatório de Devedor</option>
                  </>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* Seção 5: Pesquisa & Ordenação */}
        <div className="filter-section">
          <h4>Pesquisa & Ordenação</h4>
          <div className="filter-row">
            <div className="filter-group" style={{ flexBasis: '100%' }}>
              <label>Pesquisar:</label>
              <input
                type="text"
                value={safeDraft.searchTerm || ''}
                onChange={e => onChange?.({ ...safeDraft, searchTerm: e.target.value })}
                placeholder="Buscar descrição ou pessoa..."
              />
            </div>
            <div className="filter-group">
              <label>Ordenar por:</label>
              <select
                value={safeDraft.sortColumn || 'data'}
                onChange={e => onChange?.({ ...safeDraft, sortColumn: e.target.value })}
              >
                <option value="">--Nenhum--</option>
                <option value="data">Data</option>
                <option value="descricao">Descrição</option>
                <option value="pessoa">Pessoa</option>
                <option value="valorPagamento">Valor (Pagamento)</option>
              </select>
              <select
                value={safeDraft.sortDirection || 'desc'}
                onChange={e => onChange?.({ ...safeDraft, sortDirection: e.target.value })}
              >
                <option value="asc">Ascendente</option>
                <option value="desc">Descendente</option>
              </select>
            </div>
          </div>
        </div>

        {/* Seção 6: Botões de Ação */}
        <div className="filter-section filter-actions">
          <Button variant="primary" onClick={onApply}>
            Filtrar/Buscar/Ordenar
          </Button>
          <Button variant="ghost" onClick={onClear}>
            Limpar Filtros
          </Button>
          <Button variant="success" onClick={onCreate} startIcon={<span>+</span>}>
            Nova Transação
          </Button>

          <div className="export-group">
            <Button
              variant="primary"
              onClick={onExportClick}
              startIcon={<DownloadIcon />}
              className="export-button"
            >
              Exportar Relatório
            </Button>
            <Menu
              anchorEl={exportAnchorEl}
              open={Boolean(exportAnchorEl)}
              onClose={onExportClose}
            >
              <MenuItem disabled>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ color: 'var(--cg-color-text-secondary)', fontSize: '14px', fontWeight: 'bold' }}>
                    Escolha o formato
                  </span>
                  <span style={{ color: 'var(--cg-color-text-muted)', fontSize: '11px', fontWeight: 'normal' }}>
                    Template: {reportTemplates.find(t => t.id === selectedTemplate)?.name || (selectedTemplate === 'devedor' ? 'Relatório de Devedor' : 'Relatório Simples')}
                  </span>
                </div>
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => onExportNow?.('pdf')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PdfIcon style={{ color: 'var(--cg-color-error)' }} />
                    <span>Exportar como PDF</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--cg-color-text-secondary)', marginLeft: '32px' }}>
                    {selectedTemplate === 'devedor' ? 'Com regras de débito (Total Bruto, Pago, Devido)' : 'Soma direta de valores'}
                  </span>
                </div>
              </MenuItem>
              <MenuItem onClick={() => onExportNow?.('csv')}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CsvIcon style={{ color: 'var(--cg-color-success)' }} />
                    <span>Exportar como CSV</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--cg-color-text-secondary)', marginLeft: '32px' }}>
                    {selectedTemplate === 'devedor' ? 'Dados com regras aplicadas por tag' : 'Exportação padrão'}
                  </span>
                </div>
              </MenuItem>
            </Menu>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RelatorioFiltersPanel;
