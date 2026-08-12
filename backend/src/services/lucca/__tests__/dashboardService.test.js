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

const { calcularProximaMamadaEstimada, calcularProximaSonecaEstimada } = require('../dashboardService');

describe('calcularProximaMamadaEstimada', () => {
  test('com mamadas a cada 3h, estima a próxima 3h após a última', () => {
    const eventos = [
      { inicio: '2026-08-20T09:00:00Z', fim: '2026-08-20T09:20:00Z' },
      { inicio: '2026-08-20T12:00:00Z', fim: '2026-08-20T12:20:00Z' },
      { inicio: '2026-08-20T15:00:00Z', fim: '2026-08-20T15:20:00Z' }
    ];
    const resultado = calcularProximaMamadaEstimada(eventos);
    expect(resultado.toISOString()).toBe('2026-08-20T18:00:00.000Z');
  });

  test('com menos de 2 mamadas concluídas, retorna null', () => {
    const eventos = [{ inicio: '2026-08-20T09:00:00Z', fim: '2026-08-20T09:20:00Z' }];
    expect(calcularProximaMamadaEstimada(eventos)).toBeNull();
  });
});

describe('calcularProximaSonecaEstimada', () => {
  test('soma a janela de vigília ao horário que acordou do último sono', () => {
    const resultado = calcularProximaSonecaEstimada('2026-08-20T10:00:00Z', 90);
    expect(resultado.toISOString()).toBe('2026-08-20T11:30:00.000Z');
  });

  test('sem último sono ou sem janela configurada, retorna null', () => {
    expect(calcularProximaSonecaEstimada(null, 90)).toBeNull();
    expect(calcularProximaSonecaEstimada('2026-08-20T10:00:00Z', null)).toBeNull();
  });
});
