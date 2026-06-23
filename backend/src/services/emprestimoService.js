// src/services/emprestimoService.js
const mongoose = require('mongoose');
const Transacao = require('../models/transacao');
const { TIPOS_RETORNO, STATUS_EMPRESTIMO } = require('../models/emprestimo');

function validarDadosEmprestimo(dados, { parcial = false } = {}) {
  const erros = [];
  if (!parcial || dados.pessoaId !== undefined) {
    if (!dados.pessoaId) erros.push('pessoaId é obrigatório.');
  }
  if (!parcial || dados.valorEsperadoRetorno !== undefined) {
    if (dados.valorEsperadoRetorno === undefined || dados.valorEsperadoRetorno === null) {
      erros.push('valorEsperadoRetorno é obrigatório.');
    } else if (Number(dados.valorEsperadoRetorno) < 0) {
      erros.push('valorEsperadoRetorno não pode ser negativo.');
    }
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

  return {
    totalDisbursed,
    totalReceived,
    saldoAReceber: 0,
    lucro: 0
  };
}

async function obterEmprestimoComTotais(emprestimo) {
  const totais = await calcularTotais(emprestimo._id, emprestimo.usuario);
  const e = emprestimo.toObject ? emprestimo.toObject() : emprestimo;
  const valorEsperado = e.valorEsperadoRetorno || 0;
  const isQuitadoCalculado = totais.totalReceived >= valorEsperado && valorEsperado > 0;

  return {
    ...e,
    totalDisbursed: totais.totalDisbursed,
    totalReceived: totais.totalReceived,
    saldoAReceber: Math.max(0, valorEsperado - totais.totalReceived),
    lucro: totais.totalReceived - totais.totalDisbursed,
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
 *  - Se totalReceived >= valorEsperadoRetorno e status === 'ativo':
 *      Transiciona para 'quitado' atomicamente (findOneAndUpdate com condição status='ativo'),
 *      gera/atualiza a transação de juros auto com o lucro realizado.
 *  - Se status === 'quitado' (independentemente do cálculo):
 *      Garante que a transação de juros auto reflete o lucro atual
 *      (deleta se lucro <= 0, atualiza se mudou, mantém se igual).
 *  - Se status === 'cancelado': no-op.
 *
 * IMPORTANTE: a partir da FASE 4 do design doc, NÃO há mais auto-reversão
 * `quitado → ativo`. O usuário gerencia o status manualmente.
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
  const valorEsperado = emprestimo.valorEsperadoRetorno || 0;
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
