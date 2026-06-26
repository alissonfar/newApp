// src/pages/Relatorio/Relatorio.js
// Página de Relatórios — refatorada para usar sub-componentes compartilhados.
// Estrutura:
//   1. SectionHeader com botão de colapso
//   2. RelatorioFiltersPanel (expandido) ou RelatorioFiltersCompact (colapsado)
//   3. RelatorioSummaryPanel
//   4. RelatorioResultsPanel
//   5. ModalTransacao (criar/editar)
import React, { useEffect, useState, useCallback, useContext, useMemo } from 'react';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';
import {
  obterTransacoesPaginadas,
  obterTransacoesExport,
  obterCategorias,
  obterPessoasDistintas,
  obterTransacaoPorId,
  excluirTransacao,
  estornarGrupoPai,
  obterTransacoesPorGrupo,
  gerarRelatorioAvancado,
  listarTemplatesRelatorio
} from '../../api.js';
import { useData } from '../../context/DataContext';
import { AuthContext } from '../../context/AuthContext';
import ModalTransacao from '../../components/Modal/ModalTransacao';
import NovaTransacaoForm from '../../components/Transaction/NovaTransacaoForm';
import { exportDataToCSV } from '../../utils/export/exportData';
import { exportDataToPDF, buildReportFilename } from '../../utils/export/exportPDF';
import { formatDateBR } from '../../utils/dateUtils';
import { useRelatorioFilters } from '../../hooks/useRelatorioFilters';
import SectionHeader from '../../components/shared/SectionHeader';
import Button from '../../components/shared/Button';
import RelatorioFiltersPanel from '../../components/Relatorio/RelatorioFiltersPanel';
import RelatorioFiltersCompact from '../../components/Relatorio/RelatorioFiltersCompact';
import RelatorioSummaryPanel from '../../components/Relatorio/RelatorioSummaryPanel';
import RelatorioResultsPanel from '../../components/Relatorio/RelatorioResultsPanel';
import './Relatorio.css';

const PAGE_SIZE = 50;

function flattenTransactions(transArray) {
  const flattened = [];
  (transArray || []).forEach((tr) => {
    const transacaoId = tr.id || tr._id;
    const baseEmprestimo = {
      esconderNaLista: !!tr.esconderNaLista,
      emprestimoInfo: tr.emprestimoInfo || null
    };
    const baseContaConjunta = tr.contaConjunta?.ativo ? {
      valorTotal: tr.contaConjunta.valorTotal,
      parteUsuario: tr.contaConjunta.parteUsuario,
      pagoPor: tr.contaConjunta.pagoPor,
      vinculo: tr.contaConjunta.vinculoId?.nome || tr.vinculoNome || (tr.contaConjunta.vinculoId?._id || tr.contaConjunta.vinculoId) || ''
    } : {};
    const baseParcelamento = {
      parentTransactionId: tr.parentTransactionId || null,
      isInstallment: tr.isInstallment || false
    };
    if (!tr.pagamentos || tr.pagamentos.length === 0) {
      // TX sem pagamentos: 1 linha, id = id da TX (sem colisão)
      flattened.push({
        id: transacaoId,
        transacaoId,
        pagamentoIndex: null,
        data: tr.data,
        tipo: tr.tipo,
        descricao: tr.descricao,
        valor: tr.valor,
        pessoa: null,
        valorPagamento: 0,
        tagsPagamento: {},
        ...baseContaConjunta,
        ...baseParcelamento,
        ...baseEmprestimo,
        installmentNumber: null,
        installmentTotal: null
      });
    } else {
      // TX com pagamentos: 1 linha POR PAGAMENTO, id único composto
      tr.pagamentos.forEach((p, index) => {
        flattened.push({
          id: `${transacaoId}-${index}`,
          transacaoId,
          pagamentoIndex: index,
          data: tr.data,
          tipo: tr.tipo,
          descricao: tr.descricao,
          valor: tr.valor,
          pessoa: p.pessoa,
          valorPagamento: p.valor,
          tagsPagamento: p.tags || {},
          ...baseContaConjunta,
          ...baseParcelamento,
          ...baseEmprestimo,
          installmentNumber: p.installmentNumber || null,
          installmentTotal: p.installmentTotal || null
        });
      });
    }
  });
  return flattened;
}

const Relatorio = () => {
  const { usuario } = useContext(AuthContext);
  const proprietario = usuario?.preferencias?.proprietario || '';
  const { tags, loadingData: loadingContextData, errorData: errorContextData } = useData();
  const [categorias, setCategorias] = useState([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);
  const [errorCategorias, setErrorCategorias] = useState(null);
  const [pessoasOptions, setPessoasOptions] = useState([]);

  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [errorTransactions, setErrorTransactions] = useState(null);

  const initialFilters = {
    dataInicio: '',
    dataFim: '',
    selectedTipo: 'both',
    selectedPessoas: [],
    excludePessoas: [],
    tagFilters: {},
    searchTerm: '',
    sortColumn: 'data',
    sortDirection: 'desc'
  };

  // Hook de filtros (inclui estado de colapso persistido)
  const filters = useRelatorioFilters(initialFilters);

  // === Sort local (client-side, instantâneo) ===
  // Não vai pro backend: TanStack Table reordena as rows na página atual sem chamada de API.
  // 1º clique: desc, 2º clique: asc, 3º clique: volta ao default (data/desc).
  const [sortColumn, setSortColumn] = useState('data');
  const [sortDirection, setSortDirection] = useState('desc');

  const [selectedTemplate, setSelectedTemplate] = useState('simples');
  const [reportTemplates, setReportTemplates] = useState([]);

  const [summaryInfo, setSummaryInfo] = useState({
    totalTransactions: 0,
    totalValue: '0.00',
    totalPeople: 0,
    averagePerPerson: '0.00',
    totalGastos: '0.00',
    totalRecebiveis: '0.00',
    netValue: '0.00'
  });

  const [exportFormat, setExportFormat] = useState('pdf');
  const [quickRange, setQuickRange] = useState('');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filteredRows, setFilteredRows] = useState([]);

  const [exportAnchorEl, setExportAnchorEl] = useState(null);

  const [editingTransacao, setEditingTransacao] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [, setIsCreate] = useState(false);

  // === Estados do Results Panel (busca interna, agrupar por, seleção) ===
  const [groupBy, setGroupBy] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());

  // === Effects: carga inicial ===
  useEffect(() => {
    async function loadCategorias() {
      try {
        const cats = await obterCategorias(true);
        setCategorias(cats);
        const initTagFilters = {};
        cats.forEach(cat => { initTagFilters[cat._id] = []; });
        // Inicializa tagFilters com shape correto na primeira carga
        filters.onChange({
          ...initialFilters,
          tagFilters: initTagFilters
        });
      } catch (e) {
        setErrorCategorias(e);
      } finally {
        setLoadingCategorias(false);
      }
    }
    loadCategorias();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadPessoas() {
      try {
        const pessoas = await obterPessoasDistintas();
        setPessoasOptions(pessoas.map(p => ({ value: p, label: p })));
      } catch (e) {
        console.warn('Erro ao carregar pessoas:', e);
      }
    }
    loadPessoas();
  }, []);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const templates = await listarTemplatesRelatorio();
        setReportTemplates(templates);
      } catch (e) {
        console.warn('Erro ao carregar templates de relatório:', e);
      }
    }
    loadTemplates();
  }, []);

  // === Lógica de fetch ===
  const buildTagsFilterFromObj = useCallback((tagFiltersObj) => {
    const filter = {};
    Object.entries(tagFiltersObj || {}).forEach(([catId, tagIds]) => {
      if (Array.isArray(tagIds) && tagIds.length > 0) {
        filter[catId] = tagIds;
      }
    });
    return filter;
  }, []);

  const fetchData = useCallback(async (pageNum = 1, filtersToApply) => {
    const f = filtersToApply ?? filters.appliedFilters ?? filters.draftFilters;
    if (!f) return;

    setLoadingTransactions(true);
    setErrorTransactions(null);
    try {
      const tagsFilterObj = buildTagsFilterFromObj(f.tagFilters);
      const pessoas = f.selectedPessoas || [];
      const params = {
        page: pageNum,
        limit: PAGE_SIZE,
        dataInicio: f.dataInicio || undefined,
        dataFim: f.dataFim || undefined,
        tipo: f.selectedTipo !== 'both' ? f.selectedTipo : undefined,
        pessoas: pessoas?.length ? pessoas : undefined,
        excludePessoas: (f.excludePessoas || [])?.length ? f.excludePessoas : undefined,
        tagsFilter: Object.keys(tagsFilterObj).length ? tagsFilterObj : undefined,
        search: (f.searchTerm || '').trim() || undefined,
        sortBy: f.sortColumn || 'data',
        sortDir: f.sortDirection || 'desc'
      };
      const res = await obterTransacoesPaginadas(params);
      let flattened = flattenTransactions(res.data);
      flattened = flattened.filter(row => !row.esconderNaLista);
      if (pessoas?.length > 0) {
        const pessoasList = pessoas.map(p => (typeof p === 'object' && p?.value != null) ? p.value : p);
        flattened = flattened.filter(row =>
          row.pessoa && pessoasList.some(p =>
            String(p).toLowerCase() === String(row.pessoa).toLowerCase()
          )
        );
      }
      setFilteredRows(flattened);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
      setTotal(res.total || 0);
      if (res.summary) {
        const peopleCount = res.summary.totalPeople ?? 0;
        const avg = peopleCount > 0 ? (parseFloat(res.summary.totalValue || 0) / peopleCount).toFixed(2) : '0.00';
        setSummaryInfo({
          totalTransactions: res.summary.totalRows ?? 0,
          totalValue: res.summary.totalValue ?? '0.00',
          totalPeople: peopleCount,
          averagePerPerson: avg,
          totalGastos: res.summary.totalGastos ?? '0.00',
          totalRecebiveis: res.summary.totalRecebiveis ?? '0.00',
          netValue: res.summary.netValue ?? '0.00'
        });
      }
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
      toast.error('Erro ao carregar transações para relatório.');
      setErrorTransactions(error);
    } finally {
      setLoadingTransactions(false);
    }
  }, [filters.appliedFilters, filters.draftFilters, buildTagsFilterFromObj]);

  // Agrupa as tags por categoria (para exibir nos filtros)
  const tagsPorCategoria = useMemo(() => {
    return tags.reduce((acc, tag) => {
      if (!tag.categoria) return acc;
      const categoriaId = typeof tag.categoria === 'object' ? tag.categoria._id : tag.categoria;
      const categoria = categorias.find(c => c._id === categoriaId);
      if (categoria) {
        if (!acc[categoria._id]) {
          acc[categoria._id] = {
            nome: categoria.nome,
            tags: []
          };
        }
        acc[categoria._id].tags.push(tag);
      }
      return acc;
    }, {});
  }, [tags, categorias]);

  // === Ações de filtros ===
  const applyFilters = () => {
    const applied = filters.apply();
    setPage(1);
    fetchData(1, applied);
  };

  const handleClearFilters = () => {
    // Preserva shape de tagFilters (chave por categoria)
    const resetTagFilters = {};
    categorias.forEach(cat => { resetTagFilters[cat._id] = []; });
    const reset = {
      ...initialFilters,
      tagFilters: resetTagFilters
    };
    filters.onChange(reset);
    filters.clear();
    setQuickRange('');
    setPage(1);
    setFilteredRows([]);
    setTotal(0);
    setTotalPages(1);
    setSummaryInfo({
      totalTransactions: 0,
      totalValue: '0.00',
      totalPeople: 0,
      averagePerPerson: '0.00',
      totalGastos: '0.00',
      totalRecebiveis: '0.00',
      netValue: '0.00'
    });
  };

  // === Exportação ===
  const handleExport = async () => {
    try {
      const f = filters.appliedFilters ?? filters.draftFilters;
      const exportFilters = {
        dataInicio: f.dataInicio || undefined,
        dataFim: f.dataFim || undefined,
        tipo: f.selectedTipo !== 'both' ? f.selectedTipo : undefined,
        pessoas: (f.selectedPessoas || []).length ? f.selectedPessoas : undefined,
        excludePessoas: (f.excludePessoas || []).length ? f.excludePessoas : undefined,
        tagsFilter: buildTagsFilterFromObj(f.tagFilters),
        search: (f.searchTerm || '').trim() || undefined,
        sortBy: sortColumn || 'data',
        sortDir: sortDirection || 'desc'
      };

      let normalizedRows;
      let filterDetails;
      let exportSummary;
      let templateUsed = selectedTemplate;

      if (selectedTemplate !== 'simples') {
        const result = await gerarRelatorioAvancado({
          templateId: selectedTemplate,
          filters: exportFilters,
          format: 'json'
        });
        normalizedRows = (result.rows || []).map(row => ({
          ...row,
          tipo: row.tipo?.toLowerCase(),
          data: row.data || row.dataPai,
          descricao: row.descricao || row.descricaoPai,
          valorPagamento: row.valorPagamento ?? row.valor,
          pessoa: row.pessoa || '-',
          tagsPagamento: row.tagsPagamento || {}
        }));
        filterDetails = result.filterDetails || {
          dataInicio: f.dataInicio,
          dataFim: f.dataFim,
          selectedTipo: f.selectedTipo,
          selectedPessoas: f.selectedPessoas,
          pessoas: f.selectedPessoas,
          tipo: f.selectedTipo !== 'both' ? f.selectedTipo : undefined,
          excludePessoas: f.excludePessoas,
          tagFilters: f.tagFilters,
          tagsFilter: buildTagsFilterFromObj(f.tagFilters),
        };
        exportSummary = result.summary || {};
        templateUsed = result.templateUsed || selectedTemplate;
      } else {
        const res = await obterTransacoesExport(exportFilters);
        normalizedRows = flattenTransactions(res.transacoes || []).map(row => ({
          ...row,
          tipo: row.tipo?.toLowerCase(),
          data: row.data || row.dataPai,
          descricao: row.descricao || row.descricaoPai,
          valorPagamento: row.valorPagamento || row.valor,
          pessoa: row.pessoa || '-',
          tagsPagamento: row.tagsPagamento || {}
        }));
        filterDetails = { dataInicio: f.dataInicio, dataFim: f.dataFim, selectedTipo: f.selectedTipo, selectedPessoas: f.selectedPessoas, excludePessoas: f.excludePessoas, tagFilters: f.tagFilters };
        exportSummary = {
          ...summaryInfo,
          totalTransactions: normalizedRows.length,
          totalValue: normalizedRows.reduce((a, r) => a + parseFloat(r.valorPagamento || 0), 0).toFixed(2),
          totalPeople: new Set(normalizedRows.map(r => r.pessoa).filter(Boolean)).size,
          averagePerPerson: (() => {
            const people = new Set(normalizedRows.map(r => r.pessoa).filter(Boolean)).size;
            const total = normalizedRows.reduce((a, r) => a + parseFloat(r.valorPagamento || 0), 0);
            return people > 0 ? (total / people).toFixed(2) : '0.00';
          })(),
          totalGastos: normalizedRows.filter(r => r.tipo === 'gasto').reduce((a, r) => a + parseFloat(r.valorPagamento || 0), 0).toFixed(2),
          totalRecebiveis: normalizedRows.filter(r => r.tipo === 'recebivel').reduce((a, r) => a + parseFloat(r.valorPagamento || 0), 0).toFixed(2),
          netValue: (normalizedRows.filter(r => r.tipo === 'recebivel').reduce((a, r) => a + parseFloat(r.valorPagamento || 0), 0) -
            normalizedRows.filter(r => r.tipo === 'gasto').reduce((a, r) => a + parseFloat(r.valorPagamento || 0), 0)).toFixed(2)
        };
      }

      const filename = buildReportFilename(filterDetails, exportFormat === 'csv' ? 'csv' : 'pdf', categorias, tags);

      if (exportFormat === 'csv') {
        const csvRows = normalizedRows.map((r) => {
          const tagsStr = r.tagsPagamento && typeof r.tagsPagamento === 'object'
            ? Object.values(r.tagsPagamento).flat().filter(Boolean).join(', ')
            : '';
          return {
            Data: r.data,
            Descrição: r.descricao,
            Tipo: r.tipo,
            Status: r.status || '',
            Pessoa: r.pessoa,
            Valor: r.valorPagamento,
            Tags: tagsStr,
            'Valor Total': r.valorTotal ?? '',
            'Parte Usuário': r.parteUsuario ?? '',
            'Pago Por': r.pagoPor ?? '',
            'Vínculo': r.vinculo ?? ''
          };
        });
        exportDataToCSV(
          csvRows,
          filename,
          {
            customHeaders: ['Data', 'Descrição', 'Tipo', 'Status', 'Pessoa', 'Valor', 'Tags', 'Valor Total', 'Parte Usuário', 'Pago Por', 'Vínculo'],
            formatDates: true,
            formatCurrency: true
          }
        );
        toast.success('Relatório exportado como CSV!');
      } else {
        await exportDataToPDF(
          normalizedRows,
          filterDetails,
          exportSummary,
          categorias,
          tags,
          filename,
          templateUsed
        );
        toast.success('Relatório exportado como PDF!');
      }
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar o relatório. Tente novamente.');
    }
  };

  // === Ações de row (edit / delete) ===
  // ATENÇÃO: row.id pode ser composto ("abc123-0") quando a TX tem múltiplos pagamentos.
  // Para operações de TX (editar/excluir), usar row.transacaoId (id da TX pai).
  const handleEdit = async (row) => {
    try {
      const transacao = await obterTransacaoPorId(row.transacaoId);
      setEditingTransacao(transacao);
      setIsCreate(false);
      setModalOpen(true);
    } catch (error) {
      toast.error('Erro ao carregar transação para edição.');
    }
  };

  const handleDelete = async (row) => {
    if (row.parentTransactionId) {
      let htmlLista = '<p style="text-align:left">Buscando transações do grupo...</p>';
      Swal.fire({
        title: 'Esta transação pertence a um grupo',
        html: htmlLista,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sim, estornar o grupo inteiro',
        cancelButtonText: 'Cancelar',
        didOpen: async () => {
          try {
            const grupo = await obterTransacoesPorGrupo(row.parentTransactionId);
            const transacoes = grupo.transacoes || [];
            const totalValor = transacoes.reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);

            if (transacoes.length === 0) {
              htmlLista = '<p style="text-align:left;color:#999">Nenhuma transação ativa encontrada no grupo.</p>';
            } else {
              const linhas = transacoes.map(t => {
                const data = t.data ? formatDateBR(t.data) : '—';
                const pessoas = (t.pagamentos || []).map(p => {
                  const parcela = p.installmentNumber != null ? ` (${p.installmentNumber}/${p.installmentTotal})` : '';
                  return `${p.pessoa || '—'}: R$ ${parseFloat(p.valor || 0).toFixed(2)}${parcela}`;
                }).join('<br>');
                return `<tr>
                  <td style="padding:4px 8px;text-align:left;white-space:nowrap">${data}</td>
                  <td style="padding:4px 8px;text-align:left">${t.descricao || '—'}</td>
                  <td style="padding:4px 8px;text-align:right;white-space:nowrap">R$ ${parseFloat(t.valor || 0).toFixed(2)}</td>
                  <td style="padding:4px 8px;text-align:left;font-size:0.8em">${pessoas}</td>
                </tr>`;
              }).join('');

              htmlLista = `
                <p style="text-align:left;margin-bottom:8px">As seguintes transações serão estornadas:</p>
                <div style="max-height:200px;overflow-y:auto;margin-bottom:8px">
                  <table style="width:100%;border-collapse:collapse;font-size:0.82em">
                    <thead><tr style="background:#f5f5f5">
                      <th style="padding:4px 8px;text-align:left">Data</th>
                      <th style="padding:4px 8px;text-align:left">Descrição</th>
                      <th style="padding:4px 8px;text-align:right">Valor</th>
                      <th style="padding:4px 8px;text-align:left">Pagamentos</th>
                    </tr></thead>
                    <tbody>${linhas}</tbody>
                  </table>
                </div>
                <p style="text-align:left;font-weight:bold">
                  Total: ${transacoes.length} transação${transacoes.length > 1 ? 'ões' : ''}, R$ ${totalValor.toFixed(2)}
                </p>`;
            }

            Swal.getHtmlContainer().innerHTML = htmlLista;
          } catch {
            Swal.getHtmlContainer().innerHTML = '<p style="color:#d33">Erro ao carregar transações do grupo.</p>';
          }
        }
      }).then(async (result) => {
        if (result.isConfirmed) {
          try {
            await estornarGrupoPai(row.parentTransactionId);
            toast.success('Grupo estornado com sucesso!');
            fetchData(page, filters.appliedFilters ?? filters.draftFilters);
          } catch (error) {
            toast.error('Erro ao estornar grupo.');
          }
        }
      });
      return;
    }

    const result = await Swal.fire({
      title: 'Tem certeza que deseja excluir esta transação?',
      text: 'A transação será estornada.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      try {
        await excluirTransacao(row.transacaoId);
        toast.success('Transação excluída com sucesso!');
        fetchData(page, filters.appliedFilters ?? filters.draftFilters);
      } catch (error) {
        toast.error('Erro ao excluir transação.');
      }
    }
  };

  const handleCreate = () => {
    setEditingTransacao(null);
    setIsCreate(true);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingTransacao(null);
    setModalOpen(false);
    setIsCreate(false);
  };

  const handleSuccess = () => {
    fetchData(page, filters.appliedFilters ?? filters.draftFilters);
  };

  const handleExportClick = (event) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportAnchorEl(null);
  };

  const handleExportNow = async (format) => {
    setExportFormat(format);
    await handleExport();
    handleExportClose();
  };

  // === Sort handler: client-side, sem chamada de API ===
  // 1º clique: desc, 2º clique: asc, 3º clique: volta ao default (data/desc).
  // O TanStack Table dentro do DataTable reordena as rows já em memória.
  const handleSortChange = useCallback((column) => {
    if (sortColumn === column) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        // terceira vez: limpa ordenação customizada, volta ao default
        setSortColumn('data');
        setSortDirection('desc');
      }
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  }, [sortColumn, sortDirection]);

  // === Paginação ===
  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchData(newPage, filters.appliedFilters ?? filters.draftFilters);
  };

  // === Adicionar tratamento para loading/erro geral ===
  if (loadingContextData || loadingTransactions || loadingCategorias) {
    return <div className="relatorio-loading">Carregando dados do relatório...</div>;
  }

  if (errorContextData || errorTransactions || errorCategorias) {
    return <div className="relatorio-error">Erro ao carregar dados. {(errorContextData || errorTransactions || errorCategorias)?.message}. Tente recarregar a página.</div>;
  }

  return (
    <div className="cg-relatorio">
      <SectionHeader
        title="Relatórios"
        subtitle="Filtre, visualize e exporte suas transações"
        className="cg-relatorio__header"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={filters.toggleCollapsed}
            icon={filters.collapsed ? <FaChevronDown /> : <FaChevronUp />}
            title={filters.collapsed ? 'Expandir filtros' : 'Recolher filtros'}
            aria-label={filters.collapsed ? 'Expandir filtros' : 'Recolher filtros'}
          >
            {filters.collapsed ? 'Expandir' : 'Recolher'}
          </Button>
        }
      />

      {/* Filtros (expandido OU compacto) */}
      {filters.collapsed ? (
        <RelatorioFiltersCompact
          draftFilters={filters.draftFilters}
          quickRange={quickRange}
          onChange={(newDraft) => {
            // Se draftFilters tem _selectedTemplateLocal, propaga pro state externo
            if (newDraft && newDraft._selectedTemplateLocal) {
              setSelectedTemplate(newDraft._selectedTemplateLocal);
              // Remove a chave "local" antes de gravar nos filtros de verdade
              const { _selectedTemplateLocal, ...rest } = newDraft;
              filters.onChange(rest);
            } else {
              filters.onChange(newDraft);
            }
          }}
          onApply={applyFilters}
          onClear={handleClearFilters}
        />
      ) : (
        <RelatorioFiltersPanel
          draftFilters={filters.draftFilters}
          pessoasOptions={pessoasOptions}
          tagsPorCategoria={tagsPorCategoria}
          reportTemplates={reportTemplates}
          selectedTemplate={selectedTemplate}
          quickRange={quickRange}
          exportAnchorEl={exportAnchorEl}
          onChange={(newDraft) => {
            if (newDraft && newDraft._selectedTemplateLocal) {
              setSelectedTemplate(newDraft._selectedTemplateLocal);
              const { _selectedTemplateLocal, ...rest } = newDraft;
              filters.onChange(rest);
            } else {
              filters.onChange(newDraft);
            }
          }}
          onApply={applyFilters}
          onClear={handleClearFilters}
          onCreate={handleCreate}
          onExportClick={handleExportClick}
          onExportClose={handleExportClose}
          onExportNow={handleExportNow}
        />
      )}

      {/* Painel de Resumo (sempre visível) */}
      <RelatorioSummaryPanel
        summary={summaryInfo}
        className="cg-relatorio__summary"
      />

      {/* Painel de Resultados (grid + bulk + paginação) */}
      <RelatorioResultsPanel
        rows={filteredRows}
        total={total}
        page={page}
        totalPages={totalPages}
        categorias={categorias}
        tags={tags}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        onPageChange={handlePageChange}
        onEdit={handleEdit}
        onDelete={handleDelete}
        hasAppliedFilters={filters.appliedFilters !== null}
      />

      {modalOpen && (
        <ModalTransacao onClose={handleCloseModal}>
          <NovaTransacaoForm
            transacao={editingTransacao}
            onSuccess={handleSuccess}
            onClose={handleCloseModal}
            proprietarioPadrao={proprietario}
          />
        </ModalTransacao>
      )}
    </div>
  );
};

export default Relatorio;
