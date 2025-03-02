// src/utils/export/exportDataPdf.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Exporta os dados para um arquivo PDF estruturado como um extrato bancário,
 * exibindo os detalhes dos filtros aplicados e um resumo analítico completo.
 *
 * @param {Array} data - Array de objetos (linhas filtradas) a serem exportados.
 * @param {Object} filterDetails - Detalhes dos filtros aplicados.
 *   Exemplo:
 *     {
 *       dataInicio: '2025-01-01',
 *       dataFim: '2025-02-01',
 *       selectedTipo: 'gasto',
 *       selectedPessoas: ['João', 'Maria'],
 *       tagFilters: { "Categoria A": ["Tag1", "Tag2"], "Categoria B": ["Tag3"] }
 *     }
 * @param {Object} summaryInfo - Informações analíticas calculadas.
 *   Exemplo:
 *     {
 *       totalTransactions,
 *       totalValue,
 *       totalPeople,
 *       averagePerPerson,
 *       totalGastos,
 *       totalRecebiveis,
 *       netValue
 *     }
 * @param {string} filename - Nome do arquivo PDF (padrão: 'relatorio.pdf').
 */
export function exportDataToPDF(data, filterDetails = {}, summaryInfo = {}, filename = 'relatorio.pdf') {
  if (!data || data.length === 0) {
    console.warn("Nenhum dado para exportar");
    return;
  }

  const doc = new jsPDF();

  // Título do documento
  doc.setFontSize(16);
  doc.text("Relatório de Transações", 14, 20);

  // Data de geração do PDF
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);

  let startY = 36;

  // Detalhes dos Filtros
  doc.setFontSize(10);
  // Período
  const periodoLine = `Período: ${filterDetails.dataInicio || '-'} até ${filterDetails.dataFim || '-'}`;
  doc.text(periodoLine, 14, startY);
  startY += 6;
  // Tipo de Transação
  const tipoLine = `Tipo: ${filterDetails.selectedTipo || 'both'}`;
  doc.text(tipoLine, 14, startY);
  startY += 6;
  // Pessoas
  const pessoasLine = filterDetails.selectedPessoas && filterDetails.selectedPessoas.length > 0
    ? `Pessoas: ${filterDetails.selectedPessoas.join(', ')}`
    : "Pessoas: Nenhuma";
  doc.text(pessoasLine, 14, startY);
  startY += 6;
  // Tags
  let tagLine = "Tags: Nenhuma";
  if (filterDetails.tagFilters) {
    const tagEntries = Object.entries(filterDetails.tagFilters)
      .filter(([cat, tags]) => tags && tags.length > 0)
      .map(([cat, tags]) => `${cat}: ${tags.join(', ')}`);
    if (tagEntries.length > 0) {
      tagLine = `Tags: ${tagEntries.join(' | ')}`;
    }
  }
  doc.text(tagLine, 14, startY);
  startY += 10;

  // Resumo Analítico
  doc.setFontSize(14);
  doc.text("Resumo Analítico", 14, startY);
  startY += 6;
  doc.setFontSize(10);
  const summaryLines = [
    `Total de Transações (Pagamentos): ${summaryInfo.totalTransactions || 0}`,
    `Total em Valor: R$${summaryInfo.totalValue || '0.00'}`,
    `Número de Pessoas: ${summaryInfo.totalPeople || 0}`,
    `Média por Pessoa: R$${summaryInfo.averagePerPerson || '0.00'}`,
    `Total de Gastos: R$${summaryInfo.totalGastos || '0.00'}`,
    `Total de Recebíveis: R$${summaryInfo.totalRecebiveis || '0.00'}`,
    `Saldo (Recebíveis - Gastos): R$${summaryInfo.netValue || '0.00'}`
  ];
  doc.text(summaryLines, 14, startY);
  startY += summaryLines.length * 6 + 10;

  // Separa os dados em Gastos e Recebíveis
  const gastos = data.filter(row => row.tipoPai?.toLowerCase() === 'gasto');
  const recebiveis = data.filter(row => row.tipoPai?.toLowerCase() === 'recebivel');

  // Função auxiliar para adicionar uma seção com tabela
  const addSection = (titulo, rows) => {
    if (rows.length === 0) return;
    doc.setFontSize(14);
    doc.text(titulo, 14, startY);
    startY += 6;

    const colunas = ["Data", "Descrição", "Pessoa", "Valor"];
    const linhas = rows.map(row => [
      new Date(row.dataPai).toLocaleDateString('pt-BR'),
      row.descricaoPai,
      row.pessoa || '',
      parseFloat(row.valorPagamento).toFixed(2)
    ]);

    autoTable(doc, {
      head: [colunas],
      body: linhas,
      startY: startY,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
      styles: { fontSize: 10 }
    });

    startY = doc.lastAutoTable.finalY + 10;
  };

  addSection("Gastos", gastos);
  addSection("Recebíveis", recebiveis);

  doc.save(filename);
}
