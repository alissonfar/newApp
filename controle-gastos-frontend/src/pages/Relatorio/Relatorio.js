// src/pages/Relatorio/Relatorio.js
import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import { toast } from 'react-toastify';  // [NOVO] para exibir mensagens de erro/aviso/sucesso
import { obterTransacoes, obterCategorias, obterTags } from '../../api.js';
import { exportDataToCSV } from '../../utils/export/exportData';
import { exportDataToPDF } from '../../utils/export/exportDataPdf';
import './Relatorio.css';

const Relatorio = () => {
  // Array achatado com base em pai + pagamentos
  const [allPayments, setAllPayments] = useState([]);
  // Resultado final após filtros/busca/ordenação
  const [filteredRows, setFilteredRows] = useState([]);

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('both');
  const [selectedPessoas, setSelectedPessoas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [tags, setTags] = useState([]);
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

  // 1) Carregamento inicial
  useEffect(() => {
    async function fetchData() {
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

        // Carrega categorias e tags
        const cats = await obterCategorias();
        setCategorias(cats);
        const initTagFilters = {};
        cats.forEach(cat => {
          initTagFilters[cat.nome] = [];
        });
        setTagFilters(initTagFilters);

        const tgs = await obterTags();
        setTags(tgs);

      } catch (error) {
        console.error('Erro ao carregar dados para relatório:', error);
        toast.error('Erro ao carregar dados para relatório.');
      }
    }
    fetchData();
  }, []);

  // Função para extrair pessoas únicas
  const distinctPessoas = (rows) => {
    const setP = new Set();
    rows.forEach(row => {
      if (row.pessoa) setP.add(row.pessoa);
    });
    return Array.from(setP);
  };

  // Agrupa as tags por categoria (para exibir nos filtros)
  const tagsPorCategoria = tags.reduce((acc, tag) => {
    if (tag.categoria) {
      if (!acc[tag.categoria]) {
        acc[tag.categoria] = [];
      }
      acc[tag.categoria].push(tag);
    }
    return acc;
  }, {});

  // Seleção rápida de datas
  const handleQuickDateRange = (option) => {
    const now = new Date();
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
        start = new Date();
        start.setDate(start.getDate() - 60);
        break;
      case 'ULTIMOS_30_DIAS':
        end = now;
        start = new Date();
        start.setDate(start.getDate() - 30);
        break;
      case 'ULTIMOS_15_DIAS':
        end = now;
        start = new Date();
        start.setDate(start.getDate() - 15);
        break;
      case 'ULTIMOS_7_DIAS':
        end = now;
        start = new Date();
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
    Object.keys(tagFilters).forEach(cat => {
      const selectedTags = tagFilters[cat];
      if (selectedTags && selectedTags.length > 0) {
        result = result.filter(row => {
          const pagTags = row.tagsPagamento[cat] || [];
          const pagMatch = pagTags.some(tag =>
            selectedTags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
          );
          return pagMatch;
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
  const handleExport = () => {
    const filterDetails = {
      dataInicio,
      dataFim,
      selectedTipo,
      selectedPessoas,
      tagFilters
    };

    if (exportFormat === 'csv') {
      exportDataToCSV(filteredRows, 'relatorio.csv');
      // Se quiser exibir uma mensagem de sucesso ao exportar:
      // toast.success('Relatório exportado como CSV!');
    } else {
      // Padrão PDF
      exportDataToPDF(filteredRows, filterDetails, summaryInfo, 'relatorio.pdf');
      // Se quiser exibir uma mensagem de sucesso ao exportar:
      // toast.success('Relatório exportado como PDF!');
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
      resetTagFilters[cat.nome] = [];
    });
    setTagFilters(resetTagFilters);

    setQuickRange('');
    setSearchTerm('');
    setSortColumn('');
    setSortDirection('asc');

    // Se quiser já aplicar e mostrar tudo:
    setFilteredRows(allPayments);
  };

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
                <label>Tipo de Transação (Pai):</label>
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
              {categorias.map(cat => (
                <div key={cat.id} className="filter-group">
                  <label>{cat.nome}:</label>
                  {/* Substituído o <select multiple> pelo React-Select */}
                  <Select
                    isMulti
                    options={(tagsPorCategoria[cat.nome] || []).map(tag => ({
                      value: tag.nome,
                      label: tag.nome
                    }))}
                    value={(tagFilters[cat.nome] || []).map(tag => ({ value: tag, label: tag }))}
                    onChange={(selectedOptions) => {
                      const selected = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                      setTagFilters(prev => ({ ...prev, [cat.nome]: selected }));
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
              <label>Formato:</label>
              <select
                value={exportFormat}
                onChange={e => setExportFormat(e.target.value)}
              >
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
              <button onClick={handleExport}>Exportar</button>
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
                <span>{summaryInfo.totalTransactions}</span>
              </div>
              <div className="summary-item">
                <span>Total em Valor:</span>
                <span>R${summaryInfo.totalValue}</span>
              </div>
              <div className="summary-item">
                <span>Número de Pessoas:</span>
                <span>{summaryInfo.totalPeople}</span>
              </div>
              <div className="summary-item">
                <span>Média por Pessoa:</span>
                <span>R${summaryInfo.averagePerPerson}</span>
              </div>
            </div>

            {/* Bloco 2: detalhes financeiros */}
            <div className="summary-section">
              <h4>Detalhes Financeiros</h4>
              <div className="summary-item">
                <span>Total de Gastos:</span>
                <span>R${summaryInfo.totalGastos}</span>
              </div>
              <div className="summary-item">
                <span>Total de Recebíveis:</span>
                <span>R${summaryInfo.totalRecebiveis}</span>
              </div>
              <div className="summary-item">
                <span>Saldo (Recebíveis - Gastos):</span>
                <span>R${summaryInfo.netValue}</span>
              </div>
            </div>
          </div>
        </div>
      </div> {/* fim da top-section */}

      <div className="relatorio-results">
        <h3>Resultados ({filteredRows.length})</h3>
        {filteredRows.length > 0 ? (
          <table className="relatorio-table">
            <thead>
              <tr>
                <th>Descrição (Pai)</th>
                <th>Data (Pai)</th>
                <th>Pessoa (Pagamento)</th>
                <th>Valor (Pagamento)</th>
                <th>Tipo (Pai)</th>
                <th>Tags (Pagamento)</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                // Formatando data manualmente (YYYY-MM-DD -> DD/MM/YYYY)
                const [fullDate] = row.data.split('T');
                const [year, month, day] = fullDate.split('-');
                const displayDate = (year && month && day)
                  ? `${day}/${month}/${year}`
                  : row.data; // fallback

                return (
                  <tr key={idx}>
                    <td>{row.descricao}</td>
                    <td>{displayDate}</td>
                    <td>{row.pessoa || '—'}</td>
                    <td>R${parseFloat(row.valorPagamento || 0).toFixed(2)}</td>
                    <td>{row.tipo}</td>
                    <td>
                      {Object.keys(row.tagsPagamento || {}).map((catName, i) =>
                        row.tagsPagamento[catName].map((tagName, j) => (
                          <span key={`pag-${i}-${j}`} className="tag-chip relatorio-tag-chip pag-tag-chip">
                            {catName}: {tagName}
                          </span>
                        ))
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>Nenhum registro encontrado.</p>
        )}
      </div>
    </div>
  );
};

export default Relatorio;
