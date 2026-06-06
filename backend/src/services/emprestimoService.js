// src/services/emprestimoService.js
const mongoose = require('mongoose');
const Transacao = require('../models/transacao');
const { ajustarRecebiveisDeEmprestimo } = require('../utils/emprestimoAjuste');
const { TIPOS_RETORNO, STATUS_EMPRESTIMO, DIRECOES } = require('../models/emprestimo');

const CAMPOS_EDITAVEIS = [
  'valorEsperadoRetorno',
  'tipoRetorno',
  'taxaJurosPercentual',
  'valorJurosFixo',
  'prazoFinal',
  'observacao'
];

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
  if (dados.taxaJurosPercentual !== undefined && dados.taxaJurosPercentual !== null) {
    if (dados.taxaJurosPercentual < 0 || dados.taxaJurosPercentual > 1000) {
      erros.push('taxaJurosPercentual fora do intervalo (0-1000).');
    }
  }
  if (dados.valorJurosFixo !== undefined && dados.valorJurosFixo !== null) {
    if (dados.valorJurosFixo < 0) {
      erros.push('valorJurosFixo não pode ser negativo.');
    }
  }
  if (!parcial || dados.prazoFinal !== undefined) {
    if (!dados.prazoFinal) erros.push('prazoFinal é obrigatório.');
  }
  if (dados.direcao !== undefined && !DIRECOES.includes(dados.direcao)) {
    erros.push(`direcao inválida. Valores: ${DIRECOES.join(', ')}`);
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
 * Calcula o total de juros de um empréstimo aplicando FIFO nas transações
 * vinculadas (gastos como desembolso, recebíveis como recebimento).
 * Reutiliza a lógica de `ajustarRecebiveisDeEmprestimo` e soma os juros resultantes.
 */
async function calcularTotalJuros(emprestimoId, usuarioId) {
  const objectId = typeof emprestimoId === 'string'
    ? new mongoose.Types.ObjectId(emprestimoId)
    : emprestimoId;

  const transacoes = await Transacao.find({
    emprestimoId: objectId,
    usuario: new mongoose.Types.ObjectId(usuarioId),
    status: 'ativo',
    emprestimoEhJurosAuto: { $ne: true }
  }).lean();

  if (transacoes.length === 0) return 0;

  const copia = transacoes.map((t) => ({ ...t, pagamentos: t.pagamentos ? t.pagamentos.map((p) => ({ ...p })) : [] }));
  await ajustarRecebiveisDeEmprestimo(copia, usuarioId);

  let totalJuros = 0;
  for (const t of copia) {
    if (t.tipo === 'recebivel' && t._emprestimoInfo) {
      totalJuros += t._emprestimoInfo.juros || 0;
    }
  }
  return totalJuros;
}

/**
 * Cria a transação de juros auto-criada ao quitar um empréstimo.
 * Mantida como wrapper de compatibilidade — delega a recalcularJurosAuto,
 * que agora também é capaz de ATUALIZAR a transação existente se o cálculo
 * mudar (não apenas criar uma nova).
 *
 * @deprecated Use utils/emprestimoQuitacao.recalcularJurosAuto diretamente.
 */
async function criarTransacaoJurosAuto(emprestimo, totalJuros) {
  const { recalcularJurosAuto } = require('../utils/emprestimoQuitacao');
  const resultado = await recalcularJurosAuto(emprestimo, totalJuros);
  if (resultado.acao === 'criada' || resultado.acao === 'atualizada' || resultado.acao === 'mantida') {
    return resultado.transacao;
  }
  return null;
}

/**
 * Recalcula o status do empréstimo aplicando regras de transição:
 *  - Se totalReceived >= valorEsperadoRetorno e status === 'ativo':
 *      Transiciona para 'quitado' atomicamente (findOneAndUpdate com condição status='ativo'),
 *      cria/atualiza a transação de juros auto.
 *  - Se status === 'quitado' e totalReceived < valorEsperadoRetorno (ex: usuário
 *      aumentou valorEsperado ou estornou recebimento): reverte para 'ativo',
 *      deleta a transação de juros auto.
 *  - Se status === 'quitado' e cálculo mudou (ex: vinculou desembolso tardio):
 *      Atualiza a transação de juros auto com o novo valor.
 *  - Se status === 'cancelado': no-op.
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
    const totalJuros = await calcularTotalJuros(emprestimoId, usuarioId);
    const transicao = await Emprestimo.findOneAndUpdate(
      { _id: emprestimoId, usuario: usuarioId, status: 'ativo' },
      { $set: { status: 'quitado', dataQuitacao: new Date() } },
      { new: true }
    );
    if (transicao) {
      await recalcularJurosAuto(transicao, totalJuros);
    }
    return transicao || emprestimo;
  }

  if (!atingiuQuitado && emprestimo.status === 'quitado') {
    const totalJuros = await calcularTotalJuros(emprestimoId, usuarioId);
    const transicao = await Emprestimo.findOneAndUpdate(
      { _id: emprestimoId, usuario: usuarioId, status: 'quitado' },
      { $set: { status: 'ativo', dataQuitacao: null } },
      { new: true }
    );
    if (transicao) {
      await recalcularJurosAuto(transicao, totalJuros);
    }
    return transicao || emprestimo;
  }

  if (atingiuQuitado && emprestimo.status === 'quitado') {
    const totalJuros = await calcularTotalJuros(emprestimoId, usuarioId);
    await recalcularJurosAuto(emprestimo, totalJuros);
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
  CAMPOS_EDITAVEIS,
  STATUS_EMPRESTIMO,
  TIPOS_RETORNO,
  DIRECOES,
  calcularTotais,
  obterEmprestimoComTotais,
  calcularTotalJuros,
  criarTransacaoJurosAuto,
  recalcularStatus,
  validarEmprestimoParaTransacao
};
