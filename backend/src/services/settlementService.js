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
 * Remove tag de um único pagamento. Retorna o pagamento atualizado e se a tag foi removida.
 * @returns {{ pagamentoAtualizado: Object, foiRemovido: boolean }}
 */
function removerTagDePagamentoUnico(pagamento, tagId) {
  if (!pagamento || !tagId) return { pagamentoAtualizado: toPlainPagamento(pagamento), foiRemovido: false };
  const po = toPlainPagamento(pagamento);
  const tagsAtuais = po.tags ? JSON.parse(JSON.stringify(po.tags)) : {};
  const tagIdStr = (tagId && tagId.toString) ? tagId.toString() : String(tagId);
  let foiRemovido = false;
  for (const cat of Object.keys(tagsAtuais)) {
    if (Array.isArray(tagsAtuais[cat])) {
      const antes = tagsAtuais[cat].length;
      tagsAtuais[cat] = tagsAtuais[cat].filter((id) => (id && id.toString ? id.toString() : String(id)) !== tagIdStr);
      if (tagsAtuais[cat].length < antes) foiRemovido = true;
      if (tagsAtuais[cat].length === 0) delete tagsAtuais[cat];
    }
  }
  return {
    pagamentoAtualizado: { pessoa: po.pessoa, valor: po.valor, tags: tagsAtuais },
    foiRemovido
  };
}

/**
 * Aplica tag apenas no pagamento no índice indicado.
 * Estrutura: pagamentos[].tags = { [categoriaId]: [tagId, ...] }
 */
function aplicarTagEmPagamentoPorIndice(pagamentos, tag, indice) {
  if (!pagamentos || !Array.isArray(pagamentos) || indice < 0 || indice >= pagamentos.length || !tag) return pagamentos;
  const categoriaId = (tag.categoria && tag.categoria.toString)
    ? tag.categoria.toString()
    : (tag.categoria ? String(tag.categoria) : null);
  const tagIdStr = (tag._id && tag._id.toString) ? tag._id.toString() : String(tag._id);
  if (!categoriaId) {
    throw new Error(`Tag "${tag.nome || tagIdStr}" não possui categoria definida. Não é possível aplicar.`);
  }
  const resultado = pagamentos.map((p, i) => {
    const po = toPlainPagamento(p);
    if (i !== indice) return po;
    const tagsAtuais = po.tags || {};
    const arr = Array.isArray(tagsAtuais[categoriaId]) ? [...tagsAtuais[categoriaId]] : [];
    if (!arr.some((id) => String(id) === tagIdStr)) arr.push(tagIdStr);
    tagsAtuais[categoriaId] = arr;
    return { pessoa: po.pessoa, valor: po.valor, tags: tagsAtuais };
  });
  return resultado;
}

/**
 * Cria um settlement (conciliação) com sessão transacional.
 * @param {Object} dados - { receivingTransactionId, appliedTransactionIds?, appliedPayments?, tagId, removeTagId? }
 *   - appliedTransactionIds: array de IDs (transação inteira, retrocompatível)
 *   - appliedPayments: array de { transactionId, pagamentoIndex?, amountApplied } (conciliação por pagamento)
 * @param {string} usuarioId
 */
async function criar(dados, usuarioId) {
  const { receivingTransactionId, appliedTransactionIds, appliedPayments, tagId, removeTagId } = dados;

  const useAppliedPayments = appliedPayments && Array.isArray(appliedPayments) && appliedPayments.length > 0;
  const useAppliedTransactionIds = appliedTransactionIds && Array.isArray(appliedTransactionIds) && appliedTransactionIds.length > 0;

  if (!receivingTransactionId || !tagId) {
    throw new Error('Campos obrigatórios: receivingTransactionId, tagId.');
  }
  if (!useAppliedPayments && !useAppliedTransactionIds) {
    throw new Error('Informe appliedTransactionIds ou appliedPayments (array não vazio).');
  }
  if (useAppliedPayments && useAppliedTransactionIds) {
    throw new Error('Informe apenas appliedTransactionIds ou appliedPayments, não ambos.');
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

    let removeTag = null;
    if (removeTagId) {
      removeTag = await Tag.findOne({ _id: removeTagId, usuario: usuarioId, ativo: true })
        .select('_id nome categoria')
        .lean()
        .session(session);
      if (!removeTag) {
        throw new Error('Tag para remover não encontrada ou inativa.');
      }
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

    let appliedTransactions;
    let transacoesParaAtualizar;
    let transacoesAlvo;
    const removedTagLog = [];

    if (useAppliedPayments) {
      const ids = [...new Set(appliedPayments.map((a) => a.transactionId?.toString()).filter(Boolean))];
      transacoesAlvo = await Transacao.find({
        _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
        usuario: usuarioId,
        status: 'ativo',
        tipo: 'gasto'
      }).session(session);

      if (transacoesAlvo.length !== ids.length) {
        throw new Error('Uma ou mais transações não foram encontradas ou não são gastos ativos.');
      }

      const transacaoMap = new Map(transacoesAlvo.map((t) => [t._id.toString(), t]));

      appliedTransactions = appliedPayments.map((ap) => ({
        transactionId: ap.transactionId,
        amountApplied: Math.abs(parseFloat(ap.amountApplied) || 0),
        pagamentoIndex: ap.pagamentoIndex != null ? parseInt(ap.pagamentoIndex, 10) : undefined
      }));

      const totalApplied = appliedTransactions.reduce((s, a) => s + a.amountApplied, 0);
      if (totalApplied > valorRecebimento) {
        throw new Error('O total das transações selecionadas excede o valor do recebimento.');
      }

      const updatesByTransaction = new Map();
      for (const ap of appliedPayments) {
        const t = transacaoMap.get(String(ap.transactionId));
        if (!t) continue;
        const tid = t._id;
        if (!updatesByTransaction.has(tid)) {
          updatesByTransaction.set(tid, { transactionId: tid, pagamentos: (t.pagamentos || []).map(toPlainPagamento) });
        }
        const entry = updatesByTransaction.get(tid);
        let pagamentosAtualizados = entry.pagamentos;
        const idx = ap.pagamentoIndex != null ? parseInt(ap.pagamentoIndex, 10) : -1;
        if (idx >= 0 && idx < pagamentosAtualizados.length) {
          pagamentosAtualizados = aplicarTagEmPagamentoPorIndice(pagamentosAtualizados, tag, idx);
          if (removeTagId && removeTag) {
            const { pagamentoAtualizado, foiRemovido } = removerTagDePagamentoUnico(pagamentosAtualizados[idx], removeTag._id);
            if (foiRemovido) {
              pagamentosAtualizados = pagamentosAtualizados.map((p, i) => (i === idx ? pagamentoAtualizado : p));
              removedTagLog.push({ transactionId: tid, payerIndex: idx });
            }
          }
        } else {
          pagamentosAtualizados = aplicarTagEmPagamentos(pagamentosAtualizados, tag);
          if (removeTagId && removeTag) {
            for (let i = 0; i < pagamentosAtualizados.length; i++) {
              const { pagamentoAtualizado, foiRemovido } = removerTagDePagamentoUnico(pagamentosAtualizados[i], removeTag._id);
              if (foiRemovido) {
                pagamentosAtualizados = pagamentosAtualizados.map((p, j) => (j === i ? pagamentoAtualizado : p));
                removedTagLog.push({ transactionId: tid, payerIndex: i });
              }
            }
          }
        }
        entry.pagamentos = pagamentosAtualizados;
      }
      transacoesParaAtualizar = [...updatesByTransaction.values()].map((e) => ({
        transactionId: e.transactionId,
        pagamentosAtualizados: e.pagamentos
      }));
    } else {
      transacoesAlvo = await Transacao.find({
        _id: { $in: appliedTransactionIds },
        usuario: usuarioId,
        status: 'ativo',
        tipo: 'gasto',
        $or: [{ settlementApplied: null }, { settlementApplied: { $exists: false } }]
      }).session(session);

      if (transacoesAlvo.length !== appliedTransactionIds.length) {
        throw new Error('Uma ou mais transações não foram encontradas, não são gastos ativos ou já foram quitadas em outra conciliação.');
      }

      appliedTransactions = transacoesAlvo.map((t) => ({
        transactionId: t._id,
        amountApplied: Math.abs(parseFloat(t.valor) || 0)
      }));

      const totalApplied = appliedTransactions.reduce((s, a) => s + a.amountApplied, 0);
      if (totalApplied > valorRecebimento) {
        throw new Error('O total das transações selecionadas excede o valor do recebimento.');
      }

      transacoesParaAtualizar = transacoesAlvo.map((t) => {
        const pagamentosPlain = (t.pagamentos || []).map(toPlainPagamento);
        let pagamentosAtualizados = aplicarTagEmPagamentos(pagamentosPlain, tag);
        if (removeTagId && removeTag) {
          for (let payerIndex = 0; payerIndex < pagamentosAtualizados.length; payerIndex++) {
            const { pagamentoAtualizado, foiRemovido } = removerTagDePagamentoUnico(
              pagamentosAtualizados[payerIndex],
              removeTag._id
            );
            if (foiRemovido) {
              pagamentosAtualizados = pagamentosAtualizados.map((p, i) =>
                i === payerIndex ? pagamentoAtualizado : p
              );
              removedTagLog.push({ transactionId: t._id, payerIndex });
            }
          }
        }
        return { transactionId: t._id, pagamentosAtualizados };
      });
    }

    const leftoverAmount = Math.round((valorRecebimento - appliedTransactions.reduce((s, a) => s + a.amountApplied, 0)) * 100) / 100;

    const settlement = new Settlement({
      usuario: usuarioId,
      receivingTransactionId,
      appliedTransactions,
      tagId,
      removeTagId: removeTagId || undefined,
      removedTagLog,
      totalApplied: appliedTransactions.reduce((s, a) => s + a.amountApplied, 0),
      leftoverAmount: leftoverAmount > 0 ? leftoverAmount : 0,
      leftoverTransactionId: null
    });

    await settlement.save({ session });

    const setSettlementApplied = !useAppliedPayments;
    const bulkOps = transacoesParaAtualizar.map(({ transactionId, pagamentosAtualizados }) => {
      const update = { $set: { pagamentos: pagamentosAtualizados } };
      if (setSettlementApplied) {
        update.$set.settlementApplied = settlement._id;
      }
      return {
        updateOne: {
          filter: { _id: transactionId, usuario: usuarioId },
          update,
          session
        }
      };
    });

    await Transacao.updateOne(
      { _id: receivingTransactionId, usuario: usuarioId },
      { $set: { settlementAsSource: settlement._id } },
      { session }
    );
    if (bulkOps.length > 0) {
      const bulkResult = await Transacao.bulkWrite(bulkOps, { session });
      if (bulkResult.matchedCount !== transacoesParaAtualizar.length) {
        throw new Error(`Falha ao aplicar tag: apenas ${bulkResult.matchedCount} de ${transacoesParaAtualizar.length} transações foram atualizadas.`);
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
        { _id: settlement._id, usuario: usuarioId },
        { $set: { leftoverTransactionId, leftoverAmount } },
        { session }
      );
    }

    await session.commitTransaction();

    const settlementPopulado = await Settlement.findOne({ _id: settlement._id, usuario: usuarioId })
      .populate('receivingTransactionId', 'descricao valor data')
      .populate('tagId', 'nome codigo')
      .populate('removeTagId', 'nome codigo cor icone')
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
    })
      .populate('tagId')
      .populate('removeTagId')
      .session(session);

    if (!settlement) {
      throw new Error('Conciliação não encontrada.');
    }

    await Transacao.updateOne(
      { _id: settlement.receivingTransactionId, usuario: usuarioId },
      { $set: { settlementAsSource: null } },
      { session }
    );

    const tagIdToRemove = settlement.tagId?._id || settlement.tagId;
    const excluirBulkOps = [];
    for (const app of settlement.appliedTransactions) {
      const transacao = await Transacao.findOne({ _id: app.transactionId, usuario: usuarioId }).session(session);
      if (transacao && transacao.pagamentos && transacao.pagamentos.length > 0) {
        let pagamentosAtualizados = transacao.pagamentos.map(toPlainPagamento);
        const idx = app.pagamentoIndex;
        if (idx != null && idx >= 0 && idx < pagamentosAtualizados.length) {
          const [pagamentoAtualizado] = removerTagDePagamentos([pagamentosAtualizados[idx]], tagIdToRemove);
          pagamentosAtualizados = pagamentosAtualizados.map((p, i) => (i === idx ? pagamentoAtualizado : p));
        } else {
          pagamentosAtualizados = removerTagDePagamentos(pagamentosAtualizados, tagIdToRemove);
        }
        const update = { $set: { pagamentos: pagamentosAtualizados } };
        if (idx == null) {
          update.$set.settlementApplied = null;
        }
        excluirBulkOps.push({
          updateOne: {
            filter: { _id: app.transactionId, usuario: usuarioId },
            update,
            session
          }
        });
      }
    }
    if (excluirBulkOps.length > 0) {
      await Transacao.bulkWrite(excluirBulkOps, { session });
    }

    if (settlement.removeTagId && settlement.removedTagLog && settlement.removedTagLog.length > 0) {
      let tagParaRestaurar = null;
      const removeTag = settlement.removeTagId;
      if (removeTag && (removeTag._id || removeTag.categoria)) {
        tagParaRestaurar = { _id: removeTag._id || removeTag, categoria: removeTag.categoria, nome: removeTag.nome };
      } else if (removeTag) {
        const tagDoc = await Tag.findOne({ _id: removeTag, usuario: usuarioId }).select('_id categoria nome').lean().session(session);
        if (tagDoc) tagParaRestaurar = tagDoc;
      }
      if (tagParaRestaurar) {
        for (const entry of settlement.removedTagLog) {
          const transacao = await Transacao.findOne({ _id: entry.transactionId, usuario: usuarioId }).session(session);
          if (transacao && transacao.pagamentos && entry.payerIndex >= 0 && entry.payerIndex < transacao.pagamentos.length) {
            const pagamentosAtualizados = aplicarTagEmPagamentoPorIndice(
              transacao.pagamentos.map(toPlainPagamento),
              tagParaRestaurar,
              entry.payerIndex
            );
            await Transacao.updateOne(
              { _id: entry.transactionId, usuario: usuarioId },
              { $set: { pagamentos: pagamentosAtualizados } },
              { session }
            );
          }
        }
      }
    }

    if (settlement.leftoverTransactionId) {
      await Transacao.updateOne(
        { _id: settlement.leftoverTransactionId, usuario: usuarioId },
        { $set: { status: 'estornado' } },
        { session }
      );
    }

    await Settlement.deleteOne({ _id: settlementId, usuario: usuarioId }).session(session);

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
 * Quando há filtro de pessoa: projeta apenas os pagamentos que batem com o filtro e ajusta valor.
 * @param {Object} filtros.excludeTransactionId - ID da transação a excluir (ex: recebimento selecionado)
 */
async function listarPendentes(usuarioId, filtros = {}) {
  const match = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    status: 'ativo',
    tipo: 'gasto',
    $or: [{ settlementApplied: null }, { settlementApplied: { $exists: false } }]
  };

  const hasPessoaFilter = !!(filtros.pessoa || (filtros.pessoas && Array.isArray(filtros.pessoas) && filtros.pessoas.length > 0));

  if (filtros.pessoa) {
    match['pagamentos.pessoa'] = new RegExp('^' + String(filtros.pessoa).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
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

  if (!hasPessoaFilter) {
    const transacoes = await Transacao.find(match).sort({ data: -1 }).limit(500).lean();
    return transacoes;
  }

  const pessoasFilter = filtros.pessoa
    ? [String(filtros.pessoa).trim()].filter(Boolean)
    : (filtros.pessoas || []).filter(Boolean);
  if (pessoasFilter.length === 0) {
    const transacoes = await Transacao.find(match).sort({ data: -1 }).limit(500).lean();
    return transacoes;
  }

  const pessoasLower = pessoasFilter.map((p) => (p || '').toLowerCase());
  const filterCond =
    pessoasLower.length === 1
      ? { $eq: [{ $toLower: { $ifNull: ['$$item.pessoa', ''] } }, pessoasLower[0]] }
      : { $in: [{ $toLower: { $ifNull: ['$$item.pessoa', ''] } }, pessoasLower] };

  const pipeline = [
    { $match: match },
    {
      $addFields: {
        pagamentosComIndice: {
          $map: {
            input: { $range: [0, { $size: { $ifNull: ['$pagamentos', []] } }] },
            as: 'i',
            in: {
              pagamentoIndex: { $toInt: '$$i' },
              pessoa: { $arrayElemAt: ['$pagamentos.pessoa', '$$i'] },
              valor: { $arrayElemAt: ['$pagamentos.valor', '$$i'] },
              tags: { $arrayElemAt: ['$pagamentos.tags', '$$i'] }
            }
          }
        }
      }
    },
    {
      $addFields: {
        pagamentosFiltrados: {
          $filter: {
            input: '$pagamentosComIndice',
            as: 'item',
            cond: filterCond
          }
        }
      }
    },
    { $match: { $expr: { $gt: [{ $size: '$pagamentosFiltrados' }, 0] } } },
    {
      $addFields: {
        pagamentos: {
          $map: {
            input: '$pagamentosFiltrados',
            as: 'pf',
            in: {
              pessoa: '$$pf.pessoa',
              valor: '$$pf.valor',
              tags: { $ifNull: ['$$pf.tags', {}] }
            }
          }
        },
        valor: { $sum: '$pagamentosFiltrados.valor' },
        pagamentoIndices: '$pagamentosFiltrados.pagamentoIndex'
      }
    },
    { $project: { pagamentosFiltrados: 0, pagamentosComIndice: 0 } },
    { $sort: { data: -1 } },
    { $limit: 500 }
  ];

  let transacoes = await Transacao.aggregate(pipeline);

  const reconciledPairs = await Settlement.find({ usuario: usuarioId })
    .select('appliedTransactions.transactionId appliedTransactions.pagamentoIndex')
    .lean();
  const reconciledSet = new Set();
  for (const s of reconciledPairs) {
    for (const at of s.appliedTransactions || []) {
      if (at.transactionId && at.pagamentoIndex != null) {
        reconciledSet.add(`${at.transactionId}-${at.pagamentoIndex}`);
      }
    }
  }
  if (reconciledSet.size > 0) {
    transacoes = transacoes.filter((t) => {
      const indices = t.pagamentoIndices || [];
      return !indices.some((idx) => reconciledSet.has(`${t._id}-${idx}`));
    });
  }

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
    .populate('removeTagId', 'nome codigo cor icone')
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
