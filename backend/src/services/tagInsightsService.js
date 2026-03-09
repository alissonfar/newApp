// src/services/tagInsightsService.js
const Tag = require('../models/tag');
const Transacao = require('../models/transacao');
const Categoria = require('../models/categoria');
const mongoose = require('mongoose');

/**
 * Calcula o total consolidado por tag para tags marcadas com mostrarNoDashboard.
 * Soma pagamento.valor onde pagamento.tags contém a tag, em transações ativas.
 *
 * Suporta múltiplos formatos de pagamentos.tags (retrocompatibilidade):
 * - Canônico: { categoriaId: [tagId, ...] }
 * - Legado: { categoriaNome: [tagCodigo, ...] }
 * - Importação JSON: { categoriaNome: [tagNome, ...] }
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
    // Normalizar categoriaId para string (tag.categoria pode ser ObjectId ou string)
    const categoriaId = (tag.categoria && tag.categoria.toString)
      ? tag.categoria.toString()
      : String(tag.categoria || '');

    const tagId = tag._id;
    // Valores possíveis no array: tagId, tagCodigo ou tagNome (importação JSON usa nomes)
    const tagValuesMatch = [
      tagId,
      tagId.toString(),
      tag.codigo,
      tag.nome
    ].filter(Boolean);

    // Buscar categoria para obter nome (formato legado: chave = nome da categoria)
    let categoriaNome = null;
    if (categoriaId && mongoose.Types.ObjectId.isValid(categoriaId) && String(new mongoose.Types.ObjectId(categoriaId)) === categoriaId) {
      const cat = await Categoria.findOne({ _id: categoriaId, usuario: userObjectId })
        .select('nome')
        .lean();
      categoriaNome = cat?.nome;
    } else {
      // tag.categoria pode ser o nome da categoria (string) em dados legados
      categoriaNome = categoriaId || null;
    }

    // $or: match formato canônico (categoriaId + tagId) OU formato legado (categoriaNome + tagId/codigo/nome)
    const $or = [];
    if (categoriaId) {
      $or.push({ ['pagamentos.tags.' + categoriaId]: { $in: tagValuesMatch } });
    }
    if (categoriaNome && categoriaNome !== categoriaId) {
      $or.push({ ['pagamentos.tags.' + categoriaNome]: { $in: tagValuesMatch } });
    }

    const matchStage = $or.length > 1 ? { $or } : ($or[0] || {});
    if (Object.keys(matchStage).length === 0) {
      resultados.push({
        tagId: tagId.toString(),
        nome: tag.nome,
        cor: tag.cor || '#6366f1',
        icone: tag.icone || 'tag',
        total: 0,
        quantidadePagamentos: 0
      });
      continue;
    }

    const pipeline = [
      {
        $match: {
          usuario: userObjectId,
          status: 'ativo'
        }
      },
      { $unwind: '$pagamentos' },
      { $match: matchStage },
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
