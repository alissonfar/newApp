// src/services/vinculoService.js
const mongoose = require('mongoose');
const VinculoConjunto = require('../models/vinculoConjunto');
const AcertoConjunto = require('../models/acertoConjunto');
const Transacao = require('../models/transacao');

/**
 * Calcula o saldo corrente de um vínculo a partir das transações pendentes.
 * saldo > 0: outro deve ao usuário
 * saldo < 0: usuário deve ao outro
 * @param {string} vinculoId
 * @param {string} usuarioId
 * @returns {Promise<number>}
 */
async function calcularSaldo(vinculoId, usuarioId) {
  const transacoesPendentes = await Transacao.find({
    usuario: new mongoose.Types.ObjectId(usuarioId),
    'contaConjunta.ativo': true,
    'contaConjunta.vinculoId': new mongoose.Types.ObjectId(vinculoId),
    'contaConjunta.acertadoEm': null,
    status: 'ativo'
  }).lean();

  let saldo = 0;
  for (const t of transacoesPendentes) {
    const cc = t.contaConjunta;
    if (!cc) continue;
    if (cc.pagoPor === 'usuario') {
      saldo += cc.parteOutro || 0;
    } else {
      saldo -= cc.parteUsuario || 0;
    }
  }
  return Math.round(saldo * 100) / 100;
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

  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: null,
        totalGeral: { $sum: '$contaConjunta.valorTotal' },
        parteUsuarioGeral: { $sum: '$contaConjunta.parteUsuario' }
      }
    }
  ];

  const resultado = await Transacao.aggregate(pipeline);
  const item = resultado[0] || { totalGeral: 0, parteUsuarioGeral: 0 };

  return {
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
 * @param {string} vinculoId
 * @param {Object} dados - { valor, direcao, data, observacao }
 * @param {string} usuarioId
 */
async function registrarAcerto(vinculoId, dados, usuarioId) {
  const vinculo = await VinculoConjunto.findOne({ _id: vinculoId, usuario: usuarioId });
  if (!vinculo) throw new Error('Vínculo não encontrado.');

  const valor = parseFloat(dados.valor) || 0;
  if (valor <= 0) throw new Error('Valor do acerto deve ser maior que zero.');

  const saldoAtual = await calcularSaldo(vinculoId, usuarioId);

  const query = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    'contaConjunta.ativo': true,
    'contaConjunta.vinculoId': new mongoose.Types.ObjectId(vinculoId),
    'contaConjunta.acertadoEm': null,
    status: 'ativo'
  };

  let transacoesPendentes;
  let valorPorTransacao;
  if (dados.direcao === 'paguei') {
    query['contaConjunta.pagoPor'] = 'outro';
    transacoesPendentes = await Transacao.find(query).sort({ data: 1 }).lean();
    valorPorTransacao = (t) => t.contaConjunta?.parteUsuario || 0;
  } else {
    query['contaConjunta.pagoPor'] = 'usuario';
    transacoesPendentes = await Transacao.find(query).sort({ data: 1 }).lean();
    valorPorTransacao = (t) => t.contaConjunta?.parteOutro || 0;
  }

  const saldoRelevante = dados.direcao === 'paguei' ? -saldoAtual : saldoAtual;
  if (valor > Math.abs(saldoRelevante)) {
    throw new Error('Valor do acerto não pode ser maior que o saldo pendente.');
  }

  const transacoesQuitadas = [];
  let restante = valor;
  for (const t of transacoesPendentes) {
    if (restante <= 0) break;
    const v = valorPorTransacao(t);
    const aQuitar = Math.min(restante, v);
    if (aQuitar > 0) {
      transacoesQuitadas.push(t._id);
      restante -= v;
    }
  }

  const acerto = new AcertoConjunto({
    usuario: usuarioId,
    vinculo: vinculoId,
    valor: dados.valor,
    direcao: dados.direcao,
    data: new Date(dados.data),
    observacao: dados.observacao || '',
    transacoesQuitadas
  });
  await acerto.save();

  await Transacao.updateMany(
    { _id: { $in: transacoesQuitadas } },
    { $set: { 'contaConjunta.acertadoEm': acerto._id } }
  );

  return acerto.toObject();
}

/**
 * Estorna acerto: reabre as transações quitadas.
 */
async function estornarAcerto(acertoId, usuarioId) {
  const acerto = await AcertoConjunto.findOne({ _id: acertoId, usuario: usuarioId });
  if (!acerto) throw new Error('Acerto não encontrado.');

  await Transacao.updateMany(
    { _id: { $in: acerto.transacoesQuitadas || [] } },
    { $unset: { 'contaConjunta.acertadoEm': '' } }
  );

  await AcertoConjunto.deleteOne({ _id: acertoId });
  return { mensagem: 'Acerto estornado com sucesso.' };
}

module.exports = {
  calcularSaldo,
  listar,
  criar,
  obterPorId,
  atualizar,
  softDelete,
  obterResumo,
  listarTransacoes,
  listarAcertos,
  registrarAcerto,
  estornarAcerto
};
