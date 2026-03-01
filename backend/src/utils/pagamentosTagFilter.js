/**
 * Utilitário para filtro granular de pagamentos por tags em pipelines MongoDB.
 * Usado em controladorTransacao e filterService para garantir que apenas pagamentos
 * que possuem as tags selecionadas sejam retornados (não toda a transação).
 *
 * tagsFilter = { categoriaId: [tagId1, tagId2], ... }
 * pagamentos[].tags = { categoriaId: [tagId1, tagId2], ... }
 */

/**
 * Constrói o estágio $addFields para filtrar pagamentos por tags.
 * Mantém apenas pagamentos cujas tags atendem a TODAS as categorias do tagsFilter.
 *
 * @param {Object} tagsFilter - { categoriaId: [tagId1, tagId2], ... }
 * @returns {Object|null} Estágio $addFields ou null se tagsFilter vazio/inválido
 */
function buildPagamentosTagFilterStage(tagsFilter) {
  if (!tagsFilter || typeof tagsFilter !== 'object') return null;

  const tagCondAnd = [];
  for (const [categoriaId, tagIds] of Object.entries(tagsFilter)) {
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      tagCondAnd.push({
        $gt: [
          {
            $size: {
              $setIntersection: [
                { $ifNull: ['$$p.tags.' + categoriaId, []] },
                { $literal: tagIds }
              ]
            }
          },
          0
        ]
      });
    }
  }

  if (tagCondAnd.length === 0) return null;

  const cond = tagCondAnd.length === 1 ? tagCondAnd[0] : { $and: tagCondAnd };

  return {
    $addFields: {
      pagamentos: {
        $filter: {
          input: { $ifNull: ['$pagamentos', []] },
          as: 'p',
          cond
        }
      }
    }
  };
}

/**
 * Verifica se tagsFilter está ativo e válido.
 * @param {Object} tagsFilter
 * @returns {boolean}
 */
function hasTagsFilter(tagsFilter) {
  if (!tagsFilter || typeof tagsFilter !== 'object') return false;
  return Object.entries(tagsFilter).some(
    ([, tagIds]) => Array.isArray(tagIds) && tagIds.length > 0
  );
}

module.exports = {
  buildPagamentosTagFilterStage,
  hasTagsFilter
};
