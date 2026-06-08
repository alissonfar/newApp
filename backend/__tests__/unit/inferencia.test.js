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
    expect(t).toMatch(/Fatura Nubank/);
    expect(t).toMatch(/Jan\/2026/);
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

  // ============ Fatura de Cartão de Crédito ============

  describe('Fatura de Cartão de Crédito', () => {
    test('extrairVencimentoDoNome: Nubank_2026-06-08.csv → 2026-06-08', () => {
      expect(inferencia.extrairVencimentoDoNome('Nubank_2026-06-08.csv'))
        .toEqual({ ano: 2026, mes: 6, dia: 8 });
    });

    test('extrairVencimentoDoNome: nubank_2025_12_25.csv → 2025-12-25', () => {
      expect(inferencia.extrairVencimentoDoNome('nubank_2025_12_25.csv'))
        .toEqual({ ano: 2025, mes: 12, dia: 25 });
    });

    test('extrairVencimentoDoNome: sem data → null', () => {
      expect(inferencia.extrairVencimentoDoNome('fatura.csv')).toBeNull();
      expect(inferencia.extrairVencimentoDoNome('fatura_maio.csv')).toBeNull();
    });

    test('extrairMetadados para nubank_fatura: preenche isFaturaCartao, vencimento, mesVencimento', () => {
      const transacoes = [
        { data: new Date('2026-05-01T12:00:00Z'), tipo: 'gasto', valor: 100 },
        { data: new Date('2026-05-15T12:00:00Z'), tipo: 'gasto', valor: 50 },
        { data: new Date('2026-05-31T12:00:00Z'), tipo: 'gasto', valor: 200 }
      ];
      const meta = inferencia.extrairMetadados({
        transacoes,
        filename: 'Nubank_2026-06-08.csv',
        parserId: 'nubank_fatura'
      });
      expect(meta.isFaturaCartao).toBe(true);
      expect(meta.sugerirComplementarAutomaticamente).toBe(true);
      expect(meta.mesVencimento).toBe('2026-06');
      expect(meta.vencimento).toBeTruthy();
      expect(meta.vencimento.toISOString().startsWith('2026-06-08')).toBe(true);
      expect(meta.periodoCompetencia).toBe('2026-05');
    });

    test('extrairMetadados para nubank_extrato: NÃO é fatura de cartão', () => {
      const meta = inferencia.extrairMetadados({
        transacoes: [{ data: new Date('2026-03-15T12:00:00Z'), tipo: 'gasto', valor: 100 }],
        filename: 'extrato_2026-03.csv',
        parserId: 'nubank_extrato'
      });
      expect(meta.isFaturaCartao).toBe(false);
      expect(meta.sugerirComplementarAutomaticamente).toBe(false);
      expect(meta.mesVencimento).toBeNull();
    });

    test('sugerirTitulo para nubank_fatura: "Fatura Nubank - Mai/2026 (vence 08/06) - 5\u00ba Complemento"', () => {
      const t = inferencia.sugerirTitulo({
        filename: 'Nubank_2026-06-08.csv',
        parserId: 'nubank_fatura',
        competencia: '2026-05',
        dataInicial: new Date('2026-05-01'),
        dataFinal: new Date('2026-05-31'),
        vencimento: new Date('2026-06-08T12:00:00Z'),
        numeroComplemento: 5
      });
      expect(t).toBe('Fatura Nubank - Mai/2026 (vence 08/06) - 5\u00ba Complemento');
    });

    test('sugerirTitulo para nubank_fatura sem complemento: sem label', () => {
      const t = inferencia.sugerirTitulo({
        filename: 'Nubank_2026-06-08.csv',
        parserId: 'nubank_fatura',
        competencia: '2026-05',
        dataInicial: null, dataFinal: null,
        vencimento: new Date('2026-06-08T12:00:00Z')
      });
      expect(t).toBe('Fatura Nubank - Mai/2026 (vence 08/06)');
    });

    test('nomeTagMes gera nome canônico', () => {
      expect(inferencia.nomeTagMes('2026-06')).toBe('Junho 2026');
      expect(inferencia.nomeTagMes('2025-01')).toBe('Janeiro 2025');
      expect(inferencia.nomeTagMes(null)).toBeNull();
      expect(inferencia.nomeTagMes('invalido')).toBeNull();
    });

    test('tagCorrespondeMes aceita vários formatos de nome de tag', () => {
      const tagCompleta = { nome: 'Junho 2026' };
      const tagBarra = { nome: 'Junho/2026' };
      const tagAbrev = { nome: 'Jun 2026' };
      const tagMMAAAA = { nome: '06/2026' };
      const tagAAAAMM = { nome: '2026-06' };
      const tagInvalida = { nome: 'Maio 2026' };
      expect(inferencia.tagCorrespondeMes(tagCompleta, '2026-06')).toBe(true);
      expect(inferencia.tagCorrespondeMes(tagBarra, '2026-06')).toBe(true);
      expect(inferencia.tagCorrespondeMes(tagAbrev, '2026-06')).toBe(true);
      expect(inferencia.tagCorrespondeMes(tagMMAAAA, '2026-06')).toBe(true);
      expect(inferencia.tagCorrespondeMes(tagAAAAMM, '2026-06')).toBe(true);
      expect(inferencia.tagCorrespondeMes(tagInvalida, '2026-06')).toBe(false);
    });

    test('inferirTagPorMes: categoriaCartaoId null → motivo categoria_nao_configurada', async () => {
      const result = await inferencia.inferirTagPorMes({
        categoriaCartaoId: null,
        tags: [],
        parserId: 'nubank_fatura',
        mesVencimento: '2026-06',
        Categoria: { findOne: () => ({ lean: async () => null }) },
        Tag: { findOne: () => ({ lean: async () => null }) },
        usuarioId: 'u1'
      });
      expect(result.tagSugerida).toBeNull();
      expect(result.motivo).toBe('categoria_nao_configurada');
    });

    test('inferirTagPorMes: categoria configurada mas deletada → motivo categoria_deletada', async () => {
      const result = await inferencia.inferirTagPorMes({
        categoriaCartaoId: 'cat-1',
        tags: [],
        parserId: 'nubank_fatura',
        mesVencimento: '2026-06',
        Categoria: { findOne: () => ({ lean: async () => null }) },
        Tag: { findOne: () => ({ lean: async () => null }) },
        usuarioId: 'u1'
      });
      expect(result.tagSugerida).toBeNull();
      expect(result.motivo).toBe('categoria_deletada');
    });

    test('inferirTagPorMes: categoria existe + tag existe → retorna tag', async () => {
      const tags = [{
        _id: 'tag-1',
        nome: 'Junho 2026',
        cor: '#aabbcc',
        icone: 'tag-icon',
        categoria: 'cat-1'
      }];
      const result = await inferencia.inferirTagPorMes({
        categoriaCartaoId: 'cat-1',
        tags,
        parserId: 'nubank_fatura',
        mesVencimento: '2026-06',
        Categoria: { findOne: () => ({ lean: async () => ({ _id: 'cat-1', nome: 'Faturas Cartão Crédito' }) }) },
        Tag: { findOne: () => ({ lean: async () => null }) },
        usuarioId: 'u1'
      });
      expect(result.tagId).toBe('tag-1');
      expect(result.tagNome).toBe('Junho 2026');
      expect(result.categoriaNome).toBe('Faturas Cartão Crédito');
      expect(result.autoCriada).toBe(false);
    });

    test('inferirTagPorMes: tag não existe → auto-cria', async () => {
      function FakeTag() {
        this._id = 'tag-nova';
        this.nome = 'Junho 2026';
        this.cor = '#3b82f6';
        this.icone = 'tag';
      }
      FakeTag.prototype.save = async function () { return this; };
      const result = await inferencia.inferirTagPorMes({
        categoriaCartaoId: 'cat-1',
        tags: [],
        parserId: 'nubank_fatura',
        mesVencimento: '2026-06',
        Categoria: { findOne: () => ({ lean: async () => ({ _id: 'cat-1', nome: 'Faturas Cartão Crédito' }) }) },
        Tag: FakeTag,
        usuarioId: 'u1'
      });
      expect(result.tagId).toBe('tag-nova');
      expect(result.tagNome).toBe('Junho 2026');
      expect(result.autoCriada).toBe(true);
    });

    test('contarComplementosAnteriores: 4 docs = 4', async () => {
      const FakeImportacao = { countDocuments: async () => 4 };
      const n = await inferencia.contarComplementosAnteriores(FakeImportacao, {
        usuarioId: 'u1', parserId: 'nubank_fatura', mesVencimento: '2026-06'
      });
      expect(n).toBe(4);
    });

    test('contarComplementosAnteriores: 0 docs = 0 (sem complemento)', async () => {
      const FakeImportacao = { countDocuments: async () => 0 };
      const n = await inferencia.contarComplementosAnteriores(FakeImportacao, {
        usuarioId: 'u1', parserId: 'nubank_fatura', mesVencimento: '2026-06'
      });
      expect(n).toBe(0);
    });
  });
});
