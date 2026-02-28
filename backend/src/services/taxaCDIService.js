// src/services/taxaCDIService.js
const https = require('https');
const TaxaCDI = require('../models/taxaCDI');

const API_BCB_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json';
const DIAS_UTEIS_ANO = 252;
const DIAS_UTEIS_MES = 21;

/**
 * Converte taxa anual (% ao ano) para taxa diária decimal.
 * @param {number} taxaAnualPercent - Ex: 13.65
 * @returns {number} Taxa diária em decimal (ex: 0.0005)
 */
function taxaAnualParaDiaria(taxaAnualPercent) {
  const taxaAnualDecimal = taxaAnualPercent / 100;
  return Math.pow(1 + taxaAnualDecimal, 1 / DIAS_UTEIS_ANO) - 1;
}

/**
 * Converte taxa diária decimal para taxa mensal decimal.
 * @param {number} taxaDiaria
 * @returns {number}
 */
function taxaDiariaParaMensal(taxaDiaria) {
  return Math.pow(1 + taxaDiaria, DIAS_UTEIS_MES) - 1;
}

/**
 * Converte taxa diária decimal para taxa anual percentual.
 * @param {number} taxaDiaria
 * @returns {number}
 */
function taxaDiariaParaAnual(taxaDiaria) {
  const taxaAnualDecimal = Math.pow(1 + taxaDiaria, DIAS_UTEIS_ANO) - 1;
  return taxaAnualDecimal * 100;
}

/**
 * Busca taxa CDI da API do BCB.
 * Usa https nativo (compatível com Node < 18).
 * @returns {Promise<{data: string, valor: string}|null>}
 */
function buscarDaAPI() {
  return new Promise((resolve) => {
    const req = https.get(API_BCB_URL, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const dados = JSON.parse(body);
          if (Array.isArray(dados) && dados.length > 0) {
            resolve(dados[0]);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', (err) => {
      console.warn('[TaxaCDIService] Erro ao buscar API BCB:', err.message);
      resolve(null);
    });
    req.setTimeout(10000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Parse da data no formato dd/MM/yyyy para Date.
 * @param {string} dataStr
 * @returns {Date}
 */
function parseDataBCB(dataStr) {
  const [dia, mes, ano] = dataStr.split('/').map(Number);
  return new Date(ano, mes - 1, dia);
}

/**
 * Obtém ou atualiza a taxa CDI atual.
 * Atualiza no máximo 1x por dia.
 * Se API falhar, retorna última taxa em cache. Nunca lança erro.
 * @returns {Promise<{data: Date, taxaDiaria: number, taxaMensal: number, taxaAnual: number, fonte: string}|null>}
 */
async function obterOuAtualizarTaxaAtual() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // 1. Verificar se já temos taxa para hoje
  const existenteHoje = await TaxaCDI.findOne({
    data: { $gte: hoje, $lt: new Date(hoje.getTime() + 24 * 60 * 60 * 1000) }
  }).lean();

  if (existenteHoje) {
    return {
      data: existenteHoje.data,
      taxaDiaria: existenteHoje.taxaDiaria,
      taxaMensal: existenteHoje.taxaMensal,
      taxaAnual: existenteHoje.taxaAnual,
      fonte: existenteHoje.fonte || 'api.bcb.gov.br'
    };
  }

  // 2. Buscar da API
  const dadoAPI = await buscarDaAPI();
  if (dadoAPI && dadoAPI.valor) {
    const taxaAnualPercent = parseFloat(String(dadoAPI.valor).replace(',', '.')) || 0;
    const taxaDiaria = taxaAnualParaDiaria(taxaAnualPercent);
    const taxaMensal = taxaDiariaParaMensal(taxaDiaria);
    const taxaAnual = taxaAnualPercent;
    const data = parseDataBCB(dadoAPI.data);

    try {
      const novaTaxa = new TaxaCDI({
        data,
        taxaDiaria,
        taxaMensal,
        taxaAnual,
        fonte: 'api.bcb.gov.br'
      });
      await novaTaxa.save();
      return {
        data,
        taxaDiaria,
        taxaMensal,
        taxaAnual,
        fonte: 'api.bcb.gov.br'
      };
    } catch (err) {
      if (err.code === 11000) {
        const existente = await TaxaCDI.findOne({ data }).lean();
        if (existente) {
          return {
            data: existente.data,
            taxaDiaria: existente.taxaDiaria,
            taxaMensal: existente.taxaMensal,
            taxaAnual: existente.taxaAnual,
            fonte: existente.fonte || 'api.bcb.gov.br'
          };
        }
      }
    }
  }

  // 3. Fallback: última taxa em cache
  const ultimaTaxa = await TaxaCDI.findOne().sort({ data: -1 }).lean();
  if (ultimaTaxa) {
    return {
      data: ultimaTaxa.data,
      taxaDiaria: ultimaTaxa.taxaDiaria,
      taxaMensal: ultimaTaxa.taxaMensal,
      taxaAnual: ultimaTaxa.taxaAnual,
      fonte: ultimaTaxa.fonte || 'cache'
    };
  }

  return null;
}

/**
 * Calcula rendimento diário estimado: saldoAtual × taxaCDI_diaria × (percentualCDI / 100)
 * @param {number} saldoAtual
 * @param {number} taxaDiaria
 * @param {number} percentualCDI
 * @returns {number}
 */
function calcularRendimentoDiario(saldoAtual, taxaDiaria, percentualCDI) {
  if (!saldoAtual || !taxaDiaria || !percentualCDI) return 0;
  return saldoAtual * taxaDiaria * (percentualCDI / 100);
}

module.exports = {
  obterOuAtualizarTaxaAtual,
  calcularRendimentoDiario,
  taxaAnualParaDiaria,
  taxaDiariaParaMensal,
  taxaDiariaParaAnual
};
