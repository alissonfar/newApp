// backend/src/services/contaFixaService.js
const Decimal = require('decimal.js');

Decimal.set({ precision: 20, rounding: 4 });

function ultimoDiaDoMes(ano, mesIndexZeroBased) {
  return new Date(ano, mesIndexZeroBased + 1, 0).getDate();
}

function calcularDataDoDia(ano, mesIndexZeroBased, dia) {
  const ultimoDia = ultimoDiaDoMes(ano, mesIndexZeroBased);
  const diaAjustado = Math.min(dia, ultimoDia);
  return new Date(ano, mesIndexZeroBased, diaAjustado);
}

function calcularCiclo(contaFixa, dataReferencia = new Date()) {
  const anoLancamento = dataReferencia.getFullYear();
  const mesLancamento = dataReferencia.getMonth();

  const dataLancamento = calcularDataDoDia(anoLancamento, mesLancamento, contaFixa.diaLancamento);

  let anoVencimento = anoLancamento;
  let mesVencimento = mesLancamento;
  if (contaFixa.vencimentoMesSeguinte) {
    mesVencimento += 1;
    if (mesVencimento > 11) {
      mesVencimento = 0;
      anoVencimento += 1;
    }
  }
  const dataVencimento = calcularDataDoDia(anoVencimento, mesVencimento, contaFixa.diaVencimento);

  return { mesLancamento, anoLancamento, dataLancamento, dataVencimento };
}

function cicloJaProcessado(contaFixa, ciclo) {
  const ultimo = contaFixa.ultimoCicloProcessado;
  if (!ultimo || ultimo.mes == null || ultimo.ano == null) return false;
  return ultimo.mes === ciclo.mesLancamento && ultimo.ano === ciclo.anoLancamento;
}

function verificarEEncerrar(contaFixa, dataReferencia = new Date()) {
  if (contaFixa.status !== 'ativa') return false;

  const passouDataFim = contaFixa.dataFim && dataReferencia > contaFixa.dataFim;
  const atingiuRepeticoes = contaFixa.totalRepeticoes != null && contaFixa.totalGerados >= contaFixa.totalRepeticoes;

  if (passouDataFim || atingiuRepeticoes) {
    contaFixa.status = 'encerrada';
    return true;
  }
  return false;
}

function montarPagamentos(pagamentosTemplate, valorTotal, tagsPadrao = {}) {
  const total = new Decimal(valorTotal);

  const valoresCalculados = pagamentosTemplate.map((p) =>
    total.times(p.percentual).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
  );

  const somaParcial = valoresCalculados
    .slice(0, -1)
    .reduce((acc, v) => acc.plus(v), new Decimal(0));

  const ultimoIndice = valoresCalculados.length - 1;
  valoresCalculados[ultimoIndice] = total.minus(somaParcial).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return pagamentosTemplate.map((p, i) => ({
    pessoa: p.pessoa,
    valor: valoresCalculados[i].toNumber(),
    tags: p.tagsOverride || tagsPadrao
  }));
}

module.exports = {
  calcularCiclo,
  cicloJaProcessado,
  verificarEEncerrar,
  montarPagamentos
};
