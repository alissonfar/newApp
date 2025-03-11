// src/utils/export/exportData.js

/**
 * Formata um valor para o formato de moeda brasileira
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
 * Formata uma data para o formato brasileiro (DD/MM/YYYY)
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  
  // Se for um ISO com "T", pegamos apenas a parte antes do "T"
  const [fullDate] = dateStr.split('T');
  
  // Agora fullDate deve ser algo como "2025-02-02"
  const [year, month, day] = fullDate.split('-');
  if (!year || !month || !day) return dateStr; // fallback
  
  return `${day}/${month}/${year}`;
}

/**
 * Converte um array de objetos em uma string CSV e dispara o download do arquivo.
 * @param {Array} data - Array de objetos a ser exportado.
 * @param {string} filename - Nome do arquivo a ser baixado (padrão: 'export.csv').
 * @param {Object} options - Opções de formatação e configuração.
 */
export function exportDataToCSV(data, filename = 'export.csv', options = {}) {
  if (!data || !data.length) {
    console.warn('Nenhum dado para exportar');
    return;
  }

  const defaultOptions = {
    delimiter: ';', // Delimitador padrão para compatibilidade com Excel brasileiro
    formatCurrency: true, // Formatar valores monetários
    formatDates: true, // Formatar datas para o padrão brasileiro
    includeHeaders: true, // Incluir cabeçalhos
    customHeaders: null, // Cabeçalhos personalizados
    encoding: 'UTF-8' // Codificação do arquivo
  };

  // Mescla as opções padrão com as opções fornecidas
  const mergedOptions = { ...defaultOptions, ...options };
  
  // Define os cabeçalhos (chaves dos objetos ou cabeçalhos personalizados)
  let headers = mergedOptions.customHeaders || Object.keys(data[0]);
  
  // Prepara o conteúdo CSV
  let csvContent = '';
  
  // Adiciona os cabeçalhos se necessário
  if (mergedOptions.includeHeaders) {
    csvContent += headers.join(mergedOptions.delimiter) + '\n';
  }
  
  // Mapeia cada objeto para uma linha CSV
  csvContent += data.map(row => {
    return headers.map(header => {
      let value = row[header];
      
      // Aplica formatação de moeda se necessário
      if (mergedOptions.formatCurrency && 
          (header.toLowerCase().includes('valor') || 
           header.toLowerCase().includes('total') || 
           header.toLowerCase().includes('price'))) {
        if (typeof value === 'number' || !isNaN(parseFloat(value))) {
          value = formatCurrency(value);
        }
      }
      
      // Aplica formatação de data se necessário
      if (mergedOptions.formatDates && 
          (header.toLowerCase().includes('data') || 
           header.toLowerCase().includes('date'))) {
        value = formatDate(value);
      }
      
      // Escapa aspas e envolve o valor em aspas se for string
      if (value === null || value === undefined) {
        return '';
      } else if (typeof value === 'string') {
        // Escapa aspas duplas e envolve em aspas
        return `"${value.replace(/"/g, '""')}"`;
      } else {
        return value;
      }
    }).join(mergedOptions.delimiter);
  }).join('\n');
  
  // Adiciona BOM para garantir que caracteres especiais sejam exibidos corretamente no Excel
  const BOM = '\uFEFF';
  const csvString = BOM + csvContent;
  
  // Cria um Blob e dispara o download
  const blob = new Blob([csvString], { type: `text/csv;charset=${mergedOptions.encoding}` });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

/**
 * Exporta dados para Excel usando a biblioteca SheetJS (xlsx)
 * Requer a instalação da biblioteca: npm install xlsx
 * 
 * @param {Array} data - Array de objetos a ser exportado
 * @param {string} filename - Nome do arquivo a ser baixado
 * @param {Object} options - Opções de formatação
 */
export function exportDataToExcel(data, filename = 'export.xlsx', options = {}) {
  // Esta função requer a biblioteca xlsx
  // Se você quiser implementá-la, instale a biblioteca e descomente o código abaixo
  
  /*
  import * as XLSX from 'xlsx';
  
  if (!data || !data.length) {
    console.warn('Nenhum dado para exportar');
    return;
  }
  
  // Cria uma nova planilha
  const worksheet = XLSX.utils.json_to_sheet(data);
  
  // Cria um novo livro
  const workbook = XLSX.utils.book_new();
  
  // Adiciona a planilha ao livro
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados');
  
  // Exporta o livro
  XLSX.writeFile(workbook, filename);
  */
  
  console.warn('Exportação para Excel requer a biblioteca xlsx. Por favor, instale-a com npm install xlsx');
}
  