// src/utils/export/exportDataPdf.js
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Converte a string de data (no formato ISO ou YYYY-MM-DD) para DD/MM/YYYY.
 * Exemplo de input: "2025-02-02T00:00:00.000Z" ou "2025-02-02".
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  // Se for um ISO com "T", pegamos apenas a parte antes do "T"
  const [fullDate] = dateStr.split('T'); // ex.: "2025-02-02T00:00:00.000Z" -> "2025-02-02"
  // Agora fullDate deve ser algo como "2025-02-02"
  const [year, month, day] = fullDate.split('-');
  if (!year || !month || !day) return dateStr; // fallback, se algo estiver estranho
  return `${day}/${month}/${year}`;
}

/**
 * Formata um valor numérico para o formato de moeda brasileira
 */
function formatCurrency(value) {
  if (value === undefined || value === null) return 'R$ 0,00';
  
  // Converte para número se for string
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // Formata com o locale brasileiro
  return numValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Adiciona um cabeçalho estilizado ao PDF
 */
function addHeader(doc, title) {
  // Adiciona um retângulo colorido como fundo do cabeçalho
  doc.setFillColor(41, 128, 185); // Azul
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 40, 'F');
  
  // Adiciona o título
  doc.setTextColor(255, 255, 255); // Branco
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 25);
  
  // Adiciona a data de geração
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const horaAtual = new Date().toLocaleTimeString('pt-BR');
  doc.text(`Gerado em: ${dataAtual} às ${horaAtual}`, 14, 35);
  
  // Reseta as configurações de texto
  doc.setTextColor(0, 0, 0); // Preto
  doc.setFont('helvetica', 'normal');
  
  return 50; // Retorna a posição Y após o cabeçalho
}

/**
 * Adiciona um rodapé ao PDF
 */
function addFooter(doc) {
  const pageCount = doc.internal.getNumberOfPages();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Adiciona um retângulo colorido como fundo do rodapé
    doc.setFillColor(240, 240, 240); // Cinza claro
    doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
    
    // Adiciona o número da página
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100); // Cinza escuro
    doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    // Adiciona o nome da aplicação
    doc.text('Sistema de Controle de Gastos', 14, pageHeight - 10);
  }
}

/**
 * Adiciona uma seção com título ao PDF
 */
function addSectionTitle(doc, title, startY) {
  doc.setFillColor(230, 230, 230); // Cinza claro
  doc.rect(10, startY - 6, doc.internal.pageSize.getWidth() - 20, 10, 'F');
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(41, 128, 185); // Azul
  doc.text(title, 14, startY);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0); // Preto
  
  return startY + 10;
}

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

  // Cria um novo documento PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Adiciona o cabeçalho
  let startY = addHeader(doc, "Relatório de Transações");

  // ---------------------------------------------------
  // Tabela de Filtros Aplicados
  // ---------------------------------------------------
  startY = addSectionTitle(doc, "Filtros Aplicados", startY);

  // Monta o corpo da tabela de filtros (campo/valor)
  const periodoLine = `${filterDetails.dataInicio || '-'} até ${filterDetails.dataFim || '-'}`;
  const tipoLine = filterDetails.selectedTipo === 'gasto' ? 'Gastos' : 
                  filterDetails.selectedTipo === 'recebivel' ? 'Recebíveis' : 'Todos';
  const pessoasLine = (filterDetails.selectedPessoas && filterDetails.selectedPessoas.length > 0)
    ? filterDetails.selectedPessoas.join(', ')
    : 'Todas';

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
    ["Tipo", tipoLine],
    ["Pessoas", pessoasLine],
    ["Tags", tagLine]
  ];

  autoTable(doc, {
    startY,
    head: [["Campo", "Valor"]],
    body: filterTableData,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: { 
      fontSize: 10,
      cellPadding: 5
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 240, 240] }
    },
    margin: { top: 10, right: 10, bottom: 10, left: 10 }
  });

  startY = doc.lastAutoTable.finalY + 15;

  // ---------------------------------------------------
  // Tabela de Resumo Analítico
  // ---------------------------------------------------
  startY = addSectionTitle(doc, "Resumo Analítico", startY);

  const summaryTableData = [
    ["Total de Transações", summaryInfo.totalTransactions || 0],
    ["Total em Valor", formatCurrency(summaryInfo.totalValue || 0)],
    ["Número de Pessoas", summaryInfo.totalPeople || 0],
    ["Média por Pessoa", formatCurrency(summaryInfo.averagePerPerson || 0)],
    ["Total de Gastos", formatCurrency(summaryInfo.totalGastos || 0)],
    ["Total de Recebíveis", formatCurrency(summaryInfo.totalRecebiveis || 0)],
    ["Saldo (Recebíveis - Gastos)", formatCurrency(summaryInfo.netValue || 0)]
  ];

  autoTable(doc, {
    startY,
    head: [["Indicador", "Valor"]],
    body: summaryTableData,
    theme: 'grid',
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: { 
      fontSize: 10,
      cellPadding: 5
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [240, 240, 240] },
      1: { halign: 'right' }
    },
    margin: { top: 10, right: 10, bottom: 10, left: 10 }
  });

  startY = doc.lastAutoTable.finalY + 15;

  // ---------------------------------------------------
  // Separa os dados em Gastos e Recebíveis
  // ---------------------------------------------------
  const gastos = data.filter(row => row.tipoPai?.toLowerCase() === 'gasto');
  const recebiveis = data.filter(row => row.tipoPai?.toLowerCase() === 'recebivel');

  // Função auxiliar para adicionar cada seção
  const addSection = (titulo, rows, color) => {
    if (rows.length === 0) return startY;
    
    startY = addSectionTitle(doc, titulo, startY);

    // Verifica se precisa adicionar uma nova página
    if (startY > doc.internal.pageSize.getHeight() - 60) {
      doc.addPage();
      startY = 20;
    }

    const colunas = ["Data", "Descrição", "Pessoa", "Valor", "Status"];
    
    // Preparamos as linhas com formatação adequada
    const linhas = rows.map(row => [
      formatDate(row.dataPai),
      row.descricaoPai,
      row.pessoa || '',
      formatCurrency(row.valorPagamento),
      row.statusPai || ''
    ]);

    // Adicionamos um total ao final
    const total = rows.reduce((sum, row) => sum + parseFloat(row.valorPagamento || 0), 0);
    linhas.push(['', '', 'TOTAL', formatCurrency(total), '']);

    autoTable(doc, {
      head: [colunas],
      body: linhas,
      startY,
      theme: 'grid',
      headStyles: {
        fillColor: color,
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: { 
        fontSize: 9,
        cellPadding: 4
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        3: { halign: 'right' }
      },
      footStyles: {
        fillColor: [240, 240, 240],
        fontStyle: 'bold'
      },
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
      didDrawCell: (data) => {
        // Destacar a linha de total
        if (data.row.index === linhas.length - 1) {
          doc.setFillColor(230, 230, 230);
          doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
        }
      }
    });

    return doc.lastAutoTable.finalY + 15;
  };

  // Adiciona as seções de Gastos e Recebíveis com cores diferentes
  startY = addSection("Gastos", gastos, [231, 76, 60]); // Vermelho para gastos
  startY = addSection("Recebíveis", recebiveis, [46, 204, 113]); // Verde para recebíveis

  // Adiciona gráfico de distribuição se houver dados suficientes
  if (gastos.length > 0 || recebiveis.length > 0) {
    // Verifica se precisa adicionar uma nova página
    if (startY > doc.internal.pageSize.getHeight() - 100) {
      doc.addPage();
      startY = 20;
    }
    
    startY = addSectionTitle(doc, "Distribuição de Valores", startY);
    
    // Desenha um gráfico de barras simples
    const totalGastos = gastos.reduce((sum, row) => sum + parseFloat(row.valorPagamento || 0), 0);
    const totalRecebiveis = recebiveis.reduce((sum, row) => sum + parseFloat(row.valorPagamento || 0), 0);
    const maxValue = Math.max(totalGastos, totalRecebiveis);
    
    const barWidth = 40;
    const barMaxHeight = 60;
    const startX = 50;
    
    // Barra de gastos
    const gastosHeight = (totalGastos / maxValue) * barMaxHeight;
    doc.setFillColor(231, 76, 60); // Vermelho
    doc.rect(startX, startY, barWidth, gastosHeight, 'F');
    
    // Barra de recebíveis
    const recebiveisHeight = (totalRecebiveis / maxValue) * barMaxHeight;
    doc.setFillColor(46, 204, 113); // Verde
    doc.rect(startX + barWidth + 20, startY, barWidth, recebiveisHeight, 'F');
    
    // Adiciona legendas
    doc.setFontSize(10);
    doc.text("Gastos", startX + barWidth/2, startY + gastosHeight + 10, { align: 'center' });
    doc.text(formatCurrency(totalGastos), startX + barWidth/2, startY + gastosHeight + 20, { align: 'center' });
    
    doc.text("Recebíveis", startX + barWidth + 20 + barWidth/2, startY + recebiveisHeight + 10, { align: 'center' });
    doc.text(formatCurrency(totalRecebiveis), startX + barWidth + 20 + barWidth/2, startY + recebiveisHeight + 20, { align: 'center' });
    
    // Adiciona linha de base
    doc.setDrawColor(200, 200, 200);
    doc.line(startX - 10, startY + barMaxHeight, startX + barWidth*2 + 30, startY + barMaxHeight);
  }

  // Adiciona o rodapé em todas as páginas
  addFooter(doc);

  // Salva o PDF
  doc.save(filename);
}
