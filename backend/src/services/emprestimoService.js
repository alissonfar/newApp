// src/services/emprestimoService.js
const mongoose = require('mongoose');
const Transacao = require('../models/transacao');
const { TIPOS_RETORNO, STATUS_EMPRESTIMO } = require('../models/emprestimo');

/**
 * Valida os dados de criação/edição de um Empréstimo.
 *
 * A partir do design 2026-06-24, `valorEsperadoRetorno` NÃO é mais campo do
 * Empréstimo — ele migrou para a Transação. Por isso esta validação não exige
 * nem valida esse campo aqui.
 */
function validarDadosEmprestimo(dados, { parcial = false } = {}) {
  const erros = [];
  if (!parcial || dados.pessoaId !== undefined) {
    if (!dados.pessoaId) erros.push('pessoaId é obrigatório.');
  }
  if (!parcial || dados.tipoRetorno !== undefined) {
    if (dados.tipoRetorno !== undefined && !TIPOS_RETORNO.includes(dados.tipoRetorno)) {
      erros.push(`tipoRetorno inválido. Valores: ${TIPOS_RETORNO.join(', ')}`);
    }
  }
  if (!parcial || dados.prazoFinal !== undefined) {
    if (!dados.prazoFinal) erros.push('prazoFinal é obrigatório.');
  }
  return erros;
}

async function calcularTotais(emprestimoId, usuarioId) {
  const objectId = typeof emprestimoId === 'string'
    ? new mongoose.Types.ObjectId(emprestimoId)
    : emprestimoId;
  const usuarioObjId = new mongoose.Types.ObjectId(usuarioId);

  // CAMINHO 1 — TX-level legado (t.emprestimoId = X).
  // Soma t.valor por tipo e t.valorEsperadoRetorno (apenas em gastos) na mesma passada.
  const txLevelAgg = await Transacao.aggregate([
    {
      $match: {
        emprestimoId: objectId,
        usuario: usuarioObjId,
        status: 'ativo',
        emprestimoEhJurosAuto: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$tipo',
        total: { $sum: '$valor' },
        totalEsperado: {
          $sum: { $cond: [{ $eq: ['$tipo', 'gasto'] }, { $ifNull: ['$valorEsperadoRetorno', 0] }, 0] }
        }
      }
    }
  ]);

  // CAMINHO 2 — Pagamento-level novo (pagamentos[].emprestimoId = X).
  // Exclui TXs já contadas no caminho 1 (t.emprestimoId = X) para não duplicar.
  const pagamentoLevelAgg = await Transacao.aggregate([
    {
      $match: {
        usuario: usuarioObjId,
        status: 'ativo',
        emprestimoEhJurosAuto: { $ne: true },
        'pagamentos.emprestimoId': objectId,
        emprestimoId: { $ne: objectId }
      }
    },
    { $unwind: '$pagamentos' },
    { $match: { 'pagamentos.emprestimoId': objectId } },
    {
      $group: {
        _id: '$tipo',
        total: { $sum: '$pagamentos.valor' }
      }
    }
  ]);

  // Esperado por pagamento: agrega do PAGAMENTO (caminho novo).
  // Regra: cada TX conta 1x, não por pagamento (para não duplicar se uma TX
  // tem 2 pagamentos com o mesmo emprestimoId). Como o valorEsperadoRetorno
  // agora vive no pagamento, agrupamos por TX, pegamos o valorEsperadoRetorno
  // do PRIMEIRO pagamento emprestado (assume-se que todos os pagamentos
  // emprestados de uma mesma TX para o mesmo Empréstimo têm o mesmo valor
  // esperado — coerente com o modelo de "complemento" do design anterior).
  const esperadoPagamentoAgg = await Transacao.aggregate([
    {
      $match: {
        usuario: usuarioObjId,
        status: 'ativo',
        tipo: 'gasto',
        'pagamentos.emprestimoId': objectId,
        emprestimoId: { $ne: objectId }
      }
    },
    { $unwind: '$pagamentos' },
    { $match: { 'pagamentos.emprestimoId': objectId, 'pagamentos.valorEsperadoRetorno': { $ne: null, $gt: 0 } } },
    {
      $group: {
        _id: '$_id',  // agrupa por TX
        valorEsperado: { $first: '$pagamentos.valorEsperadoRetorno' }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$valorEsperado' }
      }
    }
  ]);

  let totalDisbursed = 0;
  let totalReceived = 0;
  let totalEsperado = 0;
  for (const r of txLevelAgg) {
    if (r._id === 'gasto') {
      totalDisbursed += r.total;
      totalEsperado += r.totalEsperado || 0;
    } else if (r._id === 'recebivel') {
      totalReceived += r.total;
    }
  }
  for (const r of pagamentoLevelAgg) {
    if (r._id === 'gasto') totalDisbursed += r.total;
    else if (r._id === 'recebivel') totalReceived += r.total;
  }
  totalEsperado += esperadoPagamentoAgg[0]?.total || 0;

  return {
    totalDisbursed,
    totalReceived,
    totalEsperado,
    saldoAReceber: 0, // preenchido em quem consome (com `totalEsperado - totalReceived`)
    lucro: 0          // preenchido em quem consome (com `totalEsperado - totalDisbursed`)
  };
}

async function obterEmprestimoComTotais(emprestimo) {
  const totais = await calcularTotais(emprestimo._id, emprestimo.usuario);
  const e = emprestimo.toObject ? emprestimo.toObject() : emprestimo;
  const totalEsperado = totais.totalEsperado || 0;
  const isQuitadoCalculado = totalEsperado > 0 && totais.totalReceived >= totalEsperado;

  return {
    ...e,
    totalDisbursed: totais.totalDisbursed,
    totalReceived: totais.totalReceived,
    totalEsperado,
    // "Saldo a receber" = quanto ainda falta entrar vinculado a este Empréstimo
    // (esperado - recebido, mínimo 0).
    saldoAReceber: Math.max(0, totalEsperado - totais.totalReceived),
    // "Lucro esperado" = quanto vai lucrar se receber tudo que espera
    // (esperado - desembolsado). Pode ser negativo em casos degenerados.
    lucro: totalEsperado - totais.totalDisbursed,
    isQuitadoCalculado
  };
}

/**
 * Calcula o lucro realizado de um empréstimo:
 *   lucro = soma_recebíveis - soma_gastos
 * (sem FIFO, sem split por transação).
 *
 * @param {string|ObjectId} emprestimoId
 * @param {string|ObjectId} usuarioId
 * @returns {Promise<number>}
 */
async function calcularLucro(emprestimoId, usuarioId) {
  const objectId = typeof emprestimoId === 'string'
    ? new mongoose.Types.ObjectId(emprestimoId)
    : emprestimoId;

  const resultado = await Transacao.aggregate([
    {
      $match: {
        emprestimoId: objectId,
        usuario: new mongoose.Types.ObjectId(usuarioId),
        status: 'ativo',
        emprestimoEhJurosAuto: { $ne: true }
      }
    },
    {
      $group: {
        _id: '$tipo',
        total: { $sum: '$valor' }
      }
    }
  ]);

  let totalDisbursed = 0;
  let totalReceived = 0;
  for (const r of resultado) {
    if (r._id === 'gasto') totalDisbursed = r.total;
    else if (r._id === 'recebivel') totalReceived = r.total;
  }

  return totalReceived - totalDisbursed;
}

/**
 * Recalcula o status do empréstimo aplicando regras de transição:
 *  - Se totalReceived >= soma(valorEsperadoRetorno das TXs de gasto) e status === 'ativo':
 *      Transiciona para 'quitado' atomicamente (findOneAndUpdate com condição status='ativo'),
 *      gera/atualiza a transação de juros auto com o lucro realizado.
 *  - Se status === 'quitado' (independentemente do cálculo):
 *      Garante que a transação de juros auto reflete o lucro atual
 *      (deleta se lucro <= 0, atualiza se mudou, mantém se igual).
 *  - Se status === 'cancelado': no-op.
 *
 * A partir do design 2026-06-24:
 *  - `valorEsperadoRetorno` mora nas TXs de gasto (não mais no Empréstimo).
 *  - A soma esperada é calculada em `calcularTotais` (`totalEsperado`).
 *  - NÃO há mais auto-reversão `quitado → ativo`.
 *
 * Esta função é idempotente e segura para ser chamada múltiplas vezes.
 */
async function recalcularStatus(emprestimoId, usuarioId) {
  const Emprestimo = require('../models/emprestimo');
  const { recalcularJurosAuto } = require('../utils/emprestimoQuitacao');

  const emprestimo = await Emprestimo.findOne({ _id: emprestimoId, usuario: usuarioId });
  if (!emprestimo) return null;
  if (emprestimo.status === 'cancelado') return emprestimo;

  const totais = await calcularTotais(emprestimoId, usuarioId);
  const valorEsperado = totais.totalEsperado || 0;
  const atingiuQuitado = valorEsperado > 0 && totais.totalReceived >= valorEsperado;
  const desembolsoZeroEAtingiuQuitado = atingiuQuitado && (totais.totalDisbursed || 0) === 0;

  if (atingiuQuitado && desembolsoZeroEAtingiuQuitado) {
    console.warn(
      `[emprestimoService.recalcularStatus] ATENÇÃO: empréstimo ${emprestimoId} ` +
      `quitou com desembolso zero. Total recebido: ${totais.totalReceived}, ` +
      `valor esperado: ${valorEsperado}. Todos os recebimentos serão contabilizados como juros. ` +
      `Considere vincular o desembolso original.`
    );
  }

  if (atingiuQuitado && emprestimo.status === 'ativo') {
    const lucro = await calcularLucro(emprestimoId, usuarioId);
    const transicao = await Emprestimo.findOneAndUpdate(
      { _id: emprestimoId, usuario: usuarioId, status: 'ativo' },
      { $set: { status: 'quitado', dataQuitacao: new Date() } },
      { new: true }
    );
    if (transicao) {
      await recalcularJurosAuto(transicao, lucro);
    }
    return transicao || emprestimo;
  }

  if (atingiuQuitado && emprestimo.status === 'quitado') {
    const lucro = await calcularLucro(emprestimoId, usuarioId);
    await recalcularJurosAuto(emprestimo, lucro);
    return emprestimo;
  }

  return emprestimo;
}

async function validarEmprestimoParaTransacao(emprestimoId, usuarioId) {
  if (emprestimoId === undefined || emprestimoId === null || emprestimoId === '') {
    return null;
  }
  if (!mongoose.Types.ObjectId.isValid(emprestimoId)) {
    throw new Error('emprestimoId inválido.');
  }
  const Emprestimo = require('../models/emprestimo');
  const emprestimo = await Emprestimo.findOne({
    _id: emprestimoId,
    usuario: usuarioId
  });
  if (!emprestimo) {
    throw new Error('Empréstimo não encontrado.');
  }
  if (emprestimo.status === 'cancelado') {
    throw new Error('Não é possível vincular transações a um empréstimo cancelado.');
  }
  return emprestimo;
}

module.exports = {
  validarDadosEmprestimo,
  STATUS_EMPRESTIMO,
  TIPOS_RETORNO,
  calcularTotais,
  obterEmprestimoComTotais,
  calcularLucro,
  recalcularStatus,
  validarEmprestimoParaTransacao
};
