/**
 * Utilitários para geração de parcelas.
 * Usado pelo backend na criação de transações e pelo endpoint de preview.
 * Garante consistência entre preview e persistência.
 */

/**
 * Divide valor total em parcelas com arredondamento correto.
 * A última parcela recebe o ajuste para garantir soma exata.
 * Ex: 1000/3 → [333.33, 333.33, 333.34]
 * @param {number} valorTotal - Valor total a dividir
 * @param {number} numParcelas - Quantidade de parcelas
 * @returns {number[]} Array com valor de cada parcela
 */
function dividirParcelas(valorTotal, numParcelas) {
  const base = Math.floor((valorTotal * 100) / numParcelas) / 100;
  const resto = Math.round((valorTotal - base * numParcelas) * 100) / 100;
  const parcelas = Array(numParcelas).fill(base);
  parcelas[numParcelas - 1] += resto;
  return parcelas;
}

/**
 * Converte string YYYY-MM-DD ou Date para Date UTC meio-dia (evita timezone shift).
 * @param {string|Date} input
 * @returns {Date}
 */
function parseStartDateUTC(input) {
  if (!input) return null;
  if (input instanceof Date) {
    const year = input.getUTCFullYear();
    const month = input.getUTCMonth();
    const day = input.getUTCDate();
    return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
  }
  const str = String(input);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
}

/**
 * Formata Date para YYYY-MM-DD (UTC).
 * @param {Date} date
 * @returns {string}
 */
function formatDateToYYYYMMDD(date) {
  if (!date || !(date instanceof Date)) return '';
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Gera array de parcelas com datas e valores.
 * Usado pelo endpoint de preview e pela criação de transações.
 * @param {Object} params
 * @param {number} params.totalAmount - Valor total
 * @param {number} params.totalInstallments - Quantidade de parcelas
 * @param {number} params.intervalInDays - Intervalo em dias (>= 1)
 * @param {string|Date} params.startDate - Data inicial (YYYY-MM-DD ou Date)
 * @returns {{ parcelas: Array<{ installmentNumber: number, date: string, value: number }>, valorTotal: number, intervalInDays: number, startDate: string } | { erro: string }}
 */
function generateInstallments({ totalAmount, totalInstallments, intervalInDays, startDate }) {
  const numParcelas = parseInt(totalInstallments, 10);
  const intervalDays = parseInt(intervalInDays, 10);

  if (numParcelas < 2) {
    return { erro: 'Quantidade de parcelas deve ser >= 2' };
  }
  if (intervalDays < 1) {
    return { erro: 'Intervalo em dias deve ser >= 1' };
  }

  const valorTotal = Math.abs(parseFloat(totalAmount) || 0);
  if (valorTotal <= 0) {
    return { erro: 'Valor total deve ser maior que zero' };
  }

  const dataBase = parseStartDateUTC(startDate);
  if (!dataBase || isNaN(dataBase.getTime())) {
    return { erro: 'Data inicial inválida' };
  }

  const valoresParcelas = dividirParcelas(valorTotal, numParcelas);
  const parcelas = [];

  for (let i = 0; i < numParcelas; i++) {
    const dataParcela = new Date(dataBase.getTime() + i * intervalDays * 86400000);
    parcelas.push({
      installmentNumber: i + 1,
      date: formatDateToYYYYMMDD(dataParcela),
      value: valoresParcelas[i]
    });
  }

  return {
    parcelas,
    valorTotal,
    intervalInDays: intervalDays,
    startDate: formatDateToYYYYMMDD(dataBase)
  };
}

module.exports = {
  dividirParcelas,
  generateInstallments,
  parseStartDateUTC,
  formatDateToYYYYMMDD
};
