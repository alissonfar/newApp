// src/services/vinculoService.js
const mongoose = require('mongoose');
const Decimal = require('decimal.js');
const VinculoConjunto = require('../models/vinculoConjunto');
const AcertoConjunto = require('../models/acertoConjunto');
const Transacao = require('../models/transacao');

const TRANSACTION_REPLICA_SET_MSG =
  'Transações MongoDB requerem replica set. Execute rs.initiate() no mongosh após subir o container.';

function toDecimal(v) {
  return new Decimal(v || 0);
}

function round2(n) {
  return toDecimal(n).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

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

const baseQueryPendentes = (vinculoId, usuarioId) => ({
  usuario: new mongoose.Types.ObjectId(usuarioId),
  'contaConjunta.ativo': true,
  'contaConjunta.vinculoId': new mongoose.Types.ObjectId(vinculoId),
  'contaConjunta.acertadoEm': null,
  status: 'ativo'
});

/**
 * Calcula total que o usuário deve (parteUsuario onde pagoPor=outro).
 * @param {string} vinculoId
 * @param {string} usuarioId
 * @returns {Promise<number>}
 */
async function calcularTotalEuDevo(vinculoId, usuarioId) {
  const transacoes = await Transacao.find({
    ...baseQueryPendentes(vinculoId, usuarioId),
    'contaConjunta.pagoPor': 'outro'
  }).lean();
  let total = new Decimal(0);
  for (const t of transacoes) {
    total = total.plus(t.contaConjunta?.parteUsuario || 0);
  }
  return round2(total);
}

/**
 * Calcula total que o outro deve (parteOutro onde pagoPor=usuario).
 * @param {string} vinculoId
 * @param {string} usuarioId
 * @returns {Promise<number>}
 */
async function calcularTotalOutroDeve(vinculoId, usuarioId) {
  const transacoes = await Transacao.find({
    ...baseQueryPendentes(vinculoId, usuarioId),
    'contaConjunta.pagoPor': 'usuario'
  }).lean();
  let total = new Decimal(0);
  for (const t of transacoes) {
    total = total.plus(t.contaConjunta?.parteOutro || 0);
  }
  return round2(total);
}

/**
 * Saldo líquido: totalOutroDeve - totalEuDevo.
 * @param {string} vinculoId
 * @param {string} usuarioId
 * @returns {Promise<number>}
 */
async function calcularSaldoLiquido(vinculoId, usuarioId) {
  const [totalOutroDeve, totalEuDevo] = await Promise.all([
    calcularTotalOutroDeve(vinculoId, usuarioId),
    calcularTotalEuDevo(vinculoId, usuarioId)
  ]);
  return round2(toDecimal(totalOutroDeve).minus(totalEuDevo));
}

/**
 * Calcula o saldo corrente de um vínculo a partir das transações pendentes.
 * saldo > 0: outro deve ao usuário
 * saldo < 0: usuário deve ao outro
 * @param {string} vinculoId
 * @param {string} usuarioId
 * @returns {Promise<number>}
 */
async function calcularSaldo(vinculoId, usuarioId) {
  return calcularSaldoLiquido(vinculoId, usuarioId);
}

async function listar(usuarioId) {
  return VinculoConjunto.find({ usuario: usuarioId, ativo: true })
    .sort({ nome: 1 })
    .lean();
}

async function criar(dados, usuarioId) {
  const existente = await VinculoConjunto.findOne({
    usuario: usuarioId,
    nome: dados.nome.trim()
  });
  if (existente) {
    throw new Error('Já existe um vínculo com este nome');
  }
  const vinculo = new VinculoConjunto({
    usuario: usuarioId,
    nome: dados.nome.trim(),
    participante: dados.participante.trim(),
    descricao: dados.descricao || '',
    ativo: true
  });
  await vinculo.save();
  return vinculo.toObject();
}

async function obterPorId(id, usuarioId) {
  const vinculo = await VinculoConjunto.findOne({
    _id: id,
    usuario: usuarioId
  }).lean();
  if (!vinculo) return null;
  const saldo = await calcularSaldo(id, usuarioId);
  return { ...vinculo, saldo };
}

async function atualizar(id, dados, usuarioId) {
  const vinculo = await VinculoConjunto.findOne({ _id: id, usuario: usuarioId });
  if (!vinculo) return null;
  if (dados.nome !== undefined) vinculo.nome = dados.nome.trim();
  if (dados.participante !== undefined) vinculo.participante = dados.participante.trim();
  if (dados.descricao !== undefined) vinculo.descricao = dados.descricao || '';
  await vinculo.save();
  return vinculo.toObject();
}

async function softDelete(id, usuarioId) {
  const vinculo = await VinculoConjunto.findOne({ _id: id, usuario: usuarioId });
  if (!vinculo) return null;
  vinculo.ativo = false;
  await vinculo.save();
  return vinculo.toObject();
}

/**
 * Resumo por tag/categoria com valorTotal e parteUsuario.
 * Inclui métricas separadas: totalEuDevo, totalOutroDeve, saldoLiquido.
 * @param {string} vinculoId
 * @param {string} usuarioId
 * @param {string} dataInicio - YYYY-MM-DD
 * @param {string} dataFim - YYYY-MM-DD
 */
async function obterResumo(vinculoId, usuarioId, dataInicio, dataFim) {
  const match = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    'contaConjunta.ativo': true,
    'contaConjunta.vinculoId': new mongoose.Types.ObjectId(vinculoId),
    status: 'ativo'
  };
  if (dataInicio || dataFim) {
    match.data = {};
    if (dataInicio) match.data.$gte = new Date(String(dataInicio) + 'T00:00:00.000Z');
    if (dataFim) match.data.$lte = new Date(String(dataFim) + 'T23:59:59.999Z');
  }

  const [resultado, totalEuDevo, totalOutroDeve, saldoLiquido] = await Promise.all([
    Transacao.aggregate([{ $match: match }, {
      $group: {
        _id: null,
        totalGeral: { $sum: '$contaConjunta.valorTotal' },
        parteUsuarioGeral: { $sum: '$contaConjunta.parteUsuario' }
      }
    }]),
    calcularTotalEuDevo(vinculoId, usuarioId),
    calcularTotalOutroDeve(vinculoId, usuarioId),
    calcularSaldoLiquido(vinculoId, usuarioId)
  ]);

  const item = resultado[0] || { totalGeral: 0, parteUsuarioGeral: 0 };

  return {
    totalEuDevo,
    totalOutroDeve,
    saldoLiquido,
    totalGeral: item.totalGeral || 0,
    parteUsuarioGeral: item.parteUsuarioGeral || 0,
    porTag: []
  };
}

async function listarTransacoes(vinculoId, usuarioId, filtros = {}) {
  const page = parseInt(filtros.page, 10) || 1;
  const limit = parseInt(filtros.limit, 10) || 20;
  const skip = (page - 1) * limit;

  const query = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    'contaConjunta.ativo': true,
    'contaConjunta.vinculoId': new mongoose.Types.ObjectId(vinculoId),
    status: 'ativo'
  };

  if (filtros.dataInicio || filtros.dataFim) {
    query.data = {};
    if (filtros.dataInicio) query.data.$gte = new Date(String(filtros.dataInicio) + 'T00:00:00.000Z');
    if (filtros.dataFim) query.data.$lte = new Date(String(filtros.dataFim) + 'T23:59:59.999Z');
  }

  if (filtros.pendente !== undefined) {
    if (filtros.pendente === true) {
      query['contaConjunta.acertadoEm'] = null;
    } else {
      query['contaConjunta.acertadoEm'] = { $ne: null };
    }
  }

  if (filtros.euDevo === true) {
    query['contaConjunta.pagoPor'] = 'outro';
    query['contaConjunta.acertadoEm'] = null;
  }
  if (filtros.outroDeve === true) {
    query['contaConjunta.pagoPor'] = 'usuario';
    query['contaConjunta.acertadoEm'] = null;
  }

  const [transacoes, total] = await Promise.all([
    Transacao.find(query).sort({ data: -1 }).skip(skip).limit(limit).lean(),
    Transacao.countDocuments(query)
  ]);

  return {
    items: transacoes,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

async function listarAcertos(vinculoId, usuarioId) {
  return AcertoConjunto.find({
    vinculo: vinculoId,
    usuario: usuarioId
  })
    .sort({ data: -1 })
    .lean();
}

/**
 * Registra acerto de contas. FIFO: marca transações mais antigas primeiro.
 * Suporta tipo compensacao (padrão) e pagamento_individual.
 * @param {string} vinculoId
 * @param {Object} dados - { valor, direcao, data, observacao, tipo?, ladoAfetado? }
 * @param {string} usuarioId
 */
async function registrarAcerto(vinculoId, dados, usuarioId) {
  const vinculo = await VinculoConjunto.findOne({ _id: vinculoId, usuario: usuarioId });
  if (!vinculo) throw new Error('Vínculo não encontrado.');

  const valor = parseFloat(dados.valor) || 0;
  if (valor <= 0) throw new Error('Valor do acerto deve ser maior que zero.');

  const tipo = (dados.tipo || 'compensacao').toLowerCase();
  const ladoAfetado = dados.ladoAfetado;

  if (tipo === 'pagamento_individual' && !ladoAfetado) {
    throw new Error('Para pagamento individual, ladoAfetado (usuario ou participante) é obrigatório.');
  }

  const query = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    'contaConjunta.ativo': true,
    'contaConjunta.vinculoId': new mongoose.Types.ObjectId(vinculoId),
    'contaConjunta.acertadoEm': null,
    status: 'ativo'
  };

  let transacoesPendentes;
  let valorPorTransacao;
  let limiteValor;

  if (dados.direcao === 'paguei') {
    query['contaConjunta.pagoPor'] = 'outro';
    transacoesPendentes = await Transacao.find(query).sort({ data: 1 }).lean();
    valorPorTransacao = (t) => t.contaConjunta?.parteUsuario || 0;
    if (tipo === 'pagamento_individual') {
      limiteValor = await calcularTotalEuDevo(vinculoId, usuarioId);
    } else {
      const saldoAtual = await calcularSaldoLiquido(vinculoId, usuarioId);
      limiteValor = Math.max(0, -saldoAtual);
    }
  } else {
    query['contaConjunta.pagoPor'] = 'usuario';
    transacoesPendentes = await Transacao.find(query).sort({ data: 1 }).lean();
    valorPorTransacao = (t) => t.contaConjunta?.parteOutro || 0;
    if (tipo === 'pagamento_individual') {
      limiteValor = await calcularTotalOutroDeve(vinculoId, usuarioId);
    } else {
      const saldoAtual = await calcularSaldoLiquido(vinculoId, usuarioId);
      limiteValor = Math.max(0, saldoAtual);
    }
  }

  if (valor > limiteValor) {
    throw new Error('Valor do acerto não pode ser maior que o saldo pendente.');
  }

  const transacoesQuitadas = [];
  let restante = valor;
  for (const t of transacoesPendentes) {
    if (restante <= 0) break;
    const v = valorPorTransacao(t);
    if (v > 0 && restante >= v) {
      transacoesQuitadas.push(t._id);
      restante -= v;
    }
  }

  const session = await startTransactionSession();
  try {
    const acerto = new AcertoConjunto({
      usuario: usuarioId,
      vinculo: vinculoId,
      valor: dados.valor,
      direcao: dados.direcao,
      data: new Date(dados.data),
      observacao: dados.observacao || '',
      transacoesQuitadas,
      tipo,
      ...(tipo === 'pagamento_individual' && ladoAfetado ? { ladoAfetado } : {})
    });
    await acerto.save({ session });

    if (transacoesQuitadas.length > 0) {
      await Transacao.updateMany(
        { _id: { $in: transacoesQuitadas } },
        { $set: { 'contaConjunta.acertadoEm': acerto._id } },
        { session }
      );
    }

    await session.commitTransaction();
    return acerto.toObject();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Estorna acerto: reabre as transações quitadas.
 */
async function estornarAcerto(acertoId, usuarioId) {
  const acerto = await AcertoConjunto.findOne({ _id: acertoId, usuario: usuarioId });
  if (!acerto) throw new Error('Acerto não encontrado.');

  const session = await startTransactionSession();
  try {
    if (acerto.transacoesQuitadas && acerto.transacoesQuitadas.length > 0) {
      await Transacao.updateMany(
        { _id: { $in: acerto.transacoesQuitadas } },
        { $unset: { 'contaConjunta.acertadoEm': '' } },
        { session }
      );
    }
    await AcertoConjunto.deleteOne({ _id: acertoId }, { session });
    await session.commitTransaction();
    return { mensagem: 'Acerto estornado com sucesso.' };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Retorna extrato financeiro do vínculo: transações e acertos em ordem cronológica decrescente.
 * @param {string} vinculoId
 * @param {string} usuarioId
 * @param {Object} filtros - { dataInicio, dataFim, limit, page }
 */
async function obterExtrato(vinculoId, usuarioId, filtros = {}) {
  const limit = Math.min(parseInt(filtros.limit, 10) || 50, 200);
  const page = parseInt(filtros.page, 10) || 1;
  const skip = (page - 1) * limit;
  const cap = 1000;

  const matchTransacao = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    'contaConjunta.ativo': true,
    'contaConjunta.vinculoId': new mongoose.Types.ObjectId(vinculoId),
    status: 'ativo'
  };
  const matchAcerto = { vinculo: new mongoose.Types.ObjectId(vinculoId), usuario: new mongoose.Types.ObjectId(usuarioId) };

  if (filtros.dataInicio || filtros.dataFim) {
    const dataFilter = {};
    if (filtros.dataInicio) dataFilter.$gte = new Date(String(filtros.dataInicio) + 'T00:00:00.000Z');
    if (filtros.dataFim) dataFilter.$lte = new Date(String(filtros.dataFim) + 'T23:59:59.999Z');
    matchTransacao.data = dataFilter;
    matchAcerto.data = dataFilter;
  }

  const [transacoes, acertos] = await Promise.all([
    Transacao.find(matchTransacao).sort({ data: -1 }).limit(cap).lean(),
    AcertoConjunto.find(matchAcerto).sort({ data: -1 }).limit(cap).lean()
  ]);

  const itens = [];
  transacoes.forEach((t) => itens.push({ tipo: 'transacao', data: t.data, ...t }));
  acertos.forEach((a) => itens.push({ tipo: 'acerto', data: a.data, ...a }));
  itens.sort((a, b) => new Date(b.data) - new Date(a.data));

  const total = itens.length;
  const itemsPaginated = itens.slice(skip, skip + limit);

  return {
    items: itemsPaginated,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  };
}

module.exports = {
  calcularSaldo,
  calcularTotalEuDevo,
  calcularTotalOutroDeve,
  calcularSaldoLiquido,
  listar,
  criar,
  obterPorId,
  atualizar,
  softDelete,
  obterResumo,
  listarTransacoes,
  listarAcertos,
  obterExtrato,
  registrarAcerto,
  estornarAcerto
};
