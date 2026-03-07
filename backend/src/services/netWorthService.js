// src/services/netWorthService.js
const mongoose = require('mongoose');
const LedgerPatrimonial = require('../models/ledgerPatrimonial');
const Subconta = require('../models/subconta');

/**
 * Retorna patrimônio total e por conta em uma data específica.
 * Usa o Ledger como fonte de verdade.
 *
 * @param {string} usuarioId - ID do usuário
 * @param {Date} data - Data de corte (eventos com dataEvento <= data)
 * @param {Object} [filtros] - Filtros opcionais
 * @param {string[]} [filtros.subcontaIds] - IDs de subcontas a incluir
 * @param {string} [filtros.tipoConta] - Tipo de conta (corrente, rendimento_automatico, caixinha, investimento_fixo)
 * @param {string} [filtros.proposito] - Propósito (disponivel, reserva_emergencia, objetivo, guardado)
 * @param {string} [filtros.origemSistema] - Origem do evento (importacao_ofx, importacao_csv, etc.)
 * @returns {Promise<{total: number, accounts: Array<{accountId: string, accountName: string, balance: number, tipo: string, proposito: string}>}>}
 */
async function patrimonioEmData(usuarioId, data, filtros = {}) {
  const dataDate = data instanceof Date ? data : new Date(data);
  const match = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    dataEvento: { $lte: dataDate }
  };

  if (filtros.subcontaIds && filtros.subcontaIds.length > 0) {
    match.subconta = {
      $in: filtros.subcontaIds.map(id => new mongoose.Types.ObjectId(id))
    };
  }

  if (filtros.origemSistema) {
    match.origemSistema = filtros.origemSistema;
  }

  const saldosPorSubconta = await LedgerPatrimonial.aggregate([
    { $match: match },
    { $sort: { dataEvento: 1, createdAt: 1 } },
    {
      $group: {
        _id: '$subconta',
        balance: { $sum: '$valor' }
      }
    }
  ]);

  if (saldosPorSubconta.length === 0) {
    return { total: 0, accounts: [] };
  }

  const subcontaIds = saldosPorSubconta.map(s => s._id);
  const subcontasMatch = { _id: { $in: subcontaIds }, usuario: new mongoose.Types.ObjectId(usuarioId) };

  if (filtros.tipoConta) {
    subcontasMatch.tipo = filtros.tipoConta;
  }
  if (filtros.proposito) {
    subcontasMatch.proposito = filtros.proposito;
  }

  const subcontas = await Subconta.find(subcontasMatch)
    .populate('instituicao')
    .lean();

  const subcontaMap = new Map(subcontas.map(s => [s._id.toString(), s]));
  const saldoMap = new Map(saldosPorSubconta.map(s => [s._id.toString(), s.balance]));

  const accounts = [];
  let total = 0;

  for (const [subcontaIdStr, saldo] of saldoMap) {
    const subconta = subcontaMap.get(subcontaIdStr);
    if (!subconta) continue;

    const balance = saldo;
    total += balance;

    accounts.push({
      accountId: subcontaIdStr,
      accountName: subconta.instituicao
        ? `${subconta.instituicao.nome} - ${subconta.nome}`
        : subconta.nome,
      balance,
      tipo: subconta.tipo,
      proposito: subconta.proposito
    });
  }

  return {
    total,
    accounts: accounts.sort((a, b) => a.accountName.localeCompare(b.accountName))
  };
}

/**
 * Gera datas de intervalo conforme o tipo.
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} interval - day | week | month | year
 * @returns {Date[]}
 */
function gerarDatasIntervalo(startDate, endDate, interval) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  const d = new Date(start);
  d.setHours(0, 0, 0, 0);

  while (d <= end) {
    dates.push(new Date(d));

    switch (interval) {
      case 'day':
        d.setDate(d.getDate() + 1);
        break;
      case 'week':
        d.setDate(d.getDate() + 7);
        break;
      case 'month':
        d.setMonth(d.getMonth() + 1);
        d.setDate(1);
        break;
      case 'year':
        d.setFullYear(d.getFullYear() + 1);
        d.setMonth(0);
        d.setDate(1);
        break;
      default:
        d.setMonth(d.getMonth() + 1);
        d.setDate(1);
    }
  }

  return dates;
}

/**
 * Retorna evolução do patrimônio ao longo do tempo.
 * Usa o Ledger como fonte de verdade.
 *
 * @param {string} usuarioId - ID do usuário
 * @param {Object} opts
 * @param {Date|string} opts.startDate - Data inicial
 * @param {Date|string} opts.endDate - Data final
 * @param {string} [opts.interval='month'] - day | week | month | year
 * @param {string[]} [opts.subcontaIds] - IDs de subcontas a incluir
 * @param {string} [opts.tipoConta] - Tipo de conta
 * @param {string} [opts.proposito] - Propósito
 * @param {string} [opts.origemSistema] - Origem do evento
 * @returns {Promise<Array<{date: string, total: number, accounts?: Array}>}
 */
async function evolucaoPatrimonio(usuarioId, opts = {}) {
  const startDate = opts.startDate ? new Date(opts.startDate) : new Date();
  const endDate = opts.endDate ? new Date(opts.endDate) : new Date();
  const interval = opts.interval || 'month';

  const match = {
    usuario: new mongoose.Types.ObjectId(usuarioId),
    dataEvento: { $lte: endDate }
  };

  if (opts.subcontaIds && opts.subcontaIds.length > 0) {
    match.subconta = {
      $in: opts.subcontaIds.map(id => new mongoose.Types.ObjectId(id))
    };
  }

  if (opts.origemSistema) {
    match.origemSistema = opts.origemSistema;
  }

  const eventos = await LedgerPatrimonial.find(match)
    .sort({ dataEvento: 1, createdAt: 1 })
    .select('subconta dataEvento valor')
    .lean();

  const datasIntervalo = gerarDatasIntervalo(startDate, endDate, interval);
  if (datasIntervalo.length === 0) {
    return [];
  }

  const subcontaIds = [...new Set(eventos.map(e => e.subconta.toString()))];
  const subcontasMatch = { _id: { $in: subcontaIds.map(id => new mongoose.Types.ObjectId(id)) }, usuario: new mongoose.Types.ObjectId(usuarioId) };
  if (opts.tipoConta) subcontasMatch.tipo = opts.tipoConta;
  if (opts.proposito) subcontasMatch.proposito = opts.proposito;

  const subcontas = await Subconta.find(subcontasMatch).lean();
  const subcontaIdsFiltrados = new Set(subcontas.map(s => s._id.toString()));

  const saldosPorSubconta = new Map();
  let idxEvento = 0;
  const resultado = [];

  for (const dataPonto of datasIntervalo) {
    const dataPontoEnd = new Date(dataPonto);
    dataPontoEnd.setHours(23, 59, 59, 999);

    while (idxEvento < eventos.length) {
      const ev = eventos[idxEvento];
      const dataEv = new Date(ev.dataEvento);
      if (dataEv > dataPontoEnd) break;

      if (!subcontaIdsFiltrados.has(ev.subconta.toString())) {
        idxEvento++;
        continue;
      }

      const key = ev.subconta.toString();
      const atual = saldosPorSubconta.get(key) || 0;
      saldosPorSubconta.set(key, atual + ev.valor);
      idxEvento++;
    }

    const total = Array.from(saldosPorSubconta.values()).reduce((a, b) => a + b, 0);
    resultado.push({
      date: dataPonto.toISOString().split('T')[0],
      total
    });
  }

  return resultado;
}

module.exports = {
  patrimonioEmData,
  evolucaoPatrimonio
};
