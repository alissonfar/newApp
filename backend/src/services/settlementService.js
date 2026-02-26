// src/services/settlementService.js
const mongoose = require('mongoose');
const Settlement = require('../models/settlement');
const Transacao = require('../models/transacao');
const Tag = require('../models/tag');
const Usuario = require('../models/usuarios');

/**
 * Aplica tag em todos os pagamentos de uma transação.
 * Estrutura: pagamentos[].tags = { [categoriaId]: [tagId, ...] }
 */
function aplicarTagEmPagamentos(pagamentos, tag) {
  if (!pagamentos || !tag) return pagamentos;
  const categoriaId = (tag.categoria && tag.categoria.toString) ? tag.categoria.toString() : String(tag.categoria);
  const tagIdStr = (tag._id && tag._id.toString) ? tag._id.toString() : String(tag._id);

  return pagamentos.map(p => {
    const tagsAtuais = p.tags && typeof p.tags === 'object' ? { ...p.tags } : {};
    const arr = Array.isArray(tagsAtuais[categoriaId]) ? [...tagsAtuais[categoriaId]] : [];
    if (!arr.includes(tagIdStr)) arr.push(tagIdStr);
    tagsAtuais[categoriaId] = arr;
    return { ...p, tags: tagsAtuais };
  });
}

/**
 * Remove tag de todos os pagamentos de uma transação.
 */
function removerTagDePagamentos(pagamentos, tagId) {
  if (!pagamentos || !tagId) return pagamentos;
  const tagIdStr = (tagId && tagId.toString) ? tagId.toString() : String(tagId);

  return pagamentos.map(p => {
    const tagsAtuais = p.tags && typeof p.tags === 'object' ? { ...p.tags } : {};
    for (const cat of Object.keys(tagsAtuais)) {
      if (Array.isArray(tagsAtuais[cat])) {
        tagsAtuais[cat] = tagsAtuais[cat].filter(id => (id && id.toString ? id.toString() : String(id)) !== tagIdStr);
        if (tagsAtuais[cat].length === 0) delete tagsAtuais[cat];
      }
    }
    return { ...p, tags: tagsAtuais };
  });
}

/**
 * Cria um settlement (conciliação) com sessão transacional.
 * @param {Object} dados - { receivingTransactionId, appliedTransactionIds, tagId }
 * @param {string} usuarioId
 */
async function criar(dados, usuarioId) {
  const { receivingTransactionId, appliedTransactionIds, tagId } = dados;

  if (!receivingTransactionId || !appliedTransactionIds || !Array.isArray(appliedTransactionIds) || appliedTransactionIds.length === 0 || !tagId) {
    throw new Error('Campos obrigatórios: receivingTransactionId, appliedTransactionIds (array não vazio), tagId.');
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const usuarioObj = await Usuario.findById(usuarioId).select('preferencias.proprietario').lean().session(session);
    const proprietario = usuarioObj?.preferencias?.proprietario?.trim() || 'Titular';

    const tag = await Tag.findOne({ _id: tagId, usuario: usuarioId, ativo: true }).lean().session(session);
    if (!tag) {
      throw new Error('Tag não encontrada ou inativa.');
    }

    const transacaoRecebimento = await Transacao.findOne({
      _id: receivingTransactionId,
      usuario: usuarioId,
      status: 'ativo',
      tipo: 'recebivel'
    }).session(session);

    if (!transacaoRecebimento) {
      throw new Error('Transação de recebimento não encontrada ou inválida.');
    }

    if (transacaoRecebimento.settlementAsSource) {
      throw new Error('Esta transação de recebimento já foi utilizada em uma conciliação.');
    }

    const valorRecebimento = Math.abs(parseFloat(transacaoRecebimento.valor) || 0);

    const transacoesAlvo = await Transacao.find({
      _id: { $in: appliedTransactionIds },
      usuario: usuarioId,
      status: 'ativo',
      tipo: 'gasto'
    }).session(session);

    if (transacoesAlvo.length !== appliedTransactionIds.length) {
      throw new Error('Uma ou mais transações não foram encontradas ou não são gastos ativos.');
    }

    const jaQuitadas = await Settlement.find({
      usuario: usuarioId,
      'appliedTransactions.transactionId': { $in: appliedTransactionIds }
    }).session(session);

    const idsQuitados = new Set();
    jaQuitadas.forEach(s => {
      s.appliedTransactions.forEach(a => idsQuitados.add(a.transactionId.toString()));
    });

    for (const t of transacoesAlvo) {
      if (idsQuitados.has(t._id.toString())) {
        throw new Error(`A transação "${t.descricao}" já foi quitada em outra conciliação.`);
      }
    }

    const appliedTransactions = transacoesAlvo.map(t => ({
      transactionId: t._id,
      amountApplied: Math.abs(parseFloat(t.valor) || 0)
    }));

    const totalApplied = appliedTransactions.reduce((s, a) => s + a.amountApplied, 0);

    if (totalApplied > valorRecebimento) {
      throw new Error('O total das transações selecionadas excede o valor do recebimento.');
    }

    const leftoverAmount = Math.round((valorRecebimento - totalApplied) * 100) / 100;

    const settlement = new Settlement({
      usuario: usuarioId,
      receivingTransactionId,
      appliedTransactions,
      tagId,
      totalApplied,
      leftoverAmount: leftoverAmount > 0 ? leftoverAmount : 0,
      leftoverTransactionId: null
    });

    await settlement.save({ session });

    await Transacao.updateOne(
      { _id: receivingTransactionId },
      { $set: { settlementAsSource: settlement._id } },
      { session }
    );

    for (const t of transacoesAlvo) {
      const pagamentosAtualizados = aplicarTagEmPagamentos(t.pagamentos, tag);
      await Transacao.updateOne(
        { _id: t._id },
        { $set: { pagamentos: pagamentosAtualizados } },
        { session }
      );
    }

    let leftoverTransactionId = null;
    if (leftoverAmount > 0) {
      const dataRecebimento = transacaoRecebimento.data instanceof Date
        ? transacaoRecebimento.data
        : new Date(transacaoRecebimento.data);
      const transacaoSobra = new Transacao({
        tipo: 'recebivel',
        descricao: `Sobra do recebimento: ${transacaoRecebimento.descricao}`,
        valor: leftoverAmount,
        data: dataRecebimento,
        observacao: `Sobra da conciliação #${settlement._id}`,
        pagamentos: [{ pessoa: proprietario, valor: leftoverAmount, tags: {} }],
        usuario: usuarioId,
        settlementLeftoverFrom: settlement._id
      });
      await transacaoSobra.save({ session });
      leftoverTransactionId = transacaoSobra._id;

      await Settlement.updateOne(
        { _id: settlement._id },
        { $set: { leftoverTransactionId, leftoverAmount } },
        { session }
      );
    }

    await session.commitTransaction();

    const settlementPopulado = await Settlement.findById(settlement._id)
      .populate('receivingTransactionId', 'descricao valor data')
      .populate('tagId', 'nome codigo')
      .populate('appliedTransactions.transactionId', 'descricao valor data')
      .lean();

    return { ...settlementPopulado, leftoverTransactionId };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Exclui um settlement e reverte todas as alterações.
 */
async function excluir(settlementId, usuarioId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const settlement = await Settlement.findOne({
      _id: settlementId,
      usuario: usuarioId
    }).populate('tagId').session(session);

    if (!settlement) {
      throw new Error('Conciliação não encontrada.');
    }

    await Transacao.updateOne(
      { _id: settlement.receivingTransactionId },
      { $set: { settlementAsSource: null } },
      { session }
    );

    const tagIdToRemove = settlement.tagId?._id || settlement.tagId;
    for (const app of settlement.appliedTransactions) {
      const transacao = await Transacao.findById(app.transactionId).session(session);
      if (transacao && transacao.pagamentos) {
        const pagamentosAtualizados = removerTagDePagamentos(transacao.pagamentos, tagIdToRemove);
        await Transacao.updateOne(
          { _id: app.transactionId },
          { $set: { pagamentos: pagamentosAtualizados } },
          { session }
        );
      }
    }

    if (settlement.leftoverTransactionId) {
      await Transacao.updateOne(
        { _id: settlement.leftoverTransactionId },
        { $set: { status: 'estornado' } },
        { session }
      );
    }

    await Settlement.deleteOne({ _id: settlementId }).session(session);

    await session.commitTransaction();
    return { mensagem: 'Conciliação excluída com sucesso.' };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Lista transações recebíveis que podem ser usadas como recebimento (ainda não conciliadas).
 */
async function listarRecebimentosDisponiveis(usuarioId, filtros = {}) {
  const match = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    status: 'ativo',
    tipo: 'recebivel',
    $or: [{ settlementAsSource: null }, { settlementAsSource: { $exists: false } }]
  };

  if (filtros.dataInicio || filtros.dataFim) {
    match.data = {};
    if (filtros.dataInicio) match.data.$gte = new Date(filtros.dataInicio + 'T00:00:00.000Z');
    if (filtros.dataFim) match.data.$lte = new Date(filtros.dataFim + 'T23:59:59.999Z');
  }

  const transacoes = await Transacao.find(match).sort({ data: -1 }).limit(100).lean();
  return transacoes;
}

/**
 * Lista transações de gastos pendentes (não quitadas) para um filtro.
 * São gastos que foram pagos por terceiros e que serão marcados como quitados.
 * @param {Object} filtros.excludeTransactionId - ID da transação a excluir (ex: recebimento selecionado)
 */
async function listarPendentes(usuarioId, filtros = {}) {
  const idsQuitados = await Settlement.aggregate([
    { $match: { usuario: new mongoose.Types.ObjectId(usuarioId) } },
    { $unwind: '$appliedTransactions' },
    { $group: { _id: null, ids: { $addToSet: '$appliedTransactions.transactionId' } } },
    { $project: { ids: 1, _id: 0 } }
  ]);

  const idsQuitadosSet = new Set((idsQuitados[0]?.ids || []).map(id => id.toString()));

  const match = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    status: 'ativo',
    tipo: 'gasto'
  };

  if (filtros.pessoa) {
    match['pagamentos.pessoa'] = new RegExp('^' + filtros.pessoa + '$', 'i');
  }
  if (filtros.pessoas && Array.isArray(filtros.pessoas) && filtros.pessoas.length > 0) {
    match['pagamentos.pessoa'] = { $in: filtros.pessoas };
  }
  if (filtros.dataInicio || filtros.dataFim) {
    match.data = {};
    if (filtros.dataInicio) match.data.$gte = new Date(filtros.dataInicio + 'T00:00:00.000Z');
    if (filtros.dataFim) match.data.$lte = new Date(filtros.dataFim + 'T23:59:59.999Z');
  }

  if (filtros.excludeTransactionId) {
    match._id = { $ne: new mongoose.Types.ObjectId(filtros.excludeTransactionId) };
  }

  const transacoes = await Transacao.find(match).sort({ data: -1 }).limit(500).lean();

  return transacoes.filter(t => !idsQuitadosSet.has(t._id.toString()));
}

/**
 * Lista settlements do usuário.
 */
async function listar(usuarioId, opts = {}) {
  const page = opts.page || 1;
  const limit = Math.min(opts.limit || 20, 50);
  const skip = (page - 1) * limit;

  const settlements = await Settlement.find({ usuario: usuarioId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('receivingTransactionId', 'descricao valor data')
    .populate('tagId', 'nome codigo')
    .populate('appliedTransactions.transactionId', 'descricao valor data')
    .populate('leftoverTransactionId', 'descricao valor')
    .lean();

  const total = await Settlement.countDocuments({ usuario: usuarioId });

  return {
    items: settlements,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

module.exports = {
  criar,
  excluir,
  listarRecebimentosDisponiveis,
  listarPendentes,
  listar,
  aplicarTagEmPagamentos,
  removerTagDePagamentos
};
