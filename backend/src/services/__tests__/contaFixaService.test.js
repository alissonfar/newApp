const { calcularCiclo, cicloJaProcessado, verificarEEncerrar, montarPagamentos } = require('../contaFixaService');

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

describe('montarPagamentos', () => {
  it('divide o valor proporcionalmente e a soma bate exatamente com o valor total', () => {
    const template = [
      { pessoa: 'Alisson', percentual: 60 },
      { pessoa: 'Outra Pessoa', percentual: 40 }
    ];
    const pagamentos = montarPagamentos(template, 100.01);

    const soma = pagamentos.reduce((acc, p) => acc + p.valor, 0);
    expect(Math.round(soma * 100) / 100).toBe(100.01);
    expect(pagamentos[0].valor).toBe(60.01);
    expect(pagamentos[1].valor).toBe(40);
  });

  it('pagamento único (100%) retorna o valor total sem perda de centavos', () => {
    const template = [{ pessoa: 'Alisson', percentual: 100 }];
    const pagamentos = montarPagamentos(template, 33.33);

    expect(pagamentos).toHaveLength(1);
    expect(pagamentos[0].valor).toBe(33.33);
  });

  it('usa tagsOverride do template quando presente, senão cai no tagsPadrao', () => {
    const template = [
      { pessoa: 'Alisson', percentual: 50, tagsOverride: { cat1: ['tagA'] } },
      { pessoa: 'Outra Pessoa', percentual: 50 }
    ];
    const pagamentos = montarPagamentos(template, 100, { catPadrao: ['tagB'] });

    expect(pagamentos[0].tags).toEqual({ cat1: ['tagA'] });
    expect(pagamentos[1].tags).toEqual({ catPadrao: ['tagB'] });
  });

  it('divide três partes iguais sem perder centavos na soma', () => {
    const template = [
      { pessoa: 'A', percentual: 33.34 },
      { pessoa: 'B', percentual: 33.33 },
      { pessoa: 'C', percentual: 33.33 }
    ];
    const pagamentos = montarPagamentos(template, 10);

    const soma = pagamentos.reduce((acc, p) => acc + p.valor, 0);
    expect(Math.round(soma * 100) / 100).toBe(10);
  });
});
