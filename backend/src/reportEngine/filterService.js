// src/reportEngine/filterService.js
const Transacao = require('../models/transacao');
const mongoose = require('mongoose');

const MAX_EXPORT = 50000;

/**
 * Constrói o estágio $match para aggregation a partir de um objeto filters.
 * Suporta excludePessoas além dos filtros existentes.
 * @param {Object} filters - { dataInicio, dataFim, tipo, pessoas, excludePessoas, tagsFilter, search }
 * @param {string} userId - ID do usuário
 * @returns {Object} match stage
 */
function buildMatchFromFilters(filters, userId) {
  const match = {
    status: 'ativo',
    usuario: new mongoose.Types.ObjectId(userId)
  };

  // Pessoas: include ($in), exclude ($nin) ou proprietario (regex). Prioridade: exclude > pessoas > proprietario
  if (filters.excludePessoas && (Array.isArray(filters.excludePessoas) ? filters.excludePessoas.length > 0 : filters.excludePessoas)) {
    const exclude = Array.isArray(filters.excludePessoas) ? filters.excludePessoas : [filters.excludePessoas];
    match['pagamentos.pessoa'] = { $nin: exclude };
  } else if (filters.pessoas && (Array.isArray(filters.pessoas) ? filters.pessoas.length > 0 : filters.pessoas)) {
    const pessoas = Array.isArray(filters.pessoas) ? filters.pessoas : [filters.pessoas];
    match['pagamentos.pessoa'] = { $in: pessoas };
  } else if (filters.proprietario) {
    match['pagamentos.pessoa'] = new RegExp('^' + filters.proprietario + '$', 'i');
  }

  if (filters.dataInicio || filters.dataFim) {
    match.data = {};
    if (filters.dataInicio) {
      match.data.$gte = new Date(filters.dataInicio + 'T00:00:00.000Z');
    }
    if (filters.dataFim) {
      match.data.$lte = new Date(filters.dataFim + 'T23:59:59.999Z');
    }
  }

  if (filters.tipo && ['gasto', 'recebivel'].includes(filters.tipo.toLowerCase())) {
    match.tipo = filters.tipo.toLowerCase();
  }

  if (filters.tagsFilter && typeof filters.tagsFilter === 'object') {
    const tagConditions = [];
    for (const [categoriaId, tagIds] of Object.entries(filters.tagsFilter)) {
      if (Array.isArray(tagIds) && tagIds.length > 0) {
        tagConditions.push({ ['pagamentos.tags.' + categoriaId]: { $in: tagIds } });
      }
    }
    if (tagConditions.length > 0) {
      match.$and = match.$and || [];
      match.$and.push(...tagConditions);
    }
  }

  if (filters.search && filters.search.trim()) {
    const search = filters.search.trim();
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [
      { descricao: regex },
      { 'pagamentos.pessoa': regex }
    ];
  }

  return match;
}

function buildSortFromFilters(filters) {
  const sortBy = filters.sortBy || 'data';
  const sortDir = (filters.sortDir || 'desc').toLowerCase() === 'asc' ? 1 : -1;
  const sortFieldMap = {
    data: 'data',
    descricao: 'descricao',
    pessoa: 'pagamentos.pessoa',
    valorPagamento: 'valor'
  };
  const sortField = sortFieldMap[sortBy] || 'data';
  return { [sortField]: sortDir };
}

/**
 * Busca transações filtradas do banco.
 * Quando filtro pessoas está ativo, projeta apenas os pagamentos que batem com o filtro.
 * @param {Object} filters
 * @param {string} userId
 * @returns {Promise<Array>} transações
 */
async function fetchFilteredTransactions(filters, userId) {
  const f = filters || {};
  const matchStage = buildMatchFromFilters(f, userId);
  const sortStage = buildSortFromFilters(f);

  const pessoasFilter = !f.excludePessoas && f.pessoas
    ? (Array.isArray(f.pessoas) ? f.pessoas : [f.pessoas]).filter(Boolean)
    : null;

  const pipeline = [{ $match: matchStage }];
  if (pessoasFilter && pessoasFilter.length > 0) {
    pipeline.push({
      $addFields: {
        pagamentos: {
          $filter: {
            input: { $ifNull: ['$pagamentos', []] },
            as: 'p',
            cond: { $in: ['$$p.pessoa', pessoasFilter] }
          }
        }
      }
    });
    pipeline.push({ $match: { $expr: { $gt: [{ $size: '$pagamentos' }, 0] } } });
  }
  pipeline.push({ $sort: sortStage }, { $limit: MAX_EXPORT });

  const transacoes = await Transacao.aggregate(pipeline);
  return transacoes;
}

module.exports = {
  buildMatchFromFilters,
  buildSortFromFilters,
  fetchFilteredTransactions
};
