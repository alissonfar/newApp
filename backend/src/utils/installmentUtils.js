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

/**
 * Gera transações a partir de pagamentos com parcelamento por participante.
 * Cada pagamento pode ter seu próprio plano de parcelamento (ou nenhum = à vista).
 * Agrupa todos os pagamentos (à vista + parcelas) por data e gera uma Transacao por data.
 *
 * @param {Object} params
 * @param {Array} params.pagamentos - Array de pagamentos com estrutura:
 *   { pessoa, valor, tags?, parcelamento?: { ativo, quantidade, intervaloDias } }
 * @param {string|Date} params.startDate - Data base para início do parcelamento
 * @param {Object} params.baseTransacao - Campos base para todas as transações geradas
 *   { tipo, descricao, observacao, usuario, subconta, contaConjunta? }
 * @returns {{ transacoes: Array, parentTransactionId: ObjectId }}
 */
function gerarTransacoesComParcelamento({ pagamentos, startDate, baseTransacao }) {
  const mongoose = require('mongoose');
  const parentTransactionId = new mongoose.Types.ObjectId();

  const allEntries = [];

  for (const pag of pagamentos) {
    const valorPag = Math.abs(parseFloat(pag.valor) || 0);
    if (valorPag <= 0) continue;

    if (pag.parcelamento && pag.parcelamento.ativo) {
      const planGroupId = new mongoose.Types.ObjectId();
      const resultado = generateInstallments({
        totalAmount: valorPag,
        totalInstallments: pag.parcelamento.quantidade,
        intervalInDays: pag.parcelamento.intervaloDias || 30,
        startDate
      });

      if (resultado.erro) {
        return { erro: `Erro no parcelamento de "${pag.pessoa}": ${resultado.erro}` };
      }

      for (const parcela of resultado.parcelas) {
        allEntries.push({
          date: parcela.date,
          pessoa: pag.pessoa,
          valor: parcela.value,
          tags: pag.tags || {},
          installmentNumber: parcela.installmentNumber,
          installmentTotal: pag.parcelamento.quantidade,
          installmentGroupId: planGroupId,
          installmentIntervalDays: pag.parcelamento.intervaloDias || 30,
          emprestimoId: pag.emprestimoId || null
        });
      }
    } else {
      const dataStr = formatDateToYYYYMMDD(parseStartDateUTC(startDate));
      allEntries.push({
        date: dataStr,
        pessoa: pag.pessoa,
        valor: valorPag,
        tags: pag.tags || {},
        installmentNumber: null,
        installmentTotal: null,
        installmentGroupId: null,
        installmentIntervalDays: null,
        emprestimoId: pag.emprestimoId || null
      });
    }
  }

  if (allEntries.length === 0) {
    return { erro: 'Nenhum pagamento válido para gerar transações.' };
  }

  const groupedByDate = new Map();
  for (const entry of allEntries) {
    if (!groupedByDate.has(entry.date)) {
      groupedByDate.set(entry.date, []);
    }
    groupedByDate.get(entry.date).push(entry);
  }

  const sortedDates = Array.from(groupedByDate.keys()).sort();
  const transacoes = sortedDates.map((dateStr) => {
    const entries = groupedByDate.get(dateStr);
    const dataParcela = new Date(dateStr + 'T12:00:00.000Z');

    const pagamentosDaTransacao = entries.map((e) => {
      const pag = {
        pessoa: e.pessoa,
        valor: Math.round(e.valor * 100) / 100,
        tags: e.tags
      };
      if (e.installmentNumber != null) {
        pag.installmentNumber = e.installmentNumber;
        pag.installmentTotal = e.installmentTotal;
        pag.installmentGroupId = e.installmentGroupId;
      }
      // Replica o vínculo pagamento-level de Empréstimo para cada parcela.
      if (e.emprestimoId) {
        pag.emprestimoId = e.emprestimoId;
      }
      return pag;
    });

    const valorTotal = entries.reduce((sum, e) => sum + e.valor, 0);

    const hasInstallmentPayment = entries.some((e) => e.installmentNumber != null);

    return {
      ...baseTransacao,
      valor: Math.round(valorTotal * 100) / 100,
      data: dataParcela,
      pagamentos: pagamentosDaTransacao,
      parentTransactionId,
      isInstallment: hasInstallmentPayment,
      installmentGroupId: null,
      installmentNumber: null,
      installmentTotal: null,
      installmentIntervalDays: null,
      installmentIntervalMonths: null
    };
  });

  return { transacoes, parentTransactionId };
}

/**
 * Versão de preview: gera parcelas agrupadas por data sem criar transações.
 * Usado pelo endpoint /preview-parcelas para que o frontend possa exibir o preview.
 *
 * @param {Object} params
 * @param {number} params.valorTotal - Valor total a dividir (para compatibilidade legada)
 * @param {number} params.totalInstallments - Quantidade de parcelas (legado)
 * @param {number} params.intervalInDays - Intervalo em dias (legado)
 * @param {string|Date} params.startDate - Data inicial
 * @param {Array} [params.pagamentos] - Array de pagamentos com parcelamento por participante (novo modelo).
 *   Se fornecido, usa o novo algoritmo. Caso contrário, usa o legado.
 * @returns {Object} Preview com parcelas agrupadas
 */
function previewParcelamento({ valorTotal, totalInstallments, intervalInDays, startDate, pagamentos }) {
  if (pagamentos && Array.isArray(pagamentos) && pagamentos.length > 0 && pagamentos.some(p => p.parcelamento?.ativo)) {
    const fakeBase = {};
    const result = gerarTransacoesComParcelamento({
      pagamentos,
      startDate,
      baseTransacao: fakeBase
    });

    if (result.erro) return { erro: result.erro };

    const allParcelasFlat = [];
    for (const t of result.transacoes) {
      for (const p of t.pagamentos) {
        allParcelasFlat.push({
          date: t.data instanceof Date ? formatDateToYYYYMMDD(t.data) : String(t.data).split('T')[0],
          pessoa: p.pessoa,
          valor: p.valor,
          installmentNumber: p.installmentNumber,
          installmentTotal: p.installmentTotal
        });
      }
    }

    return {
      parcelas: allParcelasFlat,
      transacoesGeradas: result.transacoes.length,
      parentTransactionId: result.parentTransactionId
    };
  }

  return generateInstallments({ totalAmount: valorTotal, totalInstallments, intervalInDays, startDate });
}

module.exports = {
  dividirParcelas,
  generateInstallments,
  parseStartDateUTC,
  formatDateToYYYYMMDD,
  gerarTransacoesComParcelamento,
  previewParcelamento
};
