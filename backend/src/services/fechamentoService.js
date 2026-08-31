// src/services/fechamentoService.js
const mongoose = require('mongoose');
const FechamentoCadastro = require('../models/fechamentoCadastro');
const FechamentoInstancia = require('../models/fechamentoInstancia');
const Pessoa = require('../models/pessoa');
const ModeloRelatorio = require('../models/modeloRelatorio');
const Tag = require('../models/tag');
const Transacao = require('../models/transacao');
const Settlement = require('../models/settlement');
const { addContabilizavelCondition } = require('../utils/transacaoContabilizavel');
const { processWithRules } = require('../reportEngine/ruleEngine');
const { aggregate } = require('../reportEngine/aggregator');

const STATUS_MANUAL = ['aberto', 'enviado', 'aguardando_recebimento'];

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Converte regras do modelo (tag ObjectId populado + effect) para o formato do ruleEngine.
 * Duplicado propositalmente de `reportEngine/index.js` (função pequena, evita acoplar os dois
 * módulos por um detalhe de conversão).
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
 * Monta o $and de overlap de período: instância aparece se
 * [instancia.dataInicio, instancia.dataFim] tem interseção com [dataInicio, dataFim] do filtro.
 * Exportado para ser testável isoladamente (ver fechamentoService.test.js).
 */
function periodoOverlapMatch(dataInicioFiltro, dataFimFiltro) {
  const cond = [];
  if (dataFimFiltro) cond.push({ dataInicio: { $lte: new Date(dataFimFiltro + 'T23:59:59.999Z') } });
  if (dataInicioFiltro) cond.push({ dataFim: { $gte: new Date(dataInicioFiltro + 'T00:00:00.000Z') } });
  return cond.length > 0 ? { $and: cond } : {};
}

/**
 * Busca as transações de uma pessoa (por nome, case-insensitive) num período, aplica as regras
 * do modelo de relatório e agrega — reaproveita o reportEngine sem alterá-lo.
 */
async function buscarLinhasEResumo(usuarioId, pessoaNome, dataInicioStr, dataFimStr, modeloDoc) {
  const match = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    status: 'ativo',
    'pagamentos.pessoa': new RegExp('^' + escapeRegex(pessoaNome) + '$', 'i')
  };
  if (dataInicioStr || dataFimStr) {
    match.data = {};
    if (dataInicioStr) match.data.$gte = new Date(dataInicioStr + 'T00:00:00.000Z');
    if (dataFimStr) match.data.$lte = new Date(dataFimStr + 'T23:59:59.999Z');
  }
  addContabilizavelCondition(match);

  const transacoes = await Transacao.find(match).sort({ data: -1 }).lean();
  const tags = await Tag.find({ usuario: usuarioId, ativo: true }).lean();

  const regras = modeloDoc ? modelRulesToEngineRules(modeloDoc.regras) : [];
  const aggregationType = modeloDoc?.aggregation || 'default';

  const rows = processWithRules(transacoes, regras, tags, { pessoas: [pessoaNome] });
  const summary = aggregate(rows, aggregationType);

  return { rows, summary };
}

// --- Cadastros ---

async function listarCadastros(usuarioId) {
  return FechamentoCadastro.find({ usuario: usuarioId, ativo: true })
    .populate('pessoa', 'nome contato')
    .populate('modeloRelatorio', 'nome aggregation')
    .sort({ createdAt: -1 })
    .lean();
}

async function criarCadastro({ pessoa, modeloRelatorio }, usuarioId) {
  if (!pessoa || !modeloRelatorio) {
    throw new Error('Campos obrigatórios: pessoa, modeloRelatorio.');
  }

  const pessoaDoc = await Pessoa.findOne({ _id: pessoa, usuario: usuarioId, ativo: true });
  if (!pessoaDoc) throw new Error('Pessoa não encontrada.');

  const modeloDoc = await ModeloRelatorio.findOne({ _id: modeloRelatorio, usuario: usuarioId, ativo: true });
  if (!modeloDoc) throw new Error('Modelo de relatório não encontrado.');

  const existente = await FechamentoCadastro.findOne({ usuario: usuarioId, pessoa, ativo: true });
  if (existente) {
    return FechamentoCadastro.findOne({ _id: existente._id, usuario: usuarioId })
      .populate('pessoa', 'nome contato')
      .populate('modeloRelatorio', 'nome aggregation');
  }

  const cadastro = new FechamentoCadastro({ usuario: usuarioId, pessoa, modeloRelatorio, ativo: true });
  await cadastro.save();

  return FechamentoCadastro.findOne({ _id: cadastro._id, usuario: usuarioId })
    .populate('pessoa', 'nome contato')
    .populate('modeloRelatorio', 'nome aggregation');
}

module.exports = {
  STATUS_MANUAL,
  escapeRegex,
  modelRulesToEngineRules,
  periodoOverlapMatch,
  buscarLinhasEResumo,
  listarCadastros,
  criarCadastro
};
