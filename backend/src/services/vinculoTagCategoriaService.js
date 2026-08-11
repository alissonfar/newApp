const mongoose = require('mongoose');
const Transacao = require('../models/transacao');
const Tag = require('../models/tag');

/**
 * pagamentos[].tags é um objeto livre { [categoriaId]: [tagId, ...] } —
 * não dá para indexar direto, então convertemos para array de {k,v} via
 * $objectToArray para poder checar se um id aparece em alguma chave/valor.
 */
async function algumPagamentoTemTagOuCategoria(usuarioId, match) {
  const resultado = await Transacao.aggregate([
    { $match: { usuario: new mongoose.Types.ObjectId(usuarioId), status: 'ativo' } },
    { $unwind: '$pagamentos' },
    { $project: { tagsArr: { $objectToArray: { $ifNull: ['$pagamentos.tags', {}] } } } },
    { $unwind: '$tagsArr' },
    { $match: match },
    { $limit: 1 }
  ]);
  return resultado.length > 0;
}

/** Vinculada se algum pagamento tem esse tagId no array de valores de alguma categoria. */
async function tagEstaVinculada(tagId, usuarioId) {
  return algumPagamentoTemTagOuCategoria(usuarioId, { 'tagsArr.v': String(tagId) });
}

/**
 * Vinculada se: (a) existe alguma Tag cadastrada nessa categoria (ainda que
 * não usada em nenhuma transação — excluir a categoria quebraria essas tags),
 * OU (b) algum pagamento tem tags registradas sob essa categoria.
 */
async function categoriaEstaVinculada(categoriaId, usuarioId) {
  const temTag = await Tag.exists({ categoria: String(categoriaId), usuario: usuarioId });
  if (temTag) return true;
  return algumPagamentoTemTagOuCategoria(usuarioId, { 'tagsArr.k': String(categoriaId) });
}

module.exports = { tagEstaVinculada, categoriaEstaVinculada };
