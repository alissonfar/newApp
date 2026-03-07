// src/services/tagInsightsService.js
const Tag = require('../models/tag');
const Transacao = require('../models/transacao');
const mongoose = require('mongoose');

/**
 * Calcula o total consolidado por tag para tags marcadas com mostrarNoDashboard.
 * Soma pagamento.valor onde pagamento.tags contém a tag, em transações ativas.
 *
 * @param {string} userId - ID do usuário
 * @returns {Promise<Array<{tagId: string, nome: string, total: number, quantidadePagamentos: number}>>}
 */
async function calcularTagInsights(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const tags = await Tag.find({
    usuario: userObjectId,
    ativo: true,
    mostrarNoDashboard: true
  }).lean();

  if (tags.length === 0) {
    return [];
  }

  const resultados = [];

  for (const tag of tags) {
    const categoriaId = tag.categoria;
    const tagId = tag._id;
    // Suportar tanto ObjectId quanto string armazenados em pagamentos.tags
    const tagIdsMatch = [tagId, tagId.toString()];

    const pipeline = [
      {
        $match: {
          usuario: userObjectId,
          status: 'ativo'
        }
      },
      { $unwind: '$pagamentos' },
      {
        $match: {
          ['pagamentos.tags.' + categoriaId]: { $in: tagIdsMatch }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$pagamentos.valor' },
          quantidadePagamentos: { $sum: 1 }
        }
      }
    ];

    const aggResult = await Transacao.aggregate(pipeline);

    const total = aggResult[0] ? aggResult[0].total : 0;
    const quantidadePagamentos = aggResult[0] ? aggResult[0].quantidadePagamentos : 0;

    resultados.push({
      tagId: tagId.toString(),
      nome: tag.nome,
      cor: tag.cor || '#6366f1',
      icone: tag.icone || 'tag',
      total: Math.round(total * 100) / 100,
      quantidadePagamentos
    });
  }

  resultados.sort((a, b) => b.total - a.total);

  return resultados;
}

module.exports = {
  calcularTagInsights
};
