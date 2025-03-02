import React, { useEffect, useState } from 'react';
import { obterTransacoes, obterCategorias, obterTags } from '../../api.js';
import { exportDataToCSV } from '../../utils/export/exportData';
import { exportDataToPDF } from '../../utils/export/exportDataPdf';
import './Relatorio.css';

const Relatorio = () => {
  // Array achatado com base em pai + pagamentos
  const [allPayments, setAllPayments] = useState([]);
  // Resultado final após filtros
  const [filteredRows, setFilteredRows] = useState([]);

  // Filtros
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('both');
  const [selectedPessoas, setSelectedPessoas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [tags, setTags] = useState([]);
  const [tagFilters, setTagFilters] = useState({});

  // Sumário aprimorado
  const [summaryInfo, setSummaryInfo] = useState({});

  // Formato de exportação
  const [exportFormat, setExportFormat] = useState('csv');

  // Estado para seleção rápida de datas
  const [quickRange, setQuickRange] = useState('');

  // Carregamento inicial
  useEffect(() => {
    async function fetchData() {
      try {
        const transData = await obterTransacoes();
        const transArray = transData.transacoes || [];

        // 1) Achatar cada transacao pai em vários registros
        const flattened = [];
        transArray.forEach((tr) => {
          const paiTags = tr.tags || {};
          // Se não houver pagamentos, criamos um "pagamento" vazio
          if (!tr.pagamentos || tr.pagamentos.length === 0) {
            flattened.push({
              parentId: tr.id,
              dataPai: tr.data,
              tipoPai: tr.tipo,
              descricaoPai: tr.descricao,
              tagsPai: paiTags,
              valorPai: tr.valor,
              // pagamento "vazio"
              pessoa: null,
              valorPagamento: 0,
              tagsPagamento: {}
            });
          } else {
            tr.pagamentos.forEach((p) => {
              flattened.push({
                parentId: tr.id,
                dataPai: tr.data,
                tipoPai: tr.tipo,
                descricaoPai: tr.descricao,
                tagsPai: paiTags,
                valorPai: tr.valor,
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
      }
    }
    fetchData();
  }, []);

  // Função que extrai pessoas únicas de um array achatado
  const distinctPessoas = (rows) => {
    const pessoasSet = new Set();
    rows.forEach(row => {
      if (row.pessoa) {
        pessoasSet.add(row.pessoa);
      }
    });
    return Array.from(pessoasSet);
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
        // Primeiro dia e último dia do mês atual
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case 'MES_ANTERIOR':
        // Primeiro dia e último dia do mês anterior
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

    // Converter para string no formato YYYY-MM-DD
    const toStringDate = (date) => {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    setDataInicio(toStringDate(start));
    setDataFim(toStringDate(end));
  };

  // Filtro principal
  const applyFilters = () => {
    let result = [...allPayments]; // Cópia do array achatado

    // 1) Filtro por data (pai)
    if (dataInicio) {
      result = result.filter(row => new Date(row.dataPai) >= new Date(dataInicio));
    }
    if (dataFim) {
      result = result.filter(row => new Date(row.dataPai) <= new Date(dataFim));
    }

    // 2) Filtro por tipo (pai)
    if (selectedTipo !== 'both') {
      result = result.filter(row => row.tipoPai.toLowerCase() === selectedTipo);
    }

    // 3) Filtro por pessoas (pagamento)
    if (selectedPessoas.length > 0) {
      result = result.filter(row => row.pessoa && selectedPessoas.includes(row.pessoa));
    }

    // 4) Filtro por tags: considerar tags do pai e do pagamento
    Object.keys(tagFilters).forEach(cat => {
      const selectedTags = tagFilters[cat];
      if (selectedTags && selectedTags.length > 0) {
        result = result.filter(row => {
          const paiTags = row.tagsPai[cat] || [];
          const paiMatch = paiTags.some(tag =>
            selectedTags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
          );
          const pagTags = row.tagsPagamento[cat] || [];
          const pagMatch = pagTags.some(tag =>
            selectedTags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
          );
          return (paiMatch || pagMatch);
        });
      }
    });

    setFilteredRows(result);
  };

  // Recalcula o sumário toda vez que filteredRows muda
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

    // Cálculo diferenciado para Gastos e Recebíveis
    const totalGastosNumber = filteredRows
      .filter(row => row.tipoPai?.toLowerCase() === 'gasto')
      .reduce((acc, row) => acc + parseFloat(row.valorPagamento || 0), 0);
    const totalRecebiveisNumber = filteredRows
      .filter(row => row.tipoPai?.toLowerCase() === 'recebivel')
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

  // Exportação
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
    } else if (exportFormat === 'pdf') {
      exportDataToPDF(filteredRows, filterDetails, summaryInfo, 'relatorio.pdf');
    }
  };

  return (
    <div className="relatorio-container">
      <h2 className="relatorio-title">Relatórios</h2>

      <div className="top-section">
        {/* Painel de Filtros */}
        <div className="filter-panel">
          {/* Seleção rápida de datas */}
          <div className="filter-group">
            <label>Seleção Rápida de Datas:</label>
            <select
              value={quickRange}
              onChange={e => {
                const option = e.target.value;
                setQuickRange(option);
                handleQuickDateRange(option);
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
            <label>Data Início (Pai):</label>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Data Fim (Pai):</label>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Pessoas (Pagamento):</label>
            <select
              multiple
              value={selectedPessoas}
              onChange={e => {
                const values = Array.from(e.target.selectedOptions, option => option.value);
                setSelectedPessoas(values);
              }}
            >
              {distinctPessoas(allPayments).map((p, idx) => (
                <option key={idx} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label>Tipo de Transação (Pai):</label>
            <select value={selectedTipo} onChange={e => setSelectedTipo(e.target.value)}>
              <option value="both">Ambos</option>
              <option value="gasto">Gasto</option>
              <option value="recebivel">Recebível</option>
            </select>
          </div>
          {categorias.map(cat => (
            <div key={cat.id} className="filter-group">
              <label>{cat.nome} (Tags):</label>
              <select
                multiple
                value={tagFilters[cat.nome] || []}
                onChange={e => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setTagFilters(prev => ({ ...prev, [cat.nome]: selected }));
                }}
              >
                {(tagsPorCategoria[cat.nome] || []).map(tag => (
                  <option key={tag.id} value={tag.nome}>{tag.nome}</option>
                ))}
              </select>
            </div>
          ))}
          <div className="filter-group">
            <button onClick={applyFilters}>Filtrar</button>
          </div>
          <div className="filter-group">
            <label>Formato:</label>
            <select value={exportFormat} onChange={e => setExportFormat(e.target.value)}>
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button onClick={handleExport}>Exportar</button>
          </div>
        </div>

        {/* Painel de Resumo */}
        <div className="summary-panel">
          <h3>Resumo dos Resultados</h3>

          {/* Nova estrutura dividida em blocos */}
          <div className="summary-sections">

            {/* Bloco 1: informações gerais */}
            <div className="summary-section">
              <h4>Informações Gerais</h4>
              <div className="summary-item">
                <span>Total de “Transações” (Pagamentos):</span>
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
      </div>

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
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const paiTags = row.tagsPai || {};
                const pagTags = row.tagsPagamento || {};

                return (
                  <tr key={idx}>
                    <td>{row.descricaoPai}</td>
                    <td>
                      {new Date(row.dataPai).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </td>
                    <td>{row.pessoa || '—'}</td>
                    <td>R${parseFloat(row.valorPagamento || 0).toFixed(2)}</td>
                    <td>{row.tipoPai}</td>
                    <td>
                      {Object.keys(paiTags).map((catName, i) =>
                        paiTags[catName].map((tagName, j) => (
                          <span key={`pai-${i}-${j}`} className="tag-chip relatorio-tag-chip">
                            [Pai] {catName}: {tagName}
                          </span>
                        ))
                      )}
                      {Object.keys(pagTags).map((catName, i) =>
                        pagTags[catName].map((tagName, j) => (
                          <span key={`pag-${i}-${j}`} className="tag-chip relatorio-tag-chip pag-tag-chip">
                            [Pag] {catName}: {tagName}
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
