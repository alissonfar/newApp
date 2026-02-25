// src/pages/Relatorio/Relatorio.js
import React, { useEffect, useState, useCallback, useContext } from 'react';
import Select from 'react-select';
import Swal from 'sweetalert2';
import { toast } from 'react-toastify';
import { obterTransacoesPaginadas, obterTransacoesExport, obterCategorias, obterPessoasDistintas, obterTransacaoPorId, excluirTransacao, gerarRelatorioAvancado, listarTemplatesRelatorio } from '../../api.js';
import { useData } from '../../context/DataContext';
import { AuthContext } from '../../context/AuthContext';
import ModalTransacao from '../../components/Modal/ModalTransacao';
import NovaTransacaoForm from '../../components/Transaction/NovaTransacaoForm';
import { exportDataToCSV } from '../../utils/export/exportData';
import { exportDataToPDF, buildReportFilename } from '../../utils/export/exportPDF';
import IconRenderer from '../../components/shared/IconRenderer';
import './Relatorio.css';
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
import { getCurrentDateBR, formatDateBR } from '../../utils/dateUtils';

const PAGE_SIZE = 50;

function flattenTransactions(transArray) {
  const flattened = [];
  (transArray || []).forEach((tr) => {
    const id = tr.id || tr._id;
    if (!tr.pagamentos || tr.pagamentos.length === 0) {
      flattened.push({
        id,
        data: tr.data,
        tipo: tr.tipo,
        descricao: tr.descricao,
        valor: tr.valor,
        pessoa: null,
        valorPagamento: 0,
        tagsPagamento: {}
      });
    } else {
      tr.pagamentos.forEach((p) => {
        flattened.push({
          id,
          data: tr.data,
          tipo: tr.tipo,
          descricao: tr.descricao,
          valor: tr.valor,
          pessoa: p.pessoa,
          valorPagamento: p.valor,
          tagsPagamento: p.tags || {}
        });
      });
    }
  });
  return flattened;
}

const Relatorio = () => {
  const { usuario } = useContext(AuthContext);
  const proprietario = usuario?.preferencias?.proprietario || '';
  const [filteredRows, setFilteredRows] = useState([]);
  const { tags, loadingData: loadingContextData, errorData: errorContextData } = useData();
  const [categorias, setCategorias] = useState([]);
  const [loadingCategorias, setLoadingCategorias] = useState(true);
  const [errorCategorias, setErrorCategorias] = useState(null);
  const [pessoasOptions, setPessoasOptions] = useState([]);

  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [errorTransactions, setErrorTransactions] = useState(null);

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('both');
  const [selectedPessoas, setSelectedPessoas] = useState([]);
  const [excludePessoas, setExcludePessoas] = useState([]);
  const [tagFilters, setTagFilters] = useState({});
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
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('data');
  const [sortDirection, setSortDirection] = useState('desc');

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [exportAnchorEl, setExportAnchorEl] = useState(null);

  const [editingTransacao, setEditingTransacao] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [, setIsCreate] = useState(false);

  useEffect(() => {
    async function loadCategorias() {
      try {
        const cats = await obterCategorias(true);
        setCategorias(cats);
        const initTagFilters = {};
        cats.forEach(cat => { initTagFilters[cat._id] = []; });
        setTagFilters(prev => Object.keys(prev).length ? prev : initTagFilters);
      } catch (e) {
        setErrorCategorias(e);
      } finally {
        setLoadingCategorias(false);
      }
    }
    loadCategorias();
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

  const buildTagsFilter = useCallback(() => {
    const filter = {};
    Object.entries(tagFilters || {}).forEach(([catId, tagIds]) => {
      if (Array.isArray(tagIds) && tagIds.length > 0) {
        filter[catId] = tagIds;
      }
    });
    return filter;
  }, [tagFilters]);

  const fetchData = useCallback(async (pageNum = 1, override = {}) => {
    setLoadingTransactions(true);
    setErrorTransactions(null);
    try {
      const dInicio = override.dataInicio !== undefined ? override.dataInicio : dataInicio;
      const dFim = override.dataFim !== undefined ? override.dataFim : dataFim;
      const tipo = override.selectedTipo !== undefined ? override.selectedTipo : selectedTipo;
      const pessoas = override.selectedPessoas !== undefined ? override.selectedPessoas : selectedPessoas;
      const excluir = override.excludePessoas !== undefined ? override.excludePessoas : excludePessoas;
      const tagsF = override.tagFilters !== undefined ? override.tagFilters : tagFilters;
      const search = override.searchTerm !== undefined ? override.searchTerm : searchTerm;
      const sortCol = override.sortColumn !== undefined ? override.sortColumn : sortColumn;
      const sortDir = override.sortDirection !== undefined ? override.sortDirection : sortDirection;

      const tagsFilterObj = {};
      Object.entries(tagsF || {}).forEach(([catId, tagIds]) => {
        if (Array.isArray(tagIds) && tagIds.length > 0) tagsFilterObj[catId] = tagIds;
      });

      const params = {
        page: pageNum,
        limit: PAGE_SIZE,
        dataInicio: dInicio || undefined,
        dataFim: dFim || undefined,
        tipo: tipo !== 'both' ? tipo : undefined,
        pessoas: pessoas?.length ? pessoas : undefined,
        excludePessoas: excluir?.length ? excluir : undefined,
        tagsFilter: Object.keys(tagsFilterObj).length ? tagsFilterObj : undefined,
        search: (search || '').trim() || undefined,
        sortBy: sortCol || 'data',
        sortDir: sortDir || 'desc'
      };
      const res = await obterTransacoesPaginadas(params);
      let flattened = flattenTransactions(res.data);
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
  }, [dataInicio, dataFim, selectedTipo, selectedPessoas, excludePessoas, tagFilters, searchTerm, sortColumn, sortDirection]);

  useEffect(() => {
    if (!loadingCategorias) {
      fetchData(1);
    }
  }, [loadingCategorias, fetchData]);

  // Agrupa as tags por categoria (para exibir nos filtros)
  // Esta lógica agora usa `categorias` e `tags` do contexto
  const tagsPorCategoria = React.useMemo(() => {
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
  }, [tags, categorias]); // Recalcula se tags ou categorias mudarem

  // Seleção rápida de datas
  const handleQuickDateRange = (option) => {
    const now = getCurrentDateBR();
    let start, end;

    switch (option) {
      case 'MES_ATUAL':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'MES_ANTERIOR':
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        start = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth(), 1);
        end = new Date(lastMonthDate.getFullYear(), lastMonthDate.getMonth() + 1, 0);
        break;
      case 'ULTIMOS_60_DIAS':
        end = now;
        start = new Date(now);
        start.setDate(start.getDate() - 60);
        break;
      case 'ULTIMOS_30_DIAS':
        end = now;
        start = new Date(now);
        start.setDate(start.getDate() - 30);
        break;
      case 'ULTIMOS_15_DIAS':
        end = now;
        start = new Date(now);
        start.setDate(start.getDate() - 15);
        break;
      case 'ULTIMOS_7_DIAS':
        end = now;
        start = new Date(now);
        start.setDate(start.getDate() - 7);
        break;
      default:
        return;
    }

    const toStringDate = (date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    setDataInicio(toStringDate(start));
    setDataFim(toStringDate(end));
  };

  const applyFilters = () => {
    setPage(1);
    fetchData(1);
  };

  const handleExport = async () => {
    try {
      const filters = {
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        tipo: selectedTipo !== 'both' ? selectedTipo : undefined,
        pessoas: selectedPessoas.length ? selectedPessoas : undefined,
        excludePessoas: excludePessoas.length ? excludePessoas : undefined,
        tagsFilter: buildTagsFilter(),
        search: searchTerm.trim() || undefined,
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
          filters,
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
          dataInicio,
          dataFim,
          selectedTipo,
          selectedPessoas,
          pessoas: selectedPessoas,
          tipo: selectedTipo !== 'both' ? selectedTipo : undefined,
          excludePessoas,
          tagFilters,
          tagsFilter: buildTagsFilter(),
        };
        exportSummary = result.summary || {};
        templateUsed = result.templateUsed || selectedTemplate;
      } else {
        const res = await obterTransacoesExport(filters);
        normalizedRows = flattenTransactions(res.transacoes || []).map(row => ({
          ...row,
          tipo: row.tipo?.toLowerCase(),
          data: row.data || row.dataPai,
          descricao: row.descricao || row.descricaoPai,
          valorPagamento: row.valorPagamento || row.valor,
          pessoa: row.pessoa || '-',
          tagsPagamento: row.tagsPagamento || {}
        }));
        filterDetails = { dataInicio, dataFim, selectedTipo, selectedPessoas, excludePessoas, tagFilters };
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
        exportDataToCSV(
          normalizedRows,
          filename,
          {
            customHeaders: ['Data', 'Descrição', 'Tipo', 'Status', 'Pessoa', 'Valor', 'Tags'],
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

  const handleClearFilters = () => {
    const resetTagFilters = {};
    categorias.forEach(cat => { resetTagFilters[cat._id] = []; });
    setDataInicio('');
    setDataFim('');
    setSelectedTipo('both');
    setSelectedPessoas([]);
    setExcludePessoas([]);
    setTagFilters(resetTagFilters);
    setQuickRange('');
    setSearchTerm('');
    setSortColumn('data');
    setSortDirection('desc');
    setPage(1);
    fetchData(1, {
      dataInicio: '',
      dataFim: '',
      selectedTipo: 'both',
      selectedPessoas: [],
      excludePessoas: [],
      tagFilters: resetTagFilters,
      searchTerm: '',
      sortColumn: 'data',
      sortDirection: 'desc'
    });
  };

  // Funções para o menu de exportação
  const handleEdit = async (row) => {
    try {
      const transacao = await obterTransacaoPorId(row.id);
      setEditingTransacao(transacao);
      setIsCreate(false);
      setModalOpen(true);
    } catch (error) {
      toast.error('Erro ao carregar transação para edição.');
    }
  };

  const handleDelete = async (row) => {
    const result = await Swal.fire({
      title: 'Tem certeza que deseja excluir esta transação?',
      text: 'Esta ação não poderá ser desfeita.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sim, excluir!',
      cancelButtonText: 'Cancelar'
    });
    if (result.isConfirmed) {
      try {
        await excluirTransacao(row.id);
        toast.success('Transação excluída com sucesso!');
        fetchData(page);
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
    handleCloseModal();
    fetchData(page);
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

  // Adicionar tratamento para loading/erro geral
  if (loadingContextData || loadingTransactions || loadingCategorias) {
    return <div className="relatorio-loading">Carregando dados do relatório...</div>; // Mensagem unificada
  }

  if (errorContextData || errorTransactions || errorCategorias) {
    return <div className="relatorio-error">Erro ao carregar dados. {(errorContextData || errorTransactions || errorCategorias)?.message}. Tente recarregar a página.</div>;
  }

  return (
    <div className="relatorio-container">
      <h2 className="relatorio-title">Relatórios</h2>

      <div className="top-section">
        {/* Painel de Filtros (organizado em seções) */}
        <div className="filter-panel">
          {/* Seção 1: Datas */}
          <div className="filter-section">
            <h4>Datas</h4>
            <div className="filter-row">
              <div className="filter-group">
                <label>Seleção de Datas:</label>
                <select
                  value={quickRange}
                  onChange={e => {
                    setQuickRange(e.target.value);
                    handleQuickDateRange(e.target.value);
                  }}
                >
                  <option value="">-- Selecione --</option>
                  <option value="MES_ATUAL">Mês Atual</option>
                  <option value="MES_ANTERIOR">Mês Anterior</option>
                  <option value="ULTIMOS_60_DIAS">Últimos 60 Dias</option>
                  <option value="ULTIMOS_30_DIAS">Últimos 30 Dias</option>
                  <option value="ULTIMOS_15_DIAS">Últimos 15 Dias</option>
                  <option value="ULTIMOS_7_DIAS">Últimos 7 Dias</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Data Início:</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={e => setDataInicio(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label>Data Fim:</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={e => setDataFim(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Transação */}
          <div className="filter-section">
            <h4>Transação</h4>
            <div className="filter-row">
              <div className="filter-group">
                <label>Pessoas (incluir):</label>
                <Select
                  isMulti
                  options={pessoasOptions}
                  value={selectedPessoas.map(p => ({ value: p, label: p }))}
                  onChange={(selectedOptions) => {
                    const values = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                    setSelectedPessoas(values);
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
                  value={excludePessoas.map(p => ({ value: p, label: p }))}
                  onChange={(selectedOptions) => {
                    const values = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                    setExcludePessoas(values);
                  }}
                  classNamePrefix="mySelect"
                  placeholder="Excluir pessoas..."
                />
              </div>

              <div className="filter-group">
                <label>Tipo de Transação:</label>
                <select
                  value={selectedTipo}
                  onChange={e => setSelectedTipo(e.target.value)}
                >
                  <option value="both">Ambos</option>
                  <option value="gasto">Gasto</option>
                  <option value="recebivel">Recebível</option>
                </select>
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
                      value: tag._id,  // Usando ID da tag em vez do nome
                      label: tag.nome,
                      cor: tag.cor,
                      icone: tag.icone
                    }))}
                    value={(tagFilters[categoriaId] || []).map(tagId => {
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
                      setTagFilters(prev => ({ ...prev, [categoriaId]: selected }));
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
                  onChange={e => setSelectedTemplate(e.target.value)}
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
              <div className="filter-group">
                <label>Pesquisar:</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar descrição ou pessoa..."
                />
              </div>
              <div className="filter-group">
                <label>Ordenar por:</label>
                <select
                  value={sortColumn}
                  onChange={e => setSortColumn(e.target.value)}
                >
                  <option value="">--Nenhum--</option>
                  <option value="data">Data</option>
                  <option value="descricao">Descrição</option>
                  <option value="pessoa">Pessoa</option>
                  <option value="valorPagamento">Valor (Pagamento)</option>
                </select>
                <select
                  value={sortDirection}
                  onChange={e => setSortDirection(e.target.value)}
                >
                  <option value="asc">Ascendente</option>
                  <option value="desc">Descendente</option>
                </select>
              </div>
            </div>
          </div>

          {/* Seção 6: Botões (Filtrar, Limpar, Nova Transação e Exportar) */}
          <div className="filter-section filter-actions">
            <button onClick={applyFilters}>Filtrar/Buscar/Ordenar</button>
            <button onClick={handleClearFilters} style={{ marginLeft: '10px' }}>
              Limpar Filtros
            </button>
            <button onClick={handleCreate} style={{ marginLeft: '10px', background: '#4caf50', color: 'white' }}>
              + Nova Transação
            </button>

            <div className="export-group">
              <button 
                className="export-button"
                onClick={handleExportClick}
                style={{
                  background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '8px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)',
                  fontWeight: 'bold'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center' }}>
                  <DownloadIcon style={{ marginRight: '8px' }} />
                  Exportar Relatório
                </span>
              </button>
              <Menu
                anchorEl={exportAnchorEl}
                open={Boolean(exportAnchorEl)}
                onClose={handleExportClose}
              >
                <MenuItem disabled>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ color: '#666', fontSize: '14px', fontWeight: 'bold' }}>
                      Escolha o formato
                    </span>
                    <span style={{ color: '#999', fontSize: '11px', fontWeight: 'normal' }}>
                      Template: {reportTemplates.find(t => t.id === selectedTemplate)?.name || (selectedTemplate === 'devedor' ? 'Relatório de Devedor' : 'Relatório Simples')}
                    </span>
                  </div>
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => handleExportNow('pdf')}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <PdfIcon style={{ color: '#f44336' }} />
                      <span>Exportar como PDF</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#666', marginLeft: '32px' }}>
                      {selectedTemplate === 'devedor' ? 'Com regras de débito (Total Bruto, Pago, Devido)' : 'Soma direta de valores'}
                    </span>
                  </div>
                </MenuItem>
                <MenuItem onClick={() => handleExportNow('csv')}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CsvIcon style={{ color: '#4caf50' }} />
                      <span>Exportar como CSV</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#666', marginLeft: '32px' }}>
                      {selectedTemplate === 'devedor' ? 'Dados com regras aplicadas por tag' : 'Exportação padrão'}
                    </span>
                  </div>
                </MenuItem>
              </Menu>
            </div>
          </div>
        </div> {/* Fim do filter-panel */}

        {/* Painel de Resumo */}
        <div className="summary-panel">
          <h3>Resumo dos Resultados</h3>
          <div className="summary-sections">
            {/* Bloco 1: informações gerais */}
            <div className="summary-section">
              <h4>Informações Gerais</h4>
              <div className="summary-item">
                <span>Total de "Transações" (Pagamentos):</span>
                <span><strong>{summaryInfo.totalTransactions}</strong></span>
              </div>
              <div className="summary-item">
                <span>Total em Valor:</span>
                <span><strong>R${summaryInfo.totalValue}</strong></span>
              </div>
              <div className="summary-item">
                <span>Número de Pessoas:</span>
                <span><strong>{summaryInfo.totalPeople}</strong></span>
              </div>
              <div className="summary-item">
                <span>Média por Pessoa:</span>
                <span><strong>R${summaryInfo.averagePerPerson}</strong></span>
              </div>
            </div>

            {/* Bloco 2: detalhes financeiros */}
            <div className="summary-section">
              <h4>Detalhes Financeiros</h4>
              <div className="summary-item">
                <span>Total de Gastos:</span>
                <strong className="valor-negativo">R${summaryInfo.totalGastos}</strong>
              </div>
              <div className="summary-item">
                <span>Total de Recebíveis:</span>
                <strong className="valor-positivo">R${summaryInfo.totalRecebiveis}</strong>
              </div>
              <div className="summary-item">
                <span>Saldo (Recebíveis - Gastos):</span>
                <strong className={summaryInfo.netValue >= 0 ? 'valor-positivo' : 'valor-negativo'}>
                  R${summaryInfo.netValue}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div> {/* fim da top-section */}

      <div className="relatorio-results">
        <h3>Resultados ({filteredRows.length} desta página, {total} no total)</h3>
        {filteredRows.length > 0 ? (
          <div className="table-container">
            <table className="relatorio-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Data</th>
                  <th>Pessoa (Pagamento)</th>
                  <th>Valor (Pagamento)</th>
                  <th>Tipo</th>
                  <th>Tags (Pagamento)</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => {
                  const displayDate = formatDateBR(row.data);

                  return (
                    <tr key={idx}>
                      <td>{row.descricao}</td>
                      <td>{displayDate}</td>
                      <td>{row.pessoa || '—'}</td>
                      <td>R${parseFloat(row.valorPagamento || 0).toFixed(2)}</td>
                      <td className={row.tipo?.toLowerCase() === 'gasto' ? 'tipo-gasto' : row.tipo?.toLowerCase() === 'recebivel' ? 'tipo-recebivel' : ''}>
                        {row.tipo}
                      </td>
                      <td>
                        {Object.entries(row.tagsPagamento || {}).map(([catId, tagIds], i) => {
                          const categoria = categorias.find(c => 
                            c._id === catId || c.nome === catId
                          );
                          if (!categoria) return null;

                          return tagIds.map((tagId, j) => {
                            // Encontra a tag pelo ID ou nome
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
                                  fontSize: '0.85rem',
                                  margin: '2px',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                <IconRenderer nome={tag.icone || 'tag'} size={14} cor={tag.cor} />
                                {`${categoria.nome}: ${tag.nome}`}
                              </span>
                            );
                          });
                        })}
                      </td>
                      <td>
                        <button onClick={() => handleEdit(row)} title="Editar" style={{ marginRight: '8px', padding: '4px 8px', cursor: 'pointer' }}>✏️ Editar</button>
                        <button onClick={() => handleDelete(row)} title="Excluir" style={{ padding: '4px 8px', cursor: 'pointer', color: '#d33' }}>🗑️ Excluir</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Nenhum registro encontrado.</p>
        )}
        {totalPages > 1 && (
          <div className="relatorio-pagination" style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              disabled={page <= 1}
              onClick={() => { setPage(p => p - 1); fetchData(page - 1); }}
            >
              Anterior
            </button>
            <span>Página {page} de {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => { setPage(p => p + 1); fetchData(page + 1); }}
            >
              Próxima
            </button>
          </div>
        )}
      </div>

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

