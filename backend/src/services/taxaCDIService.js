// src/services/taxaCDIService.js
const https = require('https');
const TaxaCDI = require('../models/taxaCDI');
const financialService = require('./financial.service');

const API_BCB_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json';
const DIAS_UTEIS_ANO = 252;
const DIAS_UTEIS_MES = 21;

/**
 * A série 12 do BCB retorna a taxa CDI DIÁRIA em % ao dia (ex: 0.055131 = 0,055131% a.d.).
 * Converte taxa diária (% a.d.) para taxa anual (% a.a.).
 * Fórmula: taxa_anual = ((1 + taxa_diaria/100)^252 - 1) * 100
 * @param {number} taxaDiariaPercent - Ex: 0.055131 (% ao dia)
 * @returns {number} Taxa anual em % (ex: 14.89)
 */
function taxaDiariaParaAnual(taxaDiariaPercent) {
  const taxaDiariaDecimal = taxaDiariaPercent / 100;
  const taxaAnualDecimal = Math.pow(1 + taxaDiariaDecimal, DIAS_UTEIS_ANO) - 1;
  return taxaAnualDecimal * 100;
}

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
 * @param {number} taxaDiaria - Taxa diária em decimal (ex: 0.0005)
 * @returns {number} Taxa anual em %
 */
function taxaDiariaDecimalParaAnual(taxaDiaria) {
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
 * Atualiza no máximo 1x por dia (a menos que forceRefresh=true).
 * Se API falhar, retorna última taxa em cache. Nunca lança erro.
 * @param {Object} opts - { forceRefresh?: boolean } - forceRefresh ignora cache e busca da API
 * @returns {Promise<{data: Date, taxaDiaria: number, taxaMensal: number, taxaAnual: number, fonte: string}|null>}
 */
async function obterOuAtualizarTaxaAtual(opts = {}) {
  const { forceRefresh = false } = opts;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // 1. Verificar se já temos taxa para hoje (a menos que forceRefresh)
  if (!forceRefresh) {
    const existenteHoje = await TaxaCDI.findOne({
      data: { $gte: hoje, $lt: new Date(hoje.getTime() + 24 * 60 * 60 * 1000) }
    }).lean();

    if (existenteHoje) {
      const taxaAnual = existenteHoje.taxaAnual;
      return {
        data: existenteHoje.data,
        taxaDiaria: existenteHoje.taxaDiaria,
        taxaMensal: existenteHoje.taxaMensal,
        taxaAnual,
        taxaMensalEquivalente: financialService.taxaAnualParaMensalEquivalente(taxaAnual),
        taxaDiariaEquivalente: financialService.taxaAnualParaDiariaEquivalente(taxaAnual),
        fonte: existenteHoje.fonte || 'api.bcb.gov.br'
      };
    }
  }

  // 2. Buscar da API
  // Série 12 do BCB retorna taxa CDI DIÁRIA em % ao dia (ex: 0.055131)
  const dadoAPI = await buscarDaAPI();
  if (dadoAPI && dadoAPI.valor) {
    const taxaDiariaPercent = parseFloat(String(dadoAPI.valor).replace(',', '.')) || 0;
    const taxaAnual = taxaDiariaParaAnual(taxaDiariaPercent);
    const taxaDiaria = taxaAnualParaDiaria(taxaAnual);
    const taxaMensal = taxaDiariaParaMensal(taxaDiaria);
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
        taxaMensalEquivalente: financialService.taxaAnualParaMensalEquivalente(taxaAnual),
        taxaDiariaEquivalente: financialService.taxaAnualParaDiariaEquivalente(taxaAnual),
        fonte: 'api.bcb.gov.br'
      };
    } catch (err) {
      if (err.code === 11000) {
        // Registro já existe para esta data - atualizar com os valores corretos (force refresh)
        const atualizado = await TaxaCDI.findOneAndUpdate(
          { data },
          { taxaDiaria, taxaMensal, taxaAnual, fonte: 'api.bcb.gov.br' },
          { new: true }
        ).lean();
        if (atualizado) {
          const taxaAnualVal = atualizado.taxaAnual;
          return {
            data: atualizado.data,
            taxaDiaria: atualizado.taxaDiaria,
            taxaMensal: atualizado.taxaMensal,
            taxaAnual: taxaAnualVal,
            taxaMensalEquivalente: financialService.taxaAnualParaMensalEquivalente(taxaAnualVal),
            taxaDiariaEquivalente: financialService.taxaAnualParaDiariaEquivalente(taxaAnualVal),
            fonte: atualizado.fonte || 'api.bcb.gov.br'
          };
        }
      }
    }
  }

  // 3. Fallback: última taxa em cache
  const ultimaTaxa = await TaxaCDI.findOne().sort({ data: -1 }).lean();
  if (ultimaTaxa) {
    const taxaAnual = ultimaTaxa.taxaAnual;
    return {
      data: ultimaTaxa.data,
      taxaDiaria: ultimaTaxa.taxaDiaria,
      taxaMensal: ultimaTaxa.taxaMensal,
      taxaAnual,
      taxaMensalEquivalente: financialService.taxaAnualParaMensalEquivalente(taxaAnual),
      taxaDiariaEquivalente: financialService.taxaAnualParaDiariaEquivalente(taxaAnual),
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
  taxaDiariaDecimalParaAnual
};
