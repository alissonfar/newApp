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

/**
 * Função privada compartilhada: agrega todos os totais de um Empréstimo
 * (desembolso, recebimento, esperado) considerando os 2 caminhos:
 *  - C1 (caminho 1 / legado): t.emprestimoId = X no nível da Transação
 *  - C2 (caminho 2 / novo): pagamentos[].emprestimoId = X no nível do Pagamento
 *
 * Quem consome (calcularTotais, calcularLucro, calcularTotaisRecebEDisbursed)
 * soma C1 + C2 conforme precisar. Separar por caminho evita double-counting
 * (regra de exclusividade mútua do ADR-015).
 *
 * Exclui TXs de juros auto (emprestimoEhJurosAuto) e TXs inativas.
 *
 * @returns {Promise<{
 *   totalDesembolsadoC1: number,
 *   totalDesembolsadoC2: number,
 *   totalRecebidoC1: number,
 *   totalRecebidoC2: number,
 *   totalEsperadoC1: number,
 *   totalEsperadoC2: number
 * }>}
 */
async function _agregarTotaisEmprestimo(emprestimoId, usuarioId) {
  const objectId = typeof emprestimoId === 'string'
    ? new mongoose.Types.ObjectId(emprestimoId)
    : emprestimoId;
  const usuarioObjId = typeof usuarioId === 'string'
    ? new mongoose.Types.ObjectId(usuarioId)
    : usuarioId;

  // CAMINHO 1 — TX-level legado (t.emprestimoId = X).
  // Soma t.valor por tipo e t.valorEsperadoRetorno (apenas em gastos).
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
          $sum: {
            $cond: [
              { $eq: ['$tipo', 'gasto'] },
              { $ifNull: ['$valorEsperadoRetorno', 0] },
              0
            ]
          }
        }
      }
    }
  ]);

  // CAMINHO 2 — Pagamento-level novo (pagamentos[].emprestimoId = X).
  // Exclui TXs já contadas no caminho 1.
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

  // Esperado do pagamento (caminho 2): agrupa por TX (1x por TX) e soma
  // pagamentos[].valorEsperadoRetorno. Assume que todos os pagamentos
  // emprestados de uma mesma TX pro mesmo Empréstimo têm o mesmo valor
  // esperado (coerente com o modelo de "complemento").
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
    {
      $match: {
        'pagamentos.emprestimoId': objectId,
        'pagamentos.valorEsperadoRetorno': { $ne: null, $gt: 0 }
      }
    },
    {
      $group: {
        _id: '$_id',
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

  let totalDesembolsadoC1 = 0;
  let totalRecebidoC1 = 0;
  let totalEsperadoC1 = 0;
  for (const r of txLevelAgg) {
    if (r._id === 'gasto') {
      totalDesembolsadoC1 = r.total;
      totalEsperadoC1 = r.totalEsperado || 0;
    } else if (r._id === 'recebivel') {
      totalRecebidoC1 = r.total;
    }
  }

  let totalDesembolsadoC2 = 0;
  let totalRecebidoC2 = 0;
  for (const r of pagamentoLevelAgg) {
    if (r._id === 'gasto') totalDesembolsadoC2 = r.total;
    else if (r._id === 'recebivel') totalRecebidoC2 = r.total;
  }

  const totalEsperadoC2 = esperadoPagamentoAgg[0]?.total || 0;

  return {
    totalDesembolsadoC1,
    totalDesembolsadoC2,
    totalRecebidoC1,
    totalRecebidoC2,
    totalEsperadoC1,
    totalEsperadoC2
  };
}

async function calcularTotais(emprestimoId, usuarioId) {
  const t = await _agregarTotaisEmprestimo(emprestimoId, usuarioId);
  return {
    totalDisbursed: t.totalDesembolsadoC1 + t.totalDesembolsadoC2,
    totalReceived: t.totalRecebidoC1 + t.totalRecebidoC2,
    totalEsperado: t.totalEsperadoC1 + t.totalEsperadoC2,
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
 * Considera os 2 caminhos:
 *  - C1 (legado): t.emprestimoId = X
 *  - C2 (novo): pagamentos[].emprestimoId = X
 *
 * @param {string|ObjectId} emprestimoId
 * @param {string|ObjectId} usuarioId
 * @returns {Promise<number>}
 */
async function calcularLucro(emprestimoId, usuarioId) {
  const t = await _agregarTotaisEmprestimo(emprestimoId, usuarioId);
  const totalDesembolsado = t.totalDesembolsadoC1 + t.totalDesembolsadoC2;
  const totalRecebido = t.totalRecebidoC1 + t.totalRecebidoC2;
  return totalRecebido - totalDesembolsado;
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

/**
 * Reverte a quitação de um Empréstimo:
 *  1. Deleta a TX de juros automáticos (se existir)
 *  2. Volta o Empréstimo para status 'ativo' e limpa dataQuitacao
 *  3. Dispara recalcularStatus() — sistema detecta que ainda está quitado
 *     (totalReceived >= totalEsperado) e recria a TX de juros com o valor
 *     correto (calculado agora com caminho 2 enxergado)
 *
 * Edge cases:
 *  - Se a TX de juros auto já foi deletada manualmente antes, o deleteOne
 *    é no-op (0 docs removidos). O recalcularStatus recria a TX normalmente.
 *  - Se o usuário desvinculou TXs de desembolso depois da quitação, o
 *    recalcularStatus pode detectar que NÃO está mais quitado. Empréstimo
 *    fica 'ativo' e a TX de juros auto NÃO é recriada.
 *
 * @param {string|ObjectId} emprestimoId
 * @param {string|ObjectId} usuarioId
 * @returns {Promise<Object>} Empréstimo detalhado (via obterEmprestimoComTotais)
 * @throws {Error} se Empréstimo não encontrado ou não está 'quitado'
 */
async function reverterQuitacao(emprestimoId, usuarioId) {
  const Emprestimo = require('../models/emprestimo');
  const { recalcularJurosAuto } = require('../utils/emprestimoQuitacao');

  const objectId = typeof emprestimoId === 'string'
    ? new mongoose.Types.ObjectId(emprestimoId)
    : emprestimoId;
  const usuarioObjId = typeof usuarioId === 'string'
    ? new mongoose.Types.ObjectId(usuarioId)
    : usuarioId;

  const emprestimo = await Emprestimo.findOne({ _id: objectId, usuario: usuarioObjId });
  if (!emprestimo) {
    throw new Error('Empréstimo não encontrado.');
  }
  if (emprestimo.status !== 'quitado') {
    throw new Error('Apenas empréstimos quitados podem ter a quitação revertida.');
  }

  // 1. Deleta TX de juros auto (idempotente — 0 docs se já não existir)
  await Transacao.deleteOne({
    emprestimoId: emprestimo._id,
    emprestimoEhJurosAuto: true,
    status: 'ativo'
  });

  // 2. Volta Empréstimo pra ativo
  emprestimo.status = 'ativo';
  emprestimo.dataQuitacao = null;
  await emprestimo.save();

  // 3. Recalcula status (pode recriar TX de juros auto se ainda estiver quitado)
  await recalcularStatus(emprestimo._id, usuarioObjId);

  // 4. Retorna Empréstimo detalhado
  const atualizado = await Emprestimo.findOne({ _id: emprestimo._id, usuario: usuarioObjId });
  return await obterEmprestimoComTotais(atualizado);
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
  _agregarTotaisEmprestimo,    // <-- NOVO
  calcularTotais,
  obterEmprestimoComTotais,
  calcularLucro,
  recalcularStatus,
  validarEmprestimoParaTransacao,
  reverterQuitacao             // <-- NOVO (Task 6)
};
