// src/services/settlementService.js
const mongoose = require('mongoose');
const Settlement = require('../models/settlement');
const Transacao = require('../models/transacao');
const Tag = require('../models/tag');
const Usuario = require('../models/usuarios');

const TRANSACTION_REPLICA_SET_MSG =
  'Transações MongoDB requerem replica set. Execute rs.initiate() no mongosh após subir o container.';

/**
 * Inicia sessão e transação MongoDB. Lança erro claro se o ambiente não suportar transactions.
 */
async function startTransactionSession() {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    return session;
  } catch (err) {
    session.endSession().catch(() => {});
    const msg = (err && err.message) || '';
    if (
      msg.includes('replica set') ||
      msg.includes('Transaction numbers') ||
      (err.code && [251, 263].includes(err.code))
    ) {
      throw new Error(`${TRANSACTION_REPLICA_SET_MSG} Detalhe: ${msg}`);
    }
    throw err;
  }
}

/**
 * Converte pagamento (possivelmente Mongoose subdocument) para objeto plano.
 */
function toPlainPagamento(p) {
  if (!p) return { pessoa: 'Titular', valor: 0, tags: {} };
  const po = p.toObject ? p.toObject() : { pessoa: p.pessoa, valor: p.valor, tags: p.tags };
  return {
    pessoa: po.pessoa,
    valor: po.valor,
    tags: po.tags && typeof po.tags === 'object' ? JSON.parse(JSON.stringify(po.tags)) : {}
  };
}

/**
 * Aplica tag em todos os pagamentos de uma transação.
 * Estrutura: pagamentos[].tags = { [categoriaId]: [tagId, ...] }
 * A chave categoriaId deve ser o _id da categoria (string). O valor é array de tag IDs (strings).
 */
function aplicarTagEmPagamentos(pagamentos, tag) {
  if (!pagamentos || !Array.isArray(pagamentos) || pagamentos.length === 0 || !tag) return pagamentos;

  const categoriaId = (tag.categoria && tag.categoria.toString)
    ? tag.categoria.toString()
    : (tag.categoria ? String(tag.categoria) : null);
  const tagIdStr = (tag._id && tag._id.toString) ? tag._id.toString() : String(tag._id);

  if (!categoriaId) {
    throw new Error(`Tag "${tag.nome || tagIdStr}" não possui categoria definida. Não é possível aplicar.`);
  }

  return pagamentos.map((p) => {
    const po = toPlainPagamento(p);
    const tagsAtuais = po.tags || {};
    const arr = Array.isArray(tagsAtuais[categoriaId]) ? [...tagsAtuais[categoriaId]] : [];
    const tagIdNormalized = tagIdStr;
    if (!arr.some((id) => String(id) === tagIdNormalized)) {
      arr.push(tagIdNormalized);
    }
    tagsAtuais[categoriaId] = arr;
    return { pessoa: po.pessoa, valor: po.valor, tags: tagsAtuais };
  });
}

/**
 * Remove tag de todos os pagamentos de uma transação.
 */
function removerTagDePagamentos(pagamentos, tagId) {
  if (!pagamentos || !Array.isArray(pagamentos) || !tagId) return pagamentos;
  const tagIdStr = (tagId && tagId.toString) ? tagId.toString() : String(tagId);

  return pagamentos.map((p) => {
    const po = toPlainPagamento(p);
    const tagsAtuais = po.tags ? JSON.parse(JSON.stringify(po.tags)) : {};
    for (const cat of Object.keys(tagsAtuais)) {
      if (Array.isArray(tagsAtuais[cat])) {
        tagsAtuais[cat] = tagsAtuais[cat].filter((id) => (id && id.toString ? id.toString() : String(id)) !== tagIdStr);
        if (tagsAtuais[cat].length === 0) delete tagsAtuais[cat];
      }
    }
    return { pessoa: po.pessoa, valor: po.valor, tags: tagsAtuais };
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

  const session = await startTransactionSession();

  try {
    const usuarioObj = await Usuario.findById(usuarioId).select('preferencias.proprietario').lean().session(session);
    const proprietario = usuarioObj?.preferencias?.proprietario?.trim() || 'Titular';

    const tag = await Tag.findOne({ _id: tagId, usuario: usuarioId, ativo: true })
      .select('_id nome categoria')
      .lean()
      .session(session);
    if (!tag) {
      throw new Error('Tag não encontrada ou inativa.');
    }
    if (!tag.categoria) {
      throw new Error(`A tag "${tag.nome || tagId}" não possui categoria. Configure a tag corretamente antes de usar na conciliação.`);
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
      tipo: 'gasto',
      $or: [{ settlementApplied: null }, { settlementApplied: { $exists: false } }]
    }).session(session);

    if (transacoesAlvo.length !== appliedTransactionIds.length) {
      throw new Error('Uma ou mais transações não foram encontradas, não são gastos ativos ou já foram quitadas em outra conciliação.');
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

    const bulkOps = transacoesAlvo.map((t) => {
      const pagamentosPlain = (t.pagamentos || []).map(toPlainPagamento);
      const pagamentosAtualizados = aplicarTagEmPagamentos(pagamentosPlain, tag);
      return {
        updateOne: {
          filter: { _id: t._id },
          update: { $set: { pagamentos: pagamentosAtualizados, settlementApplied: settlement._id } },
          session
        }
      };
    });
    if (bulkOps.length > 0) {
      const bulkResult = await Transacao.bulkWrite(bulkOps, { session });
      if (bulkResult.matchedCount !== transacoesAlvo.length) {
        throw new Error(`Falha ao aplicar tag: apenas ${bulkResult.matchedCount} de ${transacoesAlvo.length} transações foram atualizadas.`);
      }
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
    try {
      await session.abortTransaction();
    } catch (abortErr) {
      console.error('[Settlement criar] Erro ao abortar transação:', abortErr?.message, abortErr?.code);
    }
    console.error('[Settlement criar] Erro:', err?.message, 'code:', err?.code);
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Exclui um settlement e reverte todas as alterações.
 */
async function excluir(settlementId, usuarioId) {
  const session = await startTransactionSession();

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
    const excluirBulkOps = [];
    for (const app of settlement.appliedTransactions) {
      const transacao = await Transacao.findById(app.transactionId).session(session);
      if (transacao && transacao.pagamentos && transacao.pagamentos.length > 0) {
        const pagamentosPlain = transacao.pagamentos.map(toPlainPagamento);
        const pagamentosAtualizados = removerTagDePagamentos(pagamentosPlain, tagIdToRemove);
        excluirBulkOps.push({
          updateOne: {
            filter: { _id: app.transactionId },
            update: { $set: { pagamentos: pagamentosAtualizados, settlementApplied: null } },
            session
          }
        });
      }
    }
    if (excluirBulkOps.length > 0) {
      await Transacao.bulkWrite(excluirBulkOps, { session });
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
    try {
      await session.abortTransaction();
    } catch (abortErr) {
      console.error('[Settlement excluir] Erro ao abortar transação:', abortErr?.message, abortErr?.code);
    }
    console.error('[Settlement excluir] Erro:', err?.message, 'code:', err?.code);
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
  const match = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    status: 'ativo',
    tipo: 'gasto',
    $or: [{ settlementApplied: null }, { settlementApplied: { $exists: false } }]
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
  return transacoes;
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
    .populate('receivingTransactionId', 'descricao valor data pagamentos')
    .populate('tagId', 'nome codigo cor icone')
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
