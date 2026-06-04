// src/services/inferenciaPessoaService.js
const mongoose = require('mongoose');
const Transacao = require('../models/transacao');
const Usuario = require('../models/usuarios');

const LOOKBACK_MONTHS_PADRAO = 12;
const MIN_MATCHES_PADRAO = 2;
const TAMANHO_MINIMO_DESCRICAO = 3;

/**
 * Remove sufixo de parcela comum em faturas de cartão.
 * "Mercadolivre*Ohmybag - Parcela 8/12" -> "Mercadolivre*Ohmybag"
 * "IFOOD *RESTAURANTE - PARCELA 02 / 03" -> "IFOOD *RESTAURANTE"
 */
function stripParcelaSufixo(descricao) {
  if (!descricao) return '';
  return String(descricao)
    .replace(/\s*-\s*[Pp]arcela\s+\d+\s*\/\s*\d+\s*$/g, '')
    .replace(/\s*-\s*[Pp]arc\.?\s+\d+\s*\/\s*\d+\s*$/g, '')
    .replace(/\s+\d+\s*\/\s*\d+\s*$/g, '')
    .trim();
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizarPessoa(pessoa) {
  return (pessoa || '').trim();
}

/**
 * Procura transações reais (Transacao ativas) do usuário com descrição similar.
 * Retorna lista de matches brutos (sem deduplicar por pessoa).
 */
async function buscarMatchesHistorico(usuarioId, descricaoBase, dataReferencia, lookbackMonths) {
  if (!descricaoBase || descricaoBase.length < TAMANHO_MINIMO_DESCRICAO) return [];

  const dataCorte = new Date(dataReferencia || Date.now());
  dataCorte.setMonth(dataCorte.getMonth() - lookbackMonths);

  // Aceita o sufixo "- Parcela X/Y" como opcional no lado histórico, para que
  // "Pneu Free Com" (nova, após strip) case com "Pneu Free Com - Parcela 1/10" (histórico).
  // Sem isso, a maioria dos parcelamentos nunca é sugerida.
  const regex = new RegExp(
    `^\\s*${escapeRegex(descricaoBase)}(\\s*-\\s*[Pp]arcela\\s+\\d+\\s*\\/\\s*\\d+)?\\s*$`,
    'i'
  );

  const matches = await Transacao.find({
    usuario: usuarioId,
    status: 'ativo',
    data: { $gte: dataCorte },
    descricao: regex
  })
    .select('_id descricao valor data pagamentos')
    .lean();

  return matches;
}

/**
 * Infere a pessoa responsável por uma transação importada, baseando-se em
 * transações reais anteriores com descrição similar.
 *
 * @param {string} usuarioId
 * @param {Object} params
 * @param {string} params.descricao - descrição da transação nova (vinda do parser)
 * @param {string} params.proprietario - nome do proprietário (default ignorado)
 * @param {Date}   [params.dataReferencia] - default = hoje
 * @param {number} [params.minMatches] - default 2
 * @param {number} [params.lookbackMonths] - default 12
 * @returns {Promise<null | {
 *   pessoa: string,
 *   count: number,
 *   transacaoIds: ObjectId[],
 *   totalValor: number,
 *   sample: { _id, descricao, data, valor, pessoa },
 *   confianca: 'alta'
 * }>}
 */
async function inferirPessoaPorDescricao(usuarioId, params) {
  const {
    descricao,
    proprietario,
    dataReferencia,
    minMatches = MIN_MATCHES_PADRAO,
    lookbackMonths = LOOKBACK_MONTHS_PADRAO
  } = params || {};

  if (!usuarioId || !descricao) return null;

  const descricaoBase = stripParcelaSufixo(descricao);
  if (descricaoBase.length < TAMANHO_MINIMO_DESCRICAO) return null;

  const proprietarioNorm = normalizarPessoa(proprietario).toLowerCase();

  const matches = await buscarMatchesHistorico(
    usuarioId,
    descricaoBase,
    dataReferencia,
    lookbackMonths
  );

  if (!matches || matches.length === 0) return null;

  // Agrega por pessoa (somente diferentes do proprietário)
  const porPessoa = new Map();
  for (const t of matches) {
    for (const pag of t.pagamentos || []) {
      const pessoaNorm = normalizarPessoa(pag.pessoa);
      if (!pessoaNorm) continue;
      if (proprietarioNorm && pessoaNorm.toLowerCase() === proprietarioNorm) continue;
      const entry = porPessoa.get(pessoaNorm) || {
        pessoa: pessoaNorm,
        count: 0,
        transacaoIds: [],
        totalValor: 0,
        sample: null
      };
      entry.count += 1;
      entry.transacaoIds.push(t._id);
      entry.totalValor += Math.abs(parseFloat(pag.valor) || 0);
      if (!entry.sample) {
        entry.sample = {
          _id: t._id,
          descricao: t.descricao,
          data: t.data,
          valor: t.valor,
          pessoa: pag.pessoa
        };
      }
      porPessoa.set(pessoaNorm, entry);
    }
  }

  if (porPessoa.size === 0) return null;

  // Pega a pessoa com maior contagem; desempate por totalValor desc, depois alfabético
  const ordenado = [...porPessoa.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.totalValor !== a.totalValor) return b.totalValor - a.totalValor;
    return a.pessoa.localeCompare(b.pessoa);
  });
  const top = ordenado[0];
  if (top.count < minMatches) return null;

  return {
    pessoa: top.pessoa,
    count: top.count,
    transacaoIds: top.transacaoIds,
    totalValor: top.totalValor,
    sample: top.sample,
    confianca: 'alta'
  };
}

/**
 * Helper: dado um array de transações parseadas, retorna um array de
 * inferências alinhado com a entrada (mesmo índice). Entradas não-gas-to
 * ou sem inferência retornam null nessa posição.
 * Falhas individuais são logadas e ignoradas (best-effort).
 */
async function inferirPessoasEmLote(transacoes, usuarioId) {
  const proprietarioDoc = await Usuario.findById(usuarioId)
    .select('preferencias.proprietario')
    .lean()
    .catch(() => null);
  const proprietario = proprietarioDoc?.preferencias?.proprietario || '';

  const resultados = new Array(transacoes.length).fill(null);
  for (let i = 0; i < transacoes.length; i++) {
    const t = transacoes[i];
    if (!t || t.tipo !== 'gasto' || !t.descricao) continue;
    try {
      const inferencia = await inferirPessoaPorDescricao(usuarioId, {
        descricao: t.descricao,
        proprietario,
        dataReferencia: t.data ? new Date(t.data) : new Date()
      });
      if (inferencia) resultados[i] = inferencia;
    } catch (err) {
      // best-effort: não bloqueia o pipeline
      console.warn('[InferenciaPessoa] Falha ao inferir para transação:', t?.descricao, err.message);
    }
  }
  return resultados;
}

module.exports = {
  inferirPessoaPorDescricao,
  inferirPessoasEmLote,
  stripParcelaSufixo,
  LOOKBACK_MONTHS_PADRAO,
  MIN_MATCHES_PADRAO
};
