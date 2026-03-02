// src/services/financial.service.js
const Decimal = require('decimal.js');

// Configurar precisão para cálculos financeiros
Decimal.set({ precision: 20, rounding: 4 });

const DIAS_UTEIS_ANO = 252;

/**
 * Converte taxa anual (% ao ano) para taxa mensal equivalente.
 * Fórmula: (1 + taxaAnual/100)^(1/12) - 1
 * @param {number} taxaAnualPercent - Ex: 13.65
 * @returns {number} Taxa mensal em decimal
 */
function taxaAnualParaMensalEquivalente(taxaAnualPercent) {
  const taxaAnualDecimal = new Decimal(taxaAnualPercent).div(100);
  const umMaisTaxa = new Decimal(1).plus(taxaAnualDecimal);
  const taxaMensal = umMaisTaxa.pow(1 / 12).minus(1);
  return taxaMensal.toNumber();
}

/**
 * Converte taxa anual (% ao ano) para taxa diária equivalente (252 dias úteis).
 * Fórmula: (1 + taxaAnual/100)^(1/252) - 1
 * @param {number} taxaAnualPercent - Ex: 13.65
 * @returns {number} Taxa diária em decimal
 */
function taxaAnualParaDiariaEquivalente(taxaAnualPercent) {
  const taxaAnualDecimal = new Decimal(taxaAnualPercent).div(100);
  const umMaisTaxa = new Decimal(1).plus(taxaAnualDecimal);
  const taxaDiaria = umMaisTaxa.pow(1 / DIAS_UTEIS_ANO).minus(1);
  return taxaDiaria.toNumber();
}

/**
 * Calcula valor final com juros compostos baseado em CDI.
 * CDI_ajustado = CDI_anual × (percentualCDI/100)
 * taxa_mensal = (1 + CDI_ajustado/100)^(1/12) - 1
 * valor_final = valor_inicial × (1 + taxa_mensal)^meses
 * @param {number} valorInicial
 * @param {number} cdiAnualPercent
 * @param {number} percentualCDI - Ex: 100, 110, 120
 * @param {number} meses
 * @returns {number} Valor final
 */
function calcularRendimentoSimulado(valorInicial, cdiAnualPercent, percentualCDI, meses) {
  if (!valorInicial || valorInicial <= 0 || !cdiAnualPercent || !percentualCDI || !meses || meses <= 0) {
    return valorInicial || 0;
  }
  const cdiAjustado = new Decimal(cdiAnualPercent).times(percentualCDI).div(100);
  const taxaMensalDecimal = new Decimal(1).plus(cdiAjustado.div(100)).pow(1 / 12).minus(1);
  const valorFinal = new Decimal(valorInicial).times(
    new Decimal(1).plus(taxaMensalDecimal).pow(meses)
  );
  return valorFinal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Simula rendimento CDI e retorna objeto completo.
 * @param {number} valorInicial
 * @param {number} cdiAnualPercent
 * @param {number} percentualCDI
 * @param {number} meses
 * @returns {{ valorInvestido: number, valorFinal: number, rendimentoTotal: number, percentualPeriodo: number }}
 */
function simularCdiYield(valorInicial, cdiAnualPercent, percentualCDI, meses) {
  const valorInvestido = Number(valorInicial) || 0;
  const valorFinal = calcularRendimentoSimulado(valorInvestido, cdiAnualPercent, percentualCDI, meses);
  const rendimentoTotal = new Decimal(valorFinal).minus(valorInvestido).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
  const percentualPeriodo = valorInvestido > 0
    ? new Decimal(rendimentoTotal).div(valorInvestido).times(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
    : 0;

  return {
    valorInvestido,
    valorFinal,
    rendimentoTotal,
    percentualPeriodo
  };
}

module.exports = {
  taxaAnualParaMensalEquivalente,
  taxaAnualParaDiariaEquivalente,
  calcularRendimentoSimulado,
  simularCdiYield
};
