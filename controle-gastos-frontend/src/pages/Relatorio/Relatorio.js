// src/pages/Relatorio/Relatorio.js
import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { toast } from 'react-toastify';  // [NOVO] para exibir mensagens de erro/aviso/sucesso
import { obterTransacoes } from '../../api.js';
import { useData } from '../../context/DataContext';
import { exportDataToCSV } from '../../utils/export/exportData';
import { exportDataToPDF } from '../../utils/export/exportPDF';
import IconRenderer from '../../components/shared/IconRenderer';
import './Relatorio.css';
import { 
  Menu, 
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import { 
  PictureAsPdf as PdfIcon,
  TableChart as CsvIcon,
  Download as DownloadIcon
} from '@mui/icons-material';
import { getCurrentDateBR, formatDateBR } from '../../utils/dateUtils';

const Relatorio = () => {
  // Array achatado com base em pai + pagamentos
  const [allPayments, setAllPayments] = useState([]);
  // Resultado final após filtros/busca/ordenação
  const [filteredRows, setFilteredRows] = useState([]);

  // Obter categorias e tags do Contexto
  const { categorias, tags, loadingData: loadingContextData, errorData: errorContextData } = useData();

  // Estado local para loading das transações
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [errorTransactions, setErrorTransactions] = useState(null);

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('both');
  const [selectedPessoas, setSelectedPessoas] = useState([]);
  const [tagFilters, setTagFilters] = useState({});

  // Sumário
  const [summaryInfo, setSummaryInfo] = useState({});

  // Exportação (AGORA POR PADRÃO PDF)
  const [exportFormat, setExportFormat] = useState('pdf');

  // Seleção rápida de datas
  const [quickRange, setQuickRange] = useState('');

  // Busca e Ordenação
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');

  const [exportAnchorEl, setExportAnchorEl] = useState(null);

  // 1) Carregamento inicial - Agora apenas transações
  useEffect(() => {
    async function fetchTransactions() {
      setLoadingTransactions(true);
      setErrorTransactions(null);
      try {
        const transData = await obterTransacoes();
        const transArray = transData.transacoes || [];

        // Criar registros para cada pagamento
        const flattened = [];
        transArray.forEach((tr) => {
          if (!tr.pagamentos || tr.pagamentos.length === 0) {
            flattened.push({
              id: tr.id,
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
                id: tr.id,
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

        setAllPayments(flattened);

        // REMOVER carregamento de categorias e tags daqui
        /*
        const cats = await obterCategorias();
        setCategorias(cats);
        const initTagFilters = {};
        cats.forEach(cat => {
          initTagFilters[cat.nome] = [];
        });
        setTagFilters(initTagFilters);

        const tgs = await obterTags();
        setTags(tgs);
        */

      } catch (error) {
        console.error('Erro ao carregar transações para relatório:', error);
        toast.error('Erro ao carregar transações para relatório.');
        setErrorTransactions(error);
      } finally {
        setLoadingTransactions(false);
      }
    }
    fetchTransactions();
  }, []); // Dependência vazia, carrega transações uma vez

  // Inicializar filtros de tag quando as categorias carregarem do contexto
  useEffect(() => {
    if (categorias.length > 0) {
      const initTagFilters = {};
      categorias.forEach(cat => {
        // Usar _id da categoria como chave é mais robusto
        initTagFilters[cat._id] = []; 
      });
      setTagFilters(initTagFilters);
    }
  }, [categorias]); // Depende das categorias do contexto

  // Função para extrair pessoas únicas
  const distinctPessoas = (rows) => {
    const setP = new Set();
    rows.forEach(row => {
      if (row.pessoa) setP.add(row.pessoa);
    });
    return Array.from(setP);
  };

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

  // 2) Função principal de FILTRO + BUSCA + ORDENAÇÃO
  const applyFilters = () => {
    let result = [...allPayments];


    // Filtro por data (pai)
    if (dataInicio) {
      result = result.filter(row => {
        const [fullDate] = row.data.split('T');
        return fullDate >= dataInicio;
      });
    }
    if (dataFim) {
      result = result.filter(row => {
        const [fullDate] = row.data.split('T');
        return fullDate <= dataFim;
      });
    }

    // Filtro por tipo
    if (selectedTipo !== 'both') {
      result = result.filter(row => row.tipo.toLowerCase() === selectedTipo);
    }

    // Filtro por pessoas
    if (selectedPessoas.length > 0) {
      result = result.filter(row => row.pessoa && selectedPessoas.includes(row.pessoa));
    }

    // Filtro por tags (pagamento)
    Object.entries(tagFilters).forEach(([categoriaId, selectedTags]) => {


      if (selectedTags && selectedTags.length > 0) {
        result = result.filter(row => {
          // Converte as tags antigas (que usam nome) para o novo formato
          const pagTags = {};
          Object.entries(row.tagsPagamento || {}).forEach(([catName, tagIds]) => {

            // Procura a categoria pelo nome ou ID
            const categoria = categorias.find(c => 
              c.nome === catName || c._id === catName
            );

            if (categoria) {
              // Garante que tagIds seja sempre um array de IDs
              const normalizedTagIds = tagIds.map(tagId => {
                // Se for um nome de tag, encontra o ID correspondente
                if (typeof tagId === 'string' && !tagId.match(/^[0-9a-fA-F]{24}$/)) {
                  const tag = tags.find(t => t.nome === tagId);
                  return tag ? tag._id : tagId;
                }
                return tagId;
              });
              
              pagTags[categoria._id] = normalizedTagIds;
            }
          });

          // Verifica se as tags selecionadas estão presentes
          const pagTagsForCategory = pagTags[categoriaId] || [];
          


          return selectedTags.some(selectedTagId => 
            pagTagsForCategory.includes(selectedTagId)
          );
        });



      }
    });

    // Busca
    if (searchTerm.trim() !== '') {
      const lower = searchTerm.toLowerCase();
      result = result.filter(row => {
        const descMatch = row.descricao?.toLowerCase().includes(lower);
        const pessoaMatch = row.pessoa?.toLowerCase().includes(lower);
        return descMatch || pessoaMatch;
      });
    }

    // Ordenação
    if (sortColumn) {
      result.sort((a, b) => {
        let valA = a[sortColumn];
        let valB = b[sortColumn];

        // Comparar datas
        if (sortColumn === 'data') {
          const [fullA] = (valA || '').split('T');
          const [fullB] = (valB || '').split('T');
          return sortDirection === 'asc'
            ? fullA.localeCompare(fullB)
            : fullB.localeCompare(fullA);
        }
        // Comparar números
        else if (sortColumn === 'valorPagamento') {
          const numA = parseFloat(valA) || 0;
          const numB = parseFloat(valB) || 0;
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }
        // Comparar strings
        else {
          valA = (valA || '').toString().toLowerCase();
          valB = (valB || '').toString().toLowerCase();
          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        }
      });
    }

    setFilteredRows(result);

  };

  // 3) Recalcula o sumário quando filteredRows muda
  useEffect(() => {
    const totalTransactions = filteredRows.length;
    const totalValueNumber = filteredRows.reduce(
      (acc, row) => acc + parseFloat(row.valorPagamento || 0),
      0
    );
    const totalValue = totalValueNumber.toFixed(2);

    const people = distinctPessoas(filteredRows);
    const averagePerPerson = people.length > 0
      ? (totalValueNumber / people.length).toFixed(2)
      : '0.00';

    // Gastos x Recebíveis
    const totalGastosNumber = filteredRows
      .filter(row => row.tipo.toLowerCase() === 'gasto')
      .reduce((acc, row) => acc + parseFloat(row.valorPagamento || 0), 0);
    const totalRecebiveisNumber = filteredRows
      .filter(row => row.tipo.toLowerCase() === 'recebivel')
      .reduce((acc, row) => acc + parseFloat(row.valorPagamento || 0), 0);

    const totalGastos = totalGastosNumber.toFixed(2);
    const totalRecebiveis = totalRecebiveisNumber.toFixed(2);
    const netValue = (totalRecebiveisNumber - totalGastosNumber).toFixed(2);

    setSummaryInfo({
      totalTransactions,
      totalValue,
      totalPeople: people.length,
      averagePerPerson,
      totalGastos,
      totalRecebiveis,
      netValue
    });
  }, [filteredRows]);

  // 4) Exportação
  const handleExport = async () => {
    // Logs para debug


    // Normaliza os dados antes de exportar
    const normalizedRows = filteredRows.map(row => ({
      ...row,
      tipo: row.tipo?.toLowerCase(),
      data: row.data || row.dataPai,
      descricao: row.descricao || row.descricaoPai,
      valorPagamento: row.valorPagamento || row.valor,
      pessoa: row.pessoa || '-',
      tagsPagamento: row.tagsPagamento || {}
    }));

    const filterDetails = {
      dataInicio,
      dataFim,
      selectedTipo,
      selectedPessoas,
      tagFilters
    };

    if (exportFormat === 'csv') {
      exportDataToCSV(
        normalizedRows, 
        'relatorio.csv',
        {
          customHeaders: ['Data', 'Descrição', 'Tipo', 'Status', 'Pessoa', 'Valor', 'Tags'],
          formatDates: true,
          formatCurrency: true
        }
      );
      toast.success('Relatório exportado como CSV!');
    } else {
      // Padrão PDF
      try {
        await exportDataToPDF(
          normalizedRows,
          filterDetails, 
          summaryInfo,
          categorias,
          tags,
          'relatorio.pdf'
        );
        toast.success('Relatório exportado como PDF!');
      } catch (error) {
        console.error('Erro ao exportar PDF:', error);
        toast.error('Erro ao exportar o relatório. Tente novamente.');
      }
    }
  };

  // 5) Limpar Filtros
  const handleClearFilters = () => {
    setDataInicio('');
    setDataFim('');
    setSelectedTipo('both');
    setSelectedPessoas([]);
    // Resetar tags
    const resetTagFilters = {};
    categorias.forEach(cat => {
      resetTagFilters[cat._id] = [];
    });
    setTagFilters(resetTagFilters);

    setQuickRange('');
    setSearchTerm('');
    setSortColumn('');
    setSortDirection('asc');

    // Se quiser já aplicar e mostrar tudo:
    setFilteredRows(allPayments);
  };

  // Funções para o menu de exportação
  const handleExportClick = (event) => {
    setExportAnchorEl(event.currentTarget);
  };

  const handleExportClose = () => {
    setExportAnchorEl(null);
  };

  const handleExportFormat = (format) => {
    setExportFormat(format);
    handleExportClose();
  };

  const handleExportNow = async (format) => {
    setExportFormat(format);
    await handleExport();
    handleExportClose();
  };

  // Adicionar tratamento para loading/erro geral
  if (loadingContextData || loadingTransactions) {
    return <div className="relatorio-loading">Carregando dados do relatório...</div>; // Mensagem unificada
  }

  if (errorContextData || errorTransactions) {
    return <div className="relatorio-error">Erro ao carregar dados. {errorContextData?.message || errorTransactions?.message}. Tente recarregar a página.</div>;
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
                <label>Pessoas (Pagamento):</label>
                {/* Substituído o <select multiple> pelo React-Select */}
                <Select
                  isMulti
                  options={distinctPessoas(allPayments).map(p => ({ value: p, label: p }))}
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
                        const { label, cor, icone } = props.data;
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

          {/* Seção 4: Pesquisa & Ordenação */}
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

          {/* Seção 5: Botões (Filtrar, Limpar e Exportar) */}
          <div className="filter-section filter-actions">
            <button onClick={applyFilters}>Filtrar/Buscar/Ordenar</button>
            <button onClick={handleClearFilters} style={{ marginLeft: '10px' }}>
              Limpar Filtros
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
                  <span style={{ color: '#666', fontSize: '14px', fontWeight: 'bold' }}>
                    Escolha o formato
                  </span>
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => handleExportNow('pdf')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <PdfIcon style={{ color: '#f44336' }} />
                    <span>Exportar como PDF</span>
                  </div>
                </MenuItem>
                <MenuItem onClick={() => handleExportNow('csv')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CsvIcon style={{ color: '#4caf50' }} />
                    <span>Exportar como CSV</span>
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
        <h3>Resultados ({filteredRows.length})</h3>
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Nenhum registro encontrado.</p>
        )}
      </div>
    </div>
  );
};

export default Relatorio;

