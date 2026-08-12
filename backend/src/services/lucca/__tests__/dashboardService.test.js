const { calcularIdade, calcularIdadeCorrigida } = require('../dashboardService');

describe('calcularIdade', () => {
  test('bebê de 14 dias tem 2 semanas e 0 dias', () => {
    const resultado = calcularIdade(new Date('2026-08-06'), new Date('2026-08-20'));
    expect(resultado).toEqual({ semanas: 2, dias: 0, diasTotais: 14 });
  });
});

describe('calcularIdadeCorrigida', () => {
  test('bebê de 30 dias com 37 semanas e 5 dias de gestação tem idade corrigida de 2 semanas', () => {
    const resultado = calcularIdadeCorrigida(
      new Date('2026-08-06'),
      { semanas: 37, dias: 5 },
      new Date('2026-09-05')
    );
    expect(resultado).toEqual({ semanas: 2, dias: 0, diasTotais: 14 });
  });

  test('idade corrigida nunca fica negativa antes da data provável do parto', () => {
    const resultado = calcularIdadeCorrigida(
      new Date('2026-08-06'),
      { semanas: 37, dias: 5 },
      new Date('2026-08-10')
    );
    expect(resultado.diasTotais).toBe(0);
  });
});
