import React, { useEffect, useState } from 'react';
import { obterTransacoes, obterCategorias, obterTags } from '../../api.js';
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

  // Sumário
  const [summaryInfo, setSummaryInfo] = useState({});

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

        // 2) Armazenamos no estado
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
          // Tags do pai
          const paiTags = row.tagsPai[cat] || [];
          const paiMatch = paiTags.some(tag =>
            selectedTags.map(t => t.toLowerCase()).includes(tag.toLowerCase())
          );

          // Tags do pagamento
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

  // Recalcula sumário toda vez que filteredRows muda
  useEffect(() => {
    // 1) total de "transações" = quantos pagamentos (linhas) foram filtrados
    const totalTransactions = filteredRows.length;

    // 2) soma dos valores = soma de row.valorPagamento
    const totalValueNumber = filteredRows.reduce(
      (acc, row) => acc + parseFloat(row.valorPagamento || 0),
      0
    );
    const totalValue = totalValueNumber.toFixed(2);

    // 3) pessoas distintas
    const people = distinctPessoas(filteredRows);

    // 4) média por pessoa
    const averagePerPerson = people.length > 0
      ? (totalValueNumber / people.length).toFixed(2)
      : '0.00';

    setSummaryInfo({
      totalTransactions,
      totalValue,
      totalPeople: people.length,
      averagePerPerson
    });
  }, [filteredRows]);

  return (
    <div className="relatorio-container">
      <h2 className="relatorio-title">Relatórios</h2>

      <div className="top-section">
        {/* Painel de Filtros */}
        <div className="filter-panel">
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
        </div>

        {/* Painel de Resumo */}
        <div className="summary-panel">
          <h3>Resumo dos Resultados</h3>
          <p><strong>Total de “Transações” (Pagamentos):</strong> {summaryInfo.totalTransactions}</p>
          <p><strong>Total em Valor:</strong> R${summaryInfo.totalValue}</p>
          <p><strong>Número de Pessoas:</strong> {summaryInfo.totalPeople}</p>
          <p><strong>Média por Pessoa:</strong> R${summaryInfo.averagePerPerson}</p>
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
                // Tags do pai
                const paiTags = row.tagsPai || {};
                // Tags do pagamento
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
                      {/* Exibe tags do pai */}
                      {Object.keys(paiTags).map((catName, i) =>
                        paiTags[catName].map((tagName, j) => (
                          <span key={`pai-${i}-${j}`} className="tag-chip relatorio-tag-chip">
                            [Pai] {catName}: {tagName}
                          </span>
                        ))
                      )}
                      {/* Exibe tags do pagamento */}
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
