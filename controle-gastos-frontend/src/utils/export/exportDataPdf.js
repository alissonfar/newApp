// src/utils/export/exportDataPdf.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Exporta os dados para um arquivo PDF estruturado, exibindo:
 * - Filtros aplicados em uma tabela
 * - Resumo analítico em outra tabela
 * - Seções de Gastos e Recebíveis em tabelas separadas
 *
 * @param {Array} data - Array de objetos (linhas filtradas) a serem exportados.
 * @param {Object} filterDetails - Detalhes dos filtros aplicados.
 * @param {Object} summaryInfo - Informações analíticas calculadas.
 * @param {string} filename - Nome do arquivo PDF (padrão: 'relatorio.pdf').
 */
export function exportDataToPDF(
  data,
  filterDetails = {},
  summaryInfo = {},
  filename = 'relatorio.pdf'
) {
  if (!data || data.length === 0) {
    console.warn("Nenhum dado para exportar");
    return;
  }

  const doc = new jsPDF();

  // 1) Título do documento
  doc.setFontSize(16);
  doc.text("Relatório de Transações", 14, 20);

  // Data de geração do PDF
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);

  let startY = 36;

  // ---------------------------------------------------
  // 2) Tabela de Filtros Aplicados
  // ---------------------------------------------------
  doc.setFontSize(14);
  doc.text("Filtros Aplicados", 14, startY);
  startY += 6;
  doc.setFontSize(10);

  // Monta o corpo da tabela de filtros (campo/valor)
  const periodoLine = `${filterDetails.dataInicio || '-'} até ${filterDetails.dataFim || '-'}`;
  const tipoLine = filterDetails.selectedTipo || 'both';
  const pessoasLine = (filterDetails.selectedPessoas && filterDetails.selectedPessoas.length > 0)
    ? filterDetails.selectedPessoas.join(', ')
    : 'Nenhuma';

  let tagLine = "Nenhuma";
  if (filterDetails.tagFilters) {
    const tagEntries = Object.entries(filterDetails.tagFilters)
      .filter(([cat, tags]) => tags && tags.length > 0)
      .map(([cat, tags]) => `${cat}: ${tags.join(', ')}`);
    if (tagEntries.length > 0) {
      tagLine = tagEntries.join(' | ');
    }
  }

  const filterTableData = [
    ["Período", periodoLine],
    ["Tipo (Pagamento)", tipoLine],
    ["Pessoas (Pagamento)", pessoasLine],
    ["Tags (Pagamento)", tagLine]
  ];

  autoTable(doc, {
    startY,
    head: [["Campo", "Valor"]],
    body: filterTableData,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185], // cor de fundo do cabeçalho
      textColor: 255,           // cor do texto do cabeçalho (branco)
      fontSize: 10
    },
    bodyStyles: { fontSize: 10 },
    styles: { cellPadding: 3 }
  });

  startY = doc.lastAutoTable.finalY + 10;

  // ---------------------------------------------------
  // 3) Tabela de Resumo Analítico
  // ---------------------------------------------------
  doc.setFontSize(14);
  doc.text("Resumo Analítico", 14, startY);
  startY += 6;
  doc.setFontSize(10);

  const summaryTableData = [
    ["Total de Transações (Pagamentos)", summaryInfo.totalTransactions || 0],
    ["Total em Valor", `R$${summaryInfo.totalValue || '0.00'}`],
    ["Número de Pessoas", summaryInfo.totalPeople || 0],
    ["Média por Pessoa", `R$${summaryInfo.averagePerPerson || '0.00'}`],
    ["Total de Gastos", `R$${summaryInfo.totalGastos || '0.00'}`],
    ["Total de Recebíveis", `R$${summaryInfo.totalRecebiveis || '0.00'}`],
    ["Saldo (Recebíveis - Gastos)", `R$${summaryInfo.netValue || '0.00'}`]
  ];

  autoTable(doc, {
    startY,
    head: [["Indicador", "Valor"]],
    body: summaryTableData,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontSize: 10
    },
    bodyStyles: { fontSize: 10 },
    styles: { cellPadding: 3 }
  });

  startY = doc.lastAutoTable.finalY + 10;

  // ---------------------------------------------------
  // 4) Separa os dados em Gastos e Recebíveis
  // ---------------------------------------------------
  const gastos = data.filter(row => row.tipoPai?.toLowerCase() === 'gasto');
  const recebiveis = data.filter(row => row.tipoPai?.toLowerCase() === 'recebivel');

  // Função auxiliar para adicionar cada seção
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
      startY,
      theme: 'grid',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontSize: 10
      },
      bodyStyles: { fontSize: 10 },
      styles: { cellPadding: 3 }
    });

    startY = doc.lastAutoTable.finalY + 10;
  };

  // 5) Adiciona as seções de Gastos e Recebíveis
  addSection("Gastos", gastos);
  addSection("Recebíveis", recebiveis);

  // 6) Salva o PDF
  doc.save(filename);
}
