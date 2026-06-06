/**
 * utils/emprestimoQuitacao.js
 *
 * Lógica de cálculo e manutenção da transação de juros auto-criada na quitação
 * de um empréstimo. Extraída de services/emprestimoService.js para permitir
 * atualização (não apenas criação) quando o cálculo de juros muda após
 * edições/estornos.
 *
 * Comportamento:
 *  - Se totalJuros <= 0 e já existe tx de juros auto → DELETAR (reverter quitação)
 *  - Se totalJuros > 0 e já existe tx de juros auto → ATUALIZAR valor + observação
 *  - Se totalJuros > 0 e não existe → CRIAR nova tx
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

function montarObservacao({ pessoaNome, desembolso, totalReceb, totalJuros }) {
  const principalDevolvido = Math.max(0, totalReceb - totalJuros);
  return (
    `Juros do empréstimo para ${pessoaNome}. ` +
    `Desembolsos: R$ ${formatarMoeda(desembolso)}, ` +
    `Recebimentos: R$ ${formatarMoeda(totalReceb)}, ` +
    `Principal devolvido: R$ ${formatarMoeda(principalDevolvido)}, ` +
    `Juros: R$ ${formatarMoeda(totalJuros)}.`
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

async function calcularTotaisRecebEDisbursed(emprestimoId) {
  const agregados = await Transacao.aggregate([
    {
      $match: {
        emprestimoId: new mongoose.Types.ObjectId(String(emprestimoId)),
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
  let desembolso = 0;
  let recebimento = 0;
  for (const a of agregados) {
    if (a._id === 'gasto') desembolso = a.total;
    else if (a._id === 'recebivel') recebimento = a.total;
  }
  return { desembolso, recebimento };
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
 * Mantém a transação de juros auto-criada em sincronia com o totalJuros
 * calculado para o empréstimo.
 *
 * @param {Object} emprestimo - Documento Emprestimo (precisa ter _id, usuario, pessoaNomeSnapshot, direcao)
 * @param {number} totalJuros - Total de juros calculado pelo FIFO
 * @param {Object} [opcoes]
 * @param {string} [opcoes.session] - Sessão MongoDB para atomicidade
 * @returns {Promise<{acao: 'criada'|'atualizada'|'deletada'|'mantida'|'nenhuma', transacao: Object|null}>}
 */
async function recalcularJurosAuto(emprestimo, totalJuros, opcoes = {}) {
  if (!emprestimo || !emprestimo._id) {
    throw new Error('recalcularJurosAuto: emprestimo inválido');
  }

  const emprestimoId = emprestimo._id;
  const txExistente = await Transacao.findOne({
    emprestimoId,
    emprestimoEhJurosAuto: true
  }).session(opcoes.session || null);

  const totalJurosArred = arredondarCentavos(totalJuros);

  if (!txExistente && (!totalJurosArred || totalJurosArred <= 0)) {
    return { acao: 'nenhuma', transacao: null };
  }

  if (!txExistente) {
    const ultima = await buscarSnapshotUltimoRecebimento(emprestimoId);
    if (!ultima) {
      return { acao: 'nenhuma', transacao: null };
    }
    const { desembolso, recebimento } = await calcularTotaisRecebEDisbursed(emprestimoId);
    const pessoaNome = emprestimo.pessoaNomeSnapshot || 'empréstimo';
    const nova = new Transacao({
      _id: new mongoose.Types.ObjectId(),
      usuario: emprestimo.usuario,
      tipo: 'recebivel',
      descricao: `Juros - ${pessoaNome}`,
      valor: totalJurosArred,
      data: ultima.data || new Date(),
      observacao: montarObservacao({ pessoaNome, desembolso, totalReceb: recebimento, totalJuros: totalJurosArred }),
      emprestimoId,
      emprestimoEhJurosAuto: true,
      pagamentos: [{ pessoa: ultima.pagamentos?.[0]?.pessoa || '', valor: totalJurosArred, tags: ultima.pagamentos?.[0]?.tags || {} }],
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

  if (!totalJurosArred || totalJurosArred <= 0) {
    if (opcoes.session) {
      await Transacao.deleteOne({ _id: txExistente._id }).session(opcoes.session);
    } else {
      await Transacao.deleteOne({ _id: txExistente._id });
    }
    return { acao: 'deletada', transacao: null };
  }

  const { desembolso, recebimento } = await calcularTotaisRecebEDisbursed(emprestimoId);
  const pessoaNome = emprestimo.pessoaNomeSnapshot || 'empréstimo';
  const observacao = montarObservacao({ pessoaNome, desembolso, totalReceb: recebimento, totalJuros: totalJurosArred });
  const valorMudou = !saoIguais(txExistente.valor, totalJurosArred);
  const obsMudou = !observacaoIguais(txExistente.observacao, observacao);

  if (!valorMudou && !obsMudou) {
    return { acao: 'mantida', transacao: txExistente };
  }

  txExistente.valor = totalJurosArred;
  txExistente.observacao = observacao;
  if (Array.isArray(txExistente.pagamentos) && txExistente.pagamentos.length > 0) {
    txExistente.pagamentos[0].valor = totalJurosArred;
  } else {
    txExistente.pagamentos = [{ pessoa: '', valor: totalJurosArred, tags: {} }];
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
