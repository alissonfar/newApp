// src/utils/export/exportData.js

/**
 * Converte um array de objetos em uma string CSV e dispara o download do arquivo.
 * @param {Array} data - Array de objetos a ser exportado.
 * @param {string} filename - Nome do arquivo a ser baixado (padrão: 'export.csv').
 */
export function exportDataToCSV(data, filename = 'export.csv') {
    if (!data || !data.length) {
      console.warn('Nenhum dado para exportar');
      return;
    }
  
    // Cria o cabeçalho com base nas chaves do primeiro objeto
    const headers = Object.keys(data[0]).join(',');
    
    // Mapeia cada objeto para uma linha CSV, garantindo a correta formatação (ex: escapando aspas)
    const csvRows = data.map(row => {
      return Object.values(row)
        .map(value => {
          if (typeof value === 'string') {
            // Escapa aspas e envolve o valor em aspas
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        })
        .join(',');
    });
  
    const csvString = `${headers}\n${csvRows.join('\n')}`;
  
    // Cria um Blob e dispara o download
    const blob = new Blob([csvString], { type: 'text/csv' });
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
  