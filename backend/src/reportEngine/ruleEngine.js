// src/reportEngine/ruleEngine.js
const { TagEffect } = require('./types');

/**
 * Achata transações em linhas (uma por pagamento).
 * @param {Array} transacoes
 * @returns {Array} linhas com id, data, tipo, descricao, valor, pessoa, valorPagamento, tagsPagamento
 */
function flattenTransactions(transacoes) {
  const flattened = [];
  (transacoes || []).forEach((tr) => {
    const id = tr.id || tr._id;
    if (!tr.pagamentos || tr.pagamentos.length === 0) {
      flattened.push({
        id,
        data: tr.data,
        tipo: tr.tipo,
        descricao: tr.descricao,
        valor: tr.valor,
        pessoa: null,
        valorPagamento: 0,
        tagsPagamento: {}
      });
    } else {
      tr.pagamentos.forEach((p) => {
        flattened.push({
          id,
          data: tr.data,
          tipo: tr.tipo,
          descricao: tr.descricao,
          valor: tr.valor,
          pessoa: p.pessoa,
          valorPagamento: p.valor,
          tagsPagamento: p.tags || {}
        });
      });
    }
  });
  return flattened;
}

/**
 * Cria mapa tagId -> tag e tagNome (normalizado) -> tag para resolução.
 * @param {Array} tags - lista de tags do usuário
 * @returns {Object} { byId, byNome }
 */
function buildTagLookup(tags) {
  const byId = {};
  const byNome = {};
  (tags || []).forEach((tag) => {
    const tid = tag._id?.toString ? tag._id.toString() : tag._id;
    byId[tid] = tag;
    const nome = (tag.nome || '').toUpperCase().trim();
    if (nome) byNome[nome] = tag;
    const codigo = (tag.codigo || '').toUpperCase().trim();
    if (codigo) byNome[codigo] = tag;
  });
  return { byId, byNome };
}

/**
 * Verifica se o pagamento tem alguma das tags indicadas.
 * tagsPagamento = { categoriaId: [tagId1, tagId2] }
 * @param {Object} tagsPagamento
 * @param {Array} tagIds - IDs das tags a verificar
 * @returns {boolean}
 */
function paymentHasAnyTag(tagsPagamento, tagIds) {
  if (!tagsPagamento || !tagIds || tagIds.length === 0) return false;
  for (const arr of Object.values(tagsPagamento)) {
    if (!Array.isArray(arr)) continue;
    for (const tid of arr) {
      const sid = tid?.toString ? tid.toString() : tid;
      if (tagIds.includes(sid)) return true;
    }
  }
  return false;
}

/**
 * Verifica se o pagamento atende ao filtro de tags (tagsFilter).
 * tagsFilter = { categoriaId: [tagId1, tagId2], ... } - para cada categoria, o pagamento deve ter pelo menos uma das tags
 * @param {Object} tagsPagamento - tags do pagamento
 * @param {Object} tagsFilter - filtro por categoria/tags
 * @returns {boolean}
 */
function rowMatchesTagsFilter(tagsPagamento, tagsFilter) {
  if (!tagsFilter || typeof tagsFilter !== 'object') return true;
  for (const [categoriaId, tagIds] of Object.entries(tagsFilter)) {
    if (!Array.isArray(tagIds) || tagIds.length === 0) continue;
    const catTags = tagsPagamento?.[categoriaId];
    if (!Array.isArray(catTags)) return false;
    const tagIdsStr = tagIds.map(t => t?.toString ? t.toString() : t);
    const hasMatch = catTags.some(ct => {
      const ctStr = ct?.toString ? ct.toString() : ct;
      return tagIdsStr.includes(ctStr);
    });
    if (!hasMatch) return false;
  }
  return true;
}

/**
 * Aplica regras de TagBehavior às linhas.
 * Prioridade: primeira regra que bater.
 * Sem regra explícita -> effect: 'add'
 * @param {Array} rows - linhas do flatten
 * @param {Array} rules - TagBehavior[] com tagNome ou tagCodigo
 * @param {Array} tags - lista de tags do usuário
 * @returns {Array} rows com { ...row, effect: 'add'|'subtract'|'ignore' }
 */
function applyRules(rows, rules, tags) {
  const { byId, byNome } = buildTagLookup(tags);

  // Resolver regras: tagId/tag (ObjectId)/tagNome/tagCodigo -> tagIds
  const resolvedRules = (rules || []).map((r) => {
    let tagIds = [];
    if (r.tagId) {
      tagIds = [r.tagId?.toString ? r.tagId.toString() : r.tagId];
    } else if (r.tag) {
      tagIds = [r.tag?.toString ? r.tag.toString() : r.tag];
    } else {
      const key = (r.tagNome || r.tagCodigo || '').toUpperCase().trim();
      const tag = byNome[key];
      tagIds = tag ? [tag._id?.toString ? tag._id.toString() : tag._id] : [];
    }
    return { ...r, tagIds };
  });

  return rows.map((row) => {
    let effect = TagEffect.ADD;
    for (const rule of resolvedRules) {
      if (rule.tagIds.length > 0 && paymentHasAnyTag(row.tagsPagamento, rule.tagIds)) {
        effect = rule.effect || TagEffect.ADD;
        break;
      }
    }
    return { ...row, effect };
  });
}

/**
 * Pipeline principal: flatten + apply rules.
 * @param {Array} transacoes
 * @param {Array} rules
 * @param {Array} tags
 * @param {Object} [filters] - filtros opcionais; filters.pessoas filtra por pessoa; filters.tagsFilter filtra por tags de pagamento
 * @returns {Array} rows com effect
 */
function processWithRules(transacoes, rules, tags, filters) {
  let flattened = flattenTransactions(transacoes);
  if (filters?.pessoas && (Array.isArray(filters.pessoas) ? filters.pessoas.length > 0 : filters.pessoas)) {
    const pessoasList = Array.isArray(filters.pessoas) ? filters.pessoas : [filters.pessoas];
    flattened = flattened.filter(row =>
      row.pessoa && pessoasList.some(p =>
        String(p).toLowerCase() === String(row.pessoa).toLowerCase()
      )
    );
  }
  if (filters?.tagsFilter && typeof filters.tagsFilter === 'object' && Object.keys(filters.tagsFilter).some(k => Array.isArray(filters.tagsFilter[k]) && filters.tagsFilter[k].length > 0)) {
    flattened = flattened.filter(row => rowMatchesTagsFilter(row.tagsPagamento, filters.tagsFilter));
  }
  if (!rules || rules.length === 0) {
    return flattened.map((r) => ({ ...r, effect: TagEffect.ADD }));
  }
  return applyRules(flattened, rules, tags);
}

module.exports = {
  flattenTransactions,
  buildTagLookup,
  applyRules,
  processWithRules
};
