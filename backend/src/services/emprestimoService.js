// src/services/emprestimoService.js
const mongoose = require('mongoose');
const Transacao = require('../models/transacao');
const { STATUS_EMPRESTIMO } = require('../models/emprestimo');

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

  // Esperado do pagamento (caminho 2): soma o valorEsperadoRetorno de CADA
  // pagamento vinculado (não mais 1x por TX — revisão 2026-10-03, ADR-026).
  // Quando o pagamento não tem valorEsperadoRetorno próprio, usa o valor
  // herdado da TX (fallback usado também por listarTransacoes na Movimentações
  // table — ADR-026). Ainda soma PER-PAYMENT.
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
    { $match: { 'pagamentos.emprestimoId': objectId } },
    {
      $addFields: {
        _esperadoEfetivo: {
          $cond: [
            { $ne: ['$pagamentos.valorEsperadoRetorno', null] },
            '$pagamentos.valorEsperadoRetorno',
            { $ifNull: ['$valorEsperadoRetorno', 0] }
          ]
        }
      }
    },
    { $group: { _id: null, total: { $sum: '$_esperadoEfetivo' } } }
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
 * Recalcula o status do empréstimo.
 *
 * A partir do design 2026-10-03 (quitação manual):
 *  - Quitação é MANUAL — esta função NÃO quita mais sozinha quando o
 *    recebido atinge o esperado. O usuário clica em "Quitar" via
 *    `quitarEmprestimo` quando quiser.
 *  - Se status === 'quitado': mantém a TX de juros auto em sincronia com
 *    o lucro atual (cria/atualiza/deleta conforme `calcularLucro`).
 *  - Se status === 'ativo' ou 'cancelado': no-op (retorna o doc como está).
 *
 * Esta função é idempotente e segura para ser chamada múltiplas vezes
 * após qualquer mutação em TXs vinculadas ao Empréstimo.
 */
async function recalcularStatus(emprestimoId, usuarioId) {
  const Emprestimo = require('../models/emprestimo');
  const { recalcularJurosAuto } = require('../utils/emprestimoQuitacao');

  const emprestimo = await Emprestimo.findOne({ _id: emprestimoId, usuario: usuarioId });
  if (!emprestimo) return null;
  if (emprestimo.status === 'cancelado') return emprestimo;

  // Quitação é MANUAL. Só mantém a TX de juros em sincronia quando o
  // empréstimo já está quitado e algo muda.
  if (emprestimo.status === 'quitado') {
    const lucro = await calcularLucro(emprestimoId, usuarioId);
    await recalcularJurosAuto(emprestimo, lucro);
  }
  return emprestimo;
}

/**
 * Quita manualmente um Empréstimo (status: ativo → quitado).
 *
 * Regras:
 *  - Só funciona se o Empréstimo está 'ativo'. Quitar/cancelar de novo
 *    lança erro (a UI deve refletir o estado atual antes de oferecer o botão).
 *  - Seta `dataQuitacao = new Date()`.
 *  - Recalcula a TX de juros auto via `recalcularJurosAuto` para gravar o
 *    lucro realizado no momento da quitação.
 *  - Retorna o Empréstimo detalhado via `obterEmprestimoComTotais`.
 *
 * @param {string|ObjectId} emprestimoId
 * @param {string|ObjectId} usuarioId
 * @returns {Promise<Object>} Empréstimo detalhado
 * @throws {Error} se Empréstimo não encontrado, ou status !== 'ativo'
 */
async function quitarEmprestimo(emprestimoId, usuarioId) {
  const Emprestimo = require('../models/emprestimo');
  const { recalcularJurosAuto } = require('../utils/emprestimoQuitacao');

  const emprestimo = await Emprestimo.findOne({ _id: emprestimoId, usuario: usuarioId });
  if (!emprestimo) throw new Error('Empréstimo não encontrado.');
  if (emprestimo.status !== 'ativo') throw new Error('Apenas empréstimos ativos podem ser quitados.');

  emprestimo.status = 'quitado';
  emprestimo.dataQuitacao = new Date();
  await emprestimo.save();

  const lucro = await calcularLucro(emprestimoId, usuarioId);
  await recalcularJurosAuto(emprestimo, lucro);

  const atualizado = await Emprestimo.findOne({ _id: emprestimo._id, usuario: usuarioId });
  return await obterEmprestimoComTotais(atualizado);
}

/**
 * Reabre um Empréstimo (status: quitado → ativo).
 *
 * Regras:
 *  - Só funciona se o Empréstimo está 'quitado'.
 *  - Deleta a TX de juros automáticos vinculada (idempotente — 0 docs se já
 *    não existir; a TX não é recriada aqui).
 *  - Limpa `dataQuitacao`.
 *  - NÃO chama `recalcularStatus`: como a quitação agora é manual, a TX
 *    de juros auto só volta a existir quando o usuário quitar de novo.
 *  - Retorna o Empréstimo detalhado via `obterEmprestimoComTotais`.
 *
 * @param {string|ObjectId} emprestimoId
 * @param {string|ObjectId} usuarioId
 * @returns {Promise<Object>} Empréstimo detalhado
 * @throws {Error} se Empréstimo não encontrado, ou status !== 'quitado'
 */
async function reabrirEmprestimo(emprestimoId, usuarioId) {
  const Emprestimo = require('../models/emprestimo');
  const emprestimo = await Emprestimo.findOne({ _id: emprestimoId, usuario: usuarioId });
  if (!emprestimo) throw new Error('Empréstimo não encontrado.');
  if (emprestimo.status !== 'quitado') throw new Error('Apenas empréstimos quitados podem ser reabertos.');

  await Transacao.deleteOne({ emprestimoId: emprestimo._id, emprestimoEhJurosAuto: true });
  emprestimo.status = 'ativo';
  emprestimo.dataQuitacao = null;
  await emprestimo.save();

  const atualizado = await Emprestimo.findOne({ _id: emprestimo._id, usuario: usuarioId });
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
  _agregarTotaisEmprestimo,    // <-- NOVO
  calcularTotais,
  obterEmprestimoComTotais,
  calcularLucro,
  recalcularStatus,
  quitarEmprestimo,            // <-- NOVO (Task 1 — quitação manual)
  reabrirEmprestimo,           // <-- NOVO (Task 1 — quitação manual)
  validarEmprestimoParaTransacao
};
