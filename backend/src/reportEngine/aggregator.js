// src/reportEngine/aggregator.js
const { TagEffect } = require('./types');

function parseValor(val) {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

/**
 * Agregação default: totalValue, totalGastos, totalRecebiveis, netValue, totalPeople.
 * Considera effect: ignore = não soma; subtract = subtrai; add = soma.
 */
function aggregateDefault(rows) {
  let totalValue = 0;
  let totalGastos = 0;
  let totalRecebiveis = 0;
  const peopleSet = new Set();

  for (const row of rows) {
    if (row.effect === TagEffect.IGNORE) continue;
    const v = parseValor(row.valorPagamento);
    if (row.effect === TagEffect.SUBTRACT) {
      totalValue -= v;
      if (row.tipo === 'gasto') totalGastos -= v;
      else totalRecebiveis -= v;
    } else {
      totalValue += v;
      if (row.tipo === 'gasto') totalGastos += v;
      else totalRecebiveis += v;
    }
    if (row.pessoa) peopleSet.add(row.pessoa);
  }

  const totalPeople = peopleSet.size;
  const netValue = totalRecebiveis - totalGastos;
  const averagePerPerson = totalPeople > 0 ? totalValue / totalPeople : 0;

  return {
    totalRows: rows.filter((r) => r.effect !== TagEffect.IGNORE).length,
    totalValue: totalValue.toFixed(2),
    totalGastos: totalGastos.toFixed(2),
    totalRecebiveis: totalRecebiveis.toFixed(2),
    netValue: netValue.toFixed(2),
    totalPeople,
    averagePerPerson: averagePerPerson.toFixed(2)
  };
}

/**
 * Agregação devedor: totalBruto, totalPago (subtract), totalDevido.
 * totalBruto = soma de tudo que não é ignore
 * totalPago = soma dos valores com effect subtract (pagamentos marcados como PAGO)
 * totalDevido = totalBruto - totalPago
 */
function aggregateDevedor(rows) {
  let totalBruto = 0;
  let totalPago = 0;

  for (const row of rows) {
    if (row.effect === TagEffect.IGNORE) continue;
    const v = parseValor(row.valorPagamento);
    totalBruto += v;
    if (row.effect === TagEffect.SUBTRACT) {
      totalPago += v;
    }
  }

  const totalDevido = totalBruto - totalPago;
  const peopleSet = new Set(rows.filter((r) => r.effect !== TagEffect.IGNORE && r.pessoa).map((r) => r.pessoa));

  return {
    totalBruto: totalBruto.toFixed(2),
    totalPago: totalPago.toFixed(2),
    totalDevido: totalDevido.toFixed(2),
    totalRows: rows.filter((r) => r.effect !== TagEffect.IGNORE).length,
    totalPeople: peopleSet.size
  };
}

/**
 * Dispatcher por tipo de agregação.
 * @param {Array} rows - linhas com effect
 * @param {string} aggregationType - 'default' | 'devedor'
 * @returns {Object} summary
 */
function aggregate(rows, aggregationType) {
  switch (aggregationType) {
    case 'devedor':
      return aggregateDevedor(rows);
    default:
      return aggregateDefault(rows);
  }
}

module.exports = {
  aggregate,
  aggregateDefault,
  aggregateDevedor
};
