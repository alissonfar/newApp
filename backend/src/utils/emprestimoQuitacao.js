/**
 * utils/emprestimoQuitacao.js
 *
 * Lógica de cálculo e manutenção da transação de juros auto-criada na quitação
 * de um empréstimo. Extraída de services/emprestimoService.js para permitir
 * atualização (não apenas criação) quando o cálculo de lucro muda após
 * edições/estornos.
 *
 * Comportamento (FASE 4 — modelo simplificado):
 *  - `lucro` é o segundo argumento de `recalcularJurosAuto` (não mais `totalJuros`).
 *  - Se lucro <= 0 e já existe tx de juros auto → DELETAR (reverter quitação)
 *  - Se lucro > 0 e já existe tx de juros auto → ATUALIZAR valor + observação
 *  - Se lucro > 0 e não existe → CRIAR nova tx
 *  - Sem mudança de valor E observação → no-op
 */
const mongoose = require('mongoose');
const Transacao = require('../models/transacao');

function formatarMoeda(valor) {
  return (Number(valor) || 0).toFixed(2);
}

function arredondarCentavos(valor) {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

function montarObservacao({ pessoaNome, desembolso, totalReceb, lucro }) {
  return (
    `Lucro realizado do empréstimo para ${pessoaNome}. ` +
    `Desembolsos: R$ ${formatarMoeda(desembolso)}, ` +
    `Recebimentos: R$ ${formatarMoeda(totalReceb)}, ` +
    `Lucro: R$ ${formatarMoeda(lucro)}.`
  );
}

async function buscarSnapshotUltimoRecebimento(emprestimoId) {
  const recebiveis = await Transacao.find({
    emprestimoId,
    tipo: 'recebivel',
    status: 'ativo',
    emprestimoEhJurosAuto: { $ne: true }
  }).sort({ data: -1 }).lean();
  return recebiveis[0] || null;
}

/**
 * Helper: retorna o desembolso total e o recebimento total do Empréstimo,
 * somando caminho 1 (TX-level legado) e caminho 2 (pagamento-level novo).
 *
 * Usado por `recalcularJurosAuto` pra montar a observação da TX de juros
 * automáticos.
 *
 * @param {string|ObjectId} emprestimoId
 * @param {string|ObjectId} usuarioId
 * @returns {Promise<{ desembolso: number, recebimento: number }>}
 */
async function calcularTotaisRecebEDisbursed(emprestimoId, usuarioId) {
  // Lazy require pra evitar circular dependency com services/emprestimoService
  const { _agregarTotaisEmprestimo } = require('../services/emprestimoService');
  const t = await _agregarTotaisEmprestimo(emprestimoId, usuarioId);
  return {
    desembolso: t.totalDesembolsadoC1 + t.totalDesembolsadoC2,
    recebimento: t.totalRecebidoC1 + t.totalRecebidoC2
  };
}

function saoIguais(a, b, tolerancia = 0.005) {
  return Math.abs((Number(a) || 0) - (Number(b) || 0)) < tolerancia;
}

function observacaoIguais(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return String(a).trim() === String(b).trim();
}

/**
 * Mantém a transação de juros auto-criada em sincronia com o lucro
 * calculado para o empréstimo.
 *
 * @param {Object} emprestimo - Documento Emprestimo (precisa ter _id, usuario, pessoaNomeSnapshot)
 * @param {number} lucro - Lucro realizado (= soma_recebíveis - soma_gastos)
 * @param {Object} [opcoes]
 * @param {string} [opcoes.session] - Sessão MongoDB para atomicidade
 * @returns {Promise<{acao: 'criada'|'atualizada'|'deletada'|'mantida'|'nenhuma', transacao: Object|null}>}
 */
async function recalcularJurosAuto(emprestimo, lucro, opcoes = {}) {
  if (!emprestimo || !emprestimo._id) {
    throw new Error('recalcularJurosAuto: emprestimo inválido');
  }

  const emprestimoId = emprestimo._id;
  const txExistente = await Transacao.findOne({
    emprestimoId,
    emprestimoEhJurosAuto: true
  }).session(opcoes.session || null);

  const lucroArred = arredondarCentavos(lucro);

  if (!txExistente && (!lucroArred || lucroArred <= 0)) {
    return { acao: 'nenhuma', transacao: null };
  }

  if (!txExistente) {
    const ultima = await buscarSnapshotUltimoRecebimento(emprestimoId);
    if (!ultima) {
      return { acao: 'nenhuma', transacao: null };
    }
    const { desembolso, recebimento } = await calcularTotaisRecebEDisbursed(emprestimoId, emprestimo.usuario);
    const pessoaNome = emprestimo.pessoaNomeSnapshot || 'empréstimo';
    const nova = new Transacao({
      _id: new mongoose.Types.ObjectId(),
      usuario: emprestimo.usuario,
      tipo: 'recebivel',
      descricao: `Lucro - ${pessoaNome}`,
      valor: lucroArred,
      data: ultima.data || new Date(),
      observacao: montarObservacao({ pessoaNome, desembolso, totalReceb: recebimento, lucro: lucroArred }),
      emprestimoId,
      emprestimoEhJurosAuto: true,
      pagamentos: [{ pessoa: ultima.pagamentos?.[0]?.pessoa || '', valor: lucroArred, tags: ultima.pagamentos?.[0]?.tags || {} }],
      categoria: ultima.categoria || null,
      categoriaNome: ultima.categoriaNome || null,
      status: 'ativo'
    });
    if (opcoes.session) {
      await nova.save({ session: opcoes.session });
    } else {
      await nova.save();
    }
    return { acao: 'criada', transacao: nova };
  }

  if (!lucroArred || lucroArred <= 0) {
    if (opcoes.session) {
      await Transacao.deleteOne({ _id: txExistente._id }).session(opcoes.session);
    } else {
      await Transacao.deleteOne({ _id: txExistente._id });
    }
    return { acao: 'deletada', transacao: null };
  }

  const { desembolso, recebimento } = await calcularTotaisRecebEDisbursed(emprestimoId, emprestimo.usuario);
  const pessoaNome = emprestimo.pessoaNomeSnapshot || 'empréstimo';
  const observacao = montarObservacao({ pessoaNome, desembolso, totalReceb: recebimento, lucro: lucroArred });
  const valorMudou = !saoIguais(txExistente.valor, lucroArred);
  const obsMudou = !observacaoIguais(txExistente.observacao, observacao);

  if (!valorMudou && !obsMudou) {
    return { acao: 'mantida', transacao: txExistente };
  }

  txExistente.valor = lucroArred;
  txExistente.observacao = observacao;
  if (Array.isArray(txExistente.pagamentos) && txExistente.pagamentos.length > 0) {
    txExistente.pagamentos[0].valor = lucroArred;
  } else {
    txExistente.pagamentos = [{ pessoa: '', valor: lucroArred, tags: {} }];
  }
  if (opcoes.session) {
    await txExistente.save({ session: opcoes.session });
  } else {
    await txExistente.save();
  }
  return { acao: 'atualizada', transacao: txExistente };
}

module.exports = {
  recalcularJurosAuto,
  montarObservacao,
  calcularTotaisRecebEDisbursed
};
