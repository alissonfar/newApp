// src/reportEngine/index.js
const { fetchFilteredTransactions } = require('./filterService');
const { processWithRules } = require('./ruleEngine');
const { aggregate } = require('./aggregator');
const { getTemplate, listTemplates } = require('./reportTemplates');
const Tag = require('../models/tag');
const ModeloRelatorio = require('../models/modeloRelatorio');

/**
 * Converte regras do modelo (tag ObjectId + effect) para formato do ruleEngine (tagId + effect).
 */
function modelRulesToEngineRules(regras) {
  if (!Array.isArray(regras)) return [];
  return regras.map((r) => {
    const tagRef = r.tag;
    const tagId = tagRef?._id ? tagRef._id.toString() : (tagRef?.toString ? tagRef.toString() : tagRef);
    return tagId ? { tagId, effect: r.effect || 'add' } : null;
  }).filter(Boolean);
}

/**
 * Gera relatório avançado: filtra, aplica regras, agrega.
 * @param {Object} options
 * @param {string} options.templateId - id do template (simples, devedor, ou modelo-{id})
 * @param {Object} options.filters - filtros (dataInicio, dataFim, tipo, pessoas, excludePessoas, tagsFilter, search, sortBy, sortDir)
 * @param {string} options.userId - ID do usuário
 * @returns {Promise<{ rows, summary, filterDetails, templateUsed }>}
 */
async function generateReport({ templateId, filters, userId }) {
  let template;

  if (templateId && templateId.startsWith('modelo-')) {
    const modeloId = templateId.replace('modelo-', '');
    const modelo = await ModeloRelatorio.findOne({
      _id: modeloId,
      usuario: userId,
      ativo: true
    }).populate('regras.tag');
    if (!modelo) {
      throw new Error('Modelo de relatório não encontrado.');
    }
    template = {
      id: templateId,
      name: modelo.nome,
      rules: modelRulesToEngineRules(modelo.regras),
      aggregation: modelo.aggregation || 'default'
    };
  } else {
    template = getTemplate(templateId);
  }

  const filterDetails = { ...filters };

  const transacoes = await fetchFilteredTransactions(filters, userId);

  const tags = await Tag.find({ usuario: userId, ativo: true }).lean();

  const rows = processWithRules(transacoes, template.rules, tags, filters);

  const summary = aggregate(rows, template.aggregation);

  return {
    rows,
    summary,
    filterDetails,
    templateUsed: template.id,
    templateName: template.name
  };
}

/**
 * Lista templates built-in + modelos do usuário.
 * @param {string} userId
 * @returns {Promise<Array>} templates com id, name, aggregation
 */
async function listTemplatesWithModels(userId) {
  const builtIn = listTemplates();
  const modelos = await ModeloRelatorio.find({ usuario: userId, ativo: true })
    .sort({ nome: 1 })
    .select('nome descricao aggregation regras');
  const modeloTemplates = modelos.map((m) => ({
    id: `modelo-${m._id}`,
    name: m.nome,
    descricao: m.descricao,
    aggregation: m.aggregation,
    rules: m.regras,
    isModelo: true
  }));
  return [...builtIn, ...modeloTemplates];
}

module.exports = {
  generateReport,
  getTemplate,
  listTemplates,
  listTemplatesWithModels
};
