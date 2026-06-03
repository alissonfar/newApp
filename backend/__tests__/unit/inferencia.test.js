const inferencia = require('../../src/services/inferenciaImportacaoService');

describe('Inferencia Importacao Service', () => {
  test('extrairMetadados: ordena datas e calcula totais', () => {
    const transacoes = [
      { data: new Date('2026-03-15T12:00:00Z'), tipo: 'gasto', valor: 100 },
      { data: new Date('2026-03-02T12:00:00Z'), tipo: 'recebivel', valor: 2000 },
      { data: new Date('2026-03-20T12:00:00Z'), tipo: 'gasto', valor: 50.5 }
    ];
    const meta = inferencia.extrairMetadados({
      transacoes,
      filename: 'extrato_nubank_2026-03.csv',
      parserId: 'nubank_extrato'
    });
    expect(meta.totalRegistros).toBe(3);
    expect(meta.totalCreditos).toBe(2000);
    expect(meta.totalDebitos).toBe(150.5);
    expect(meta.dataInicial.toISOString()).toBe('2026-03-02T12:00:00.000Z');
    expect(meta.dataFinal.toISOString()).toBe('2026-03-20T12:00:00.000Z');
    expect(meta.periodoCompetencia).toBe('2026-03');
    expect(meta.tituloSugerido).toMatch(/Nubank Extrato/);
    expect(meta.tituloSugerido).toMatch(/Mar\/2026/);
  });

  test('extrairMetadados: array vazio retorna nulos', () => {
    const meta = inferencia.extrairMetadados({ transacoes: [], filename: 'x.csv' });
    expect(meta.totalRegistros).toBe(0);
    expect(meta.dataInicial).toBeNull();
    expect(meta.tituloSugerido).toBeNull();
  });

  test('sugerirTitulo: usa nome do parser quando disponível', () => {
    const t = inferencia.sugerirTitulo({
      filename: 'lixo.csv',
      parserId: 'nubank_fatura',
      competencia: '2026-01',
      dataInicial: null, dataFinal: null
    });
    expect(t).toBe('Nubank Fatura - Jan/2026');
  });

  test('sugerirTitulo: fallback para nome do arquivo', () => {
    const t = inferencia.sugerirTitulo({
      filename: 'minhas_compras_jan_2026.csv',
      parserId: 'generico_csv',
      competencia: null
    });
    expect(t).toMatch(/2026/);
  });

  test('inferirCompetencia escolhe mês com mais transações', () => {
    const t1 = inferencia.inferirCompetencia([
      { data: new Date('2026-01-10') },
      { data: new Date('2026-02-05') },
      { data: new Date('2026-02-20') }
    ]);
    expect(t1).toBe('2026-02');
  });

  test('formatarCompetenciaPT formata', () => {
    expect(inferencia.formatarCompetenciaPT('2026-01')).toBe('Jan/2026');
    expect(inferencia.formatarCompetenciaPT('2026-12')).toBe('Dez/2026');
    expect(inferencia.formatarCompetenciaPT(null)).toBeNull();
  });

  test('extrairDatasDoNome reconhece YYYY-MM, MM_YYYY, YYYYMM, meses em PT', () => {
    expect(inferencia.extrairDatasDoNome('extrato_2026-03.csv')).toEqual([{ ano: 2026, mes: 3, dia: 1 }]);
    expect(inferencia.extrairDatasDoNome('vendas_03_2026.csv')).toEqual([{ ano: 2026, mes: 3, dia: 1 }]);
    expect(inferencia.extrairDatasDoNome('x_202603_y.csv')).toEqual([{ ano: 2026, mes: 3, dia: 1 }]);
    expect(inferencia.extrairDatasDoNome('janeiro_2026.csv')).toEqual([{ ano: 2026, mes: 1, dia: 1 }]);
  });
});
