const { calcularCiclo, cicloJaProcessado, verificarEEncerrar } = require('../contaFixaService');

describe('calcularCiclo', () => {
  it('calcula lançamento e vencimento no mesmo mês quando vencimentoMesSeguinte é false', () => {
    const contaFixa = { diaLancamento: 1, diaVencimento: 12, vencimentoMesSeguinte: false };
    const ciclo = calcularCiclo(contaFixa, new Date(2026, 0, 5)); // 5 de janeiro de 2026

    expect(ciclo.mesLancamento).toBe(0);
    expect(ciclo.anoLancamento).toBe(2026);
    expect(ciclo.dataLancamento).toEqual(new Date(2026, 0, 1));
    expect(ciclo.dataVencimento).toEqual(new Date(2026, 0, 12));
  });

  it('calcula vencimento no mês seguinte quando vencimentoMesSeguinte é true', () => {
    const contaFixa = { diaLancamento: 28, diaVencimento: 5, vencimentoMesSeguinte: true };
    const ciclo = calcularCiclo(contaFixa, new Date(2026, 0, 28)); // 28 de janeiro de 2026

    expect(ciclo.dataLancamento).toEqual(new Date(2026, 0, 28));
    expect(ciclo.dataVencimento).toEqual(new Date(2026, 1, 5)); // 5 de fevereiro
  });

  it('vencimento no mês seguinte cruzando o ano (dezembro -> janeiro)', () => {
    const contaFixa = { diaLancamento: 28, diaVencimento: 5, vencimentoMesSeguinte: true };
    const ciclo = calcularCiclo(contaFixa, new Date(2026, 11, 28)); // 28 de dezembro de 2026

    expect(ciclo.dataVencimento).toEqual(new Date(2027, 0, 5));
  });

  it('ajusta dia 31 para o último dia do mês quando o mês é mais curto', () => {
    const contaFixa = { diaLancamento: 31, diaVencimento: 31, vencimentoMesSeguinte: false };
    const ciclo = calcularCiclo(contaFixa, new Date(2026, 1, 1)); // fevereiro de 2026 (28 dias, não bissexto)

    expect(ciclo.dataLancamento).toEqual(new Date(2026, 1, 28));
    expect(ciclo.dataVencimento).toEqual(new Date(2026, 1, 28));
  });
});

describe('cicloJaProcessado', () => {
  it('retorna false quando ultimoCicloProcessado é null', () => {
    const contaFixa = { ultimoCicloProcessado: null };
    const ciclo = { mesLancamento: 0, anoLancamento: 2026 };
    expect(cicloJaProcessado(contaFixa, ciclo)).toBe(false);
  });

  it('retorna true quando ultimoCicloProcessado bate com o ciclo atual', () => {
    const contaFixa = { ultimoCicloProcessado: { mes: 0, ano: 2026 } };
    const ciclo = { mesLancamento: 0, anoLancamento: 2026 };
    expect(cicloJaProcessado(contaFixa, ciclo)).toBe(true);
  });

  it('retorna false quando ultimoCicloProcessado é de outro mês', () => {
    const contaFixa = { ultimoCicloProcessado: { mes: 11, ano: 2025 } };
    const ciclo = { mesLancamento: 0, anoLancamento: 2026 };
    expect(cicloJaProcessado(contaFixa, ciclo)).toBe(false);
  });
});

describe('verificarEEncerrar', () => {
  it('encerra quando dataReferencia passou de dataFim', () => {
    const contaFixa = { status: 'ativa', dataFim: new Date(2026, 0, 1), totalRepeticoes: null };
    const encerrou = verificarEEncerrar(contaFixa, new Date(2026, 0, 2));

    expect(encerrou).toBe(true);
    expect(contaFixa.status).toBe('encerrada');
  });

  it('encerra quando totalGerados atinge totalRepeticoes', () => {
    const contaFixa = { status: 'ativa', dataFim: null, totalRepeticoes: 3, totalGerados: 3 };
    const encerrou = verificarEEncerrar(contaFixa, new Date());

    expect(encerrou).toBe(true);
    expect(contaFixa.status).toBe('encerrada');
  });

  it('não encerra quando ainda não atingiu dataFim nem totalRepeticoes', () => {
    const contaFixa = { status: 'ativa', dataFim: new Date(2027, 0, 1), totalRepeticoes: 12, totalGerados: 3 };
    const encerrou = verificarEEncerrar(contaFixa, new Date(2026, 0, 1));

    expect(encerrou).toBe(false);
    expect(contaFixa.status).toBe('ativa');
  });
});
