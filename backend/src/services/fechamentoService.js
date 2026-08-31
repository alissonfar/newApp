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

// 'recebido' é setado apenas por linkarRecebimento (efeito colateral do link com Settlement), nunca diretamente por atualizarStatus.
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

// --- Instâncias ---

async function obterInstanciaPopulada(id, usuarioId) {
  return FechamentoInstancia.findOne({ _id: id, usuario: usuarioId })
    .populate({
      path: 'cadastro',
      populate: [
        { path: 'pessoa', select: 'nome contato' },
        { path: 'modeloRelatorio', select: 'nome aggregation' }
      ]
    });
}

async function listarInstancias(usuarioId, { dataInicio, dataFim } = {}) {
  const match = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    ...periodoOverlapMatch(dataInicio, dataFim)
  };

  const instancias = await FechamentoInstancia.find(match)
    .sort({ dataInicio: -1 })
    .populate({
      path: 'cadastro',
      populate: [
        { path: 'pessoa', select: 'nome contato' },
        { path: 'modeloRelatorio', populate: { path: 'regras.tag' } }
      ]
    })
    .lean();

  const comResumo = await Promise.all(instancias.map(async (inst) => {
    const pessoaNome = inst.cadastro?.pessoa?.nome;
    if (!pessoaNome) {
      return { ...inst, resumo: { totalValue: '0.00', totalRows: 0 } };
    }
    const dInicio = inst.dataInicio.toISOString().slice(0, 10);
    const dFim = inst.dataFim.toISOString().slice(0, 10);
    const { summary } = await buscarLinhasEResumo(
      usuarioId, pessoaNome, dInicio, dFim, inst.cadastro.modeloRelatorio
    );
    return { ...inst, resumo: summary };
  }));

  return comResumo;
}

async function criarInstancia({ cadastro, pessoa, modeloRelatorio, dataInicio, dataFim }, usuarioId) {
  if (!dataInicio || !dataFim) {
    throw new Error('Campos obrigatórios: dataInicio, dataFim.');
  }

  let cadastroDoc;
  if (cadastro) {
    cadastroDoc = await FechamentoCadastro.findOne({ _id: cadastro, usuario: usuarioId, ativo: true });
    if (!cadastroDoc) throw new Error('Cadastro de Fechamento não encontrado.');
  } else {
    cadastroDoc = await criarCadastro({ pessoa, modeloRelatorio }, usuarioId);
  }

  const instancia = new FechamentoInstancia({
    usuario: usuarioId,
    cadastro: cadastroDoc._id,
    dataInicio: new Date(dataInicio + 'T00:00:00.000Z'),
    dataFim: new Date(dataFim + 'T23:59:59.999Z'),
    status: 'aberto'
  });
  await instancia.save();

  return obterInstanciaPopulada(instancia._id, usuarioId);
}

async function duplicarInstancia(id, usuarioId) {
  const original = await FechamentoInstancia.findOne({ _id: id, usuario: usuarioId });
  if (!original) throw new Error('Instância não encontrada.');

  const novaDataInicio = new Date(original.dataFim);
  novaDataInicio.setUTCDate(novaDataInicio.getUTCDate() + 1);
  novaDataInicio.setUTCHours(0, 0, 0, 0);

  const novaDataFim = new Date(novaDataInicio);
  novaDataFim.setUTCMonth(novaDataFim.getUTCMonth() + 1);
  novaDataFim.setUTCDate(novaDataFim.getUTCDate() - 1);
  novaDataFim.setUTCHours(23, 59, 59, 999);

  const nova = new FechamentoInstancia({
    usuario: usuarioId,
    cadastro: original.cadastro,
    dataInicio: novaDataInicio,
    dataFim: novaDataFim,
    status: 'aberto'
  });
  await nova.save();

  return obterInstanciaPopulada(nova._id, usuarioId);
}

async function obterTransacoesDaInstancia(id, usuarioId) {
  const instancia = await obterInstanciaPopulada(id, usuarioId);
  if (!instancia) throw new Error('Instância não encontrada.');

  const pessoaNome = instancia.cadastro?.pessoa?.nome;
  if (!pessoaNome) return { rows: [], summary: aggregate([], 'default') };

  const modeloDoc = await ModeloRelatorio.findOne({
    _id: instancia.cadastro.modeloRelatorio._id,
    usuario: usuarioId
  }).populate('regras.tag');

  const dInicio = instancia.dataInicio.toISOString().slice(0, 10);
  const dFim = instancia.dataFim.toISOString().slice(0, 10);
  return buscarLinhasEResumo(usuarioId, pessoaNome, dInicio, dFim, modeloDoc);
}

async function atualizarStatus(id, status, usuarioId) {
  if (!STATUS_MANUAL.includes(status)) {
    throw new Error(`Status inválido. Use um de: ${STATUS_MANUAL.join(', ')}.`);
  }
  const instancia = await FechamentoInstancia.findOne({ _id: id, usuario: usuarioId });
  if (!instancia) throw new Error('Instância não encontrada.');
  instancia.status = status;
  await instancia.save();
  return obterInstanciaPopulada(instancia._id, usuarioId);
}

async function linkarRecebimento(id, settlementId, usuarioId) {
  const instancia = await FechamentoInstancia.findOne({ _id: id, usuario: usuarioId }).populate({
    path: 'cadastro',
    populate: { path: 'pessoa', select: 'nome' }
  });
  if (!instancia) throw new Error('Instância não encontrada.');

  const settlement = await Settlement.findOne({ _id: settlementId, usuario: usuarioId })
    .populate('receivingTransactionId', 'pagamentos');
  if (!settlement) throw new Error('Conciliação (Settlement) não encontrada.');

  const pessoaNome = (instancia.cadastro?.pessoa?.nome || '').toLowerCase();
  const pagamentosRecebimento = settlement.receivingTransactionId?.pagamentos || [];
  // pagamentos.pessoa é nome livre, não FK — valida por nome case-insensitive, mesmo padrão de buscarLinhasEResumo.
  const bate = pagamentosRecebimento.some((p) => (p.pessoa || '').toLowerCase() === pessoaNome);
  if (!bate) {
    throw new Error('Esta conciliação não pertence a esta pessoa.');
  }

  instancia.settlementId = settlement._id;
  instancia.status = 'recebido';
  await instancia.save();

  return obterInstanciaPopulada(instancia._id, usuarioId);
}

async function excluirInstancia(id, usuarioId) {
  const instancia = await FechamentoInstancia.findOne({ _id: id, usuario: usuarioId });
  if (!instancia) throw new Error('Instância não encontrada.');
  await FechamentoInstancia.deleteOne({ _id: id, usuario: usuarioId });
  return { mensagem: 'Instância de Fechamento removida.' };
}

module.exports = {
  STATUS_MANUAL,
  escapeRegex,
  modelRulesToEngineRules,
  periodoOverlapMatch,
  buscarLinhasEResumo,
  listarCadastros,
  criarCadastro,
  obterInstanciaPopulada,
  listarInstancias,
  criarInstancia,
  duplicarInstancia,
  obterTransacoesDaInstancia,
  atualizarStatus,
  linkarRecebimento,
  excluirInstancia
};
