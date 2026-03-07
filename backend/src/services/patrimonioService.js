// src/services/patrimonioService.js
const Subconta = require('../models/subconta');
const HistoricoSaldo = require('../models/historicoSaldo');
const Instituicao = require('../models/instituicao');
const taxaCDIService = require('./taxaCDIService');

const DIAS_ALERTA_DESATUALIZADO = 7;

/**
 * Retorna resumo do patrimônio do usuário.
 * @param {string} usuarioId
 * @returns {Promise<{totalGeral: number, porInstituicao: Array, porProposito: Array, rendimentoEstimadoConsolidado: number, subcontasDesatualizadas: Array}>}
 */
async function obterResumo(usuarioId) {
  const subcontas = await Subconta.find({ usuario: usuarioId, ativo: true })
    .populate('instituicao')
    .lean();

  const totalGeral = subcontas.reduce((acc, s) => acc + (s.saldoAtual || 0), 0);

  const porInstituicaoMap = new Map();
  for (const sc of subcontas) {
    const inst = sc.instituicao;
    const key = inst ? inst._id.toString() : 'sem_instituicao';
    const nome = inst ? inst.nome : 'Sem instituição';
    if (!porInstituicaoMap.has(key)) {
      porInstituicaoMap.set(key, { instituicaoId: key, nome, total: 0, subcontas: [] });
    }
    const item = porInstituicaoMap.get(key);
    item.total += sc.saldoAtual || 0;
    item.subcontas.push(sc);
  }
  const porInstituicao = Array.from(porInstituicaoMap.values());

  const porPropositoMap = new Map();
  const propositos = ['disponivel', 'reserva_emergencia', 'objetivo', 'guardado'];
  const labels = {
    disponivel: 'Disponível',
    reserva_emergencia: 'Reserva de Emergência',
    objetivo: 'Objetivo',
    guardado: 'Guardado'
  };
  for (const p of propositos) {
    porPropositoMap.set(p, { proposito: p, label: labels[p], total: 0 });
  }
  for (const sc of subcontas) {
    const p = sc.proposito || 'disponivel';
    if (porPropositoMap.has(p)) {
      porPropositoMap.get(p).total += sc.saldoAtual || 0;
    }
  }
  const porProposito = Array.from(porPropositoMap.values());

  const taxa = await taxaCDIService.obterOuAtualizarTaxaAtual();
  let rendimentoEstimadoConsolidado = 0;
  if (taxa) {
    for (const sc of subcontas) {
      const percentual = sc.percentualCDI || (sc.rendimento && sc.rendimento.percentualCDI) || 0;
      if (percentual && sc.saldoAtual) {
        rendimentoEstimadoConsolidado += taxaCDIService.calcularRendimentoDiario(
          sc.saldoAtual,
          taxa.taxaDiaria,
          percentual
        );
      }
    }
  }
  rendimentoEstimadoConsolidado *= 30;

  const limiteData = new Date();
  limiteData.setDate(limiteData.getDate() - DIAS_ALERTA_DESATUALIZADO);
  const subcontasDesatualizadas = subcontas.filter(sc => {
    if (!sc.dataUltimaConfirmacao) return true;
    return new Date(sc.dataUltimaConfirmacao) < limiteData;
  }).map(sc => ({
    _id: sc._id,
    nome: sc.nome,
    instituicao: sc.instituicao?.nome,
    dataUltimaConfirmacao: sc.dataUltimaConfirmacao
  }));

  return {
    totalGeral,
    porInstituicao,
    porProposito,
    rendimentoEstimadoConsolidado,
    subcontasDesatualizadas
  };
}

/**
 * Retorna evolução do patrimônio ao longo do tempo.
 * @param {string} usuarioId
 * @param {Object} opts - { dataInicio?: Date, dataFim?: Date }
 * @returns {Promise<Array<{data: Date, total: number}>>}
 */
async function obterEvolucao(usuarioId, opts = {}) {
  const { dataInicio, dataFim } = opts;
  const match = { usuario: usuarioId };
  if (dataInicio) match.data = match.data || {};
  if (dataInicio) match.data.$gte = dataInicio;
  if (dataFim) {
    match.data = match.data || {};
    match.data.$lte = dataFim;
  }

  const historicos = await HistoricoSaldo.aggregate([
    { $match: match },
    { $sort: { data: 1, createdAt: 1 } },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$data' }
        },
        registros: { $push: { subconta: '$subconta', saldo: '$saldo' } }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const resultado = [];
  const saldosPorSubconta = new Map();

  for (const h of historicos) {
    for (const r of h.registros) {
      saldosPorSubconta.set(r.subconta.toString(), r.saldo);
    }
    const total = Array.from(saldosPorSubconta.values()).reduce((a, b) => a + b, 0);
    resultado.push({
      data: new Date(h._id + 'T12:00:00.000Z'),
      total
    });
  }

  return resultado;
}

/**
 * Retorna evolução do patrimônio: para cada data, soma o último saldo conhecido de cada subconta.
 */
async function obterEvolucaoSimplificada(usuarioId, opts = {}) {
  const mongoose = require('mongoose');
  const match = { usuario: new mongoose.Types.ObjectId(usuarioId) };
  if (opts.dataInicio) match.data = { ...(match.data || {}), $gte: new Date(opts.dataInicio) };
  if (opts.dataFim) match.data = { ...(match.data || {}), $lte: new Date(opts.dataFim) };

  const historicos = await HistoricoSaldo.find(match).sort({ data: 1, createdAt: 1 }).lean();
  const saldosPorSubconta = new Map();
  const resultadoMap = new Map();

  for (const h of historicos) {
    const subcontaId = h.subconta.toString();
    saldosPorSubconta.set(subcontaId, h.saldo);
    const dataStr = h.data.toISOString().split('T')[0];
    const total = Array.from(saldosPorSubconta.values()).reduce((a, b) => a + b, 0);
    resultadoMap.set(dataStr, { data: h.data, total });
  }

  return Array.from(resultadoMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v);
}

module.exports = {
  obterResumo,
  obterEvolucao: obterEvolucaoSimplificada
};
