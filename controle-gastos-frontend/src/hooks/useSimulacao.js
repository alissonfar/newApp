import { useMemo } from 'react';
import Decimal from 'decimal.js';

/** Dias úteis no ano (padrão financeiro, alinhado ao backend). */
const DIAS_UTEIS_ANO = 252;
const DIAS_UTEIS_MES = 21;
const MESES_NO_ANO = DIAS_UTEIS_ANO / DIAS_UTEIS_MES;

/**
 * Calcula taxa mensal equivalente para simulação.
 * CDI_ajustado = CDI_anual × (percentualCDI/100)
 * taxa_mensal = (1 + CDI_ajustado/100)^(1/12) - 1
 */
function calcularTaxaMensal(cdiAnualPercent, percentualCDI) {
  if (!cdiAnualPercent || !percentualCDI) return 0;
  const cdiAjustado = new Decimal(cdiAnualPercent).times(percentualCDI).div(100);
  const taxaMensal = new Decimal(1).plus(cdiAjustado.div(100)).pow(1 / MESES_NO_ANO).minus(1);
  return taxaMensal.toNumber();
}

/**
 * Calcula valor final com juros compostos.
 * valor_final = valor_inicial × (1 + taxa_mensal)^meses
 */
function calcularValorFinal(valorInicial, taxaMensal, meses) {
  if (!valorInicial || valorInicial <= 0 || !meses || meses <= 0) return valorInicial || 0;
  const valorFinal = new Decimal(valorInicial).times(
    new Decimal(1).plus(taxaMensal).pow(meses)
  );
  return valorFinal.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Hook para simulação de rendimento CDI em tempo real.
 * Retorna resultados calculados localmente sem requisições.
 * @param {number} cdiAnual - Taxa CDI anual em %
 * @param {number} valorInicial - Valor investido
 * @param {number} percentualCDI - Ex: 100, 110, 120
 * @param {number} meses - Período em meses
 * @returns {{ valorFinal: number, rendimentoTotal: number, percentualPeriodo: number, simulado100: object|null }}
 */
function useSimulacao(cdiAnual, valorInicial, percentualCDI, meses) {
  return useMemo(() => {
    const valorInicialNum = Number(valorInicial) || 0;
    const percentualNum = Number(percentualCDI) || 0;
    const mesesNum = Number(meses) || 0;

    if (!cdiAnual || valorInicialNum <= 0 || percentualNum <= 0 || mesesNum <= 0) {
      return {
        valorFinal: valorInicialNum,
        rendimentoTotal: 0,
        percentualPeriodo: 0,
        simulado100: null
      };
    }

    const taxaMensal = calcularTaxaMensal(cdiAnual, percentualNum);
    const valorFinal = calcularValorFinal(valorInicialNum, taxaMensal, mesesNum);
    const rendimentoTotal = new Decimal(valorFinal).minus(valorInicialNum)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
    const percentualPeriodo = valorInicialNum > 0
      ? new Decimal(rendimentoTotal).div(valorInicialNum).times(100)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
      : 0;

    // Comparação com 100% CDI (destaque visual)
    let simulado100 = null;
    if (percentualNum !== 100) {
      const taxaMensal100 = calcularTaxaMensal(cdiAnual, 100);
      const valorFinal100 = calcularValorFinal(valorInicialNum, taxaMensal100, mesesNum);
      const rendimento100 = new Decimal(valorFinal100).minus(valorInicialNum)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
      simulado100 = {
        valorFinal: valorFinal100,
        rendimentoTotal: rendimento100,
        percentualPeriodo: valorInicialNum > 0
          ? new Decimal(rendimento100).div(valorInicialNum).times(100)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber()
          : 0
      };
    }

    return {
      valorFinal,
      rendimentoTotal,
      percentualPeriodo,
      simulado100
    };
  }, [cdiAnual, valorInicial, percentualCDI, meses]);
}

export default useSimulacao;
export { calcularTaxaMensal, calcularValorFinal };
