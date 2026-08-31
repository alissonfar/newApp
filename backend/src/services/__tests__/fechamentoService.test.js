/**
 * Testes do fechamentoService - regras de negócio isoladas (sem tela).
 */
const mongoose = require('mongoose');

const mockFechamentoInstanciaFindOne = jest.fn();

jest.mock('../../models/fechamentoInstancia', () => {
  const Mock = jest.fn();
  Mock.findOne = (...args) => mockFechamentoInstanciaFindOne(...args);
  return Mock;
});

jest.mock('../../models/fechamentoCadastro', () => jest.fn());
jest.mock('../../models/pessoa', () => jest.fn());
jest.mock('../../models/modeloRelatorio', () => jest.fn());
jest.mock('../../models/tag', () => jest.fn());
jest.mock('../../models/transacao', () => jest.fn());
jest.mock('../../models/settlement', () => jest.fn());
jest.mock('../../utils/transacaoContabilizavel', () => ({
  addContabilizavelCondition: jest.fn()
}));
jest.mock('../../reportEngine/ruleEngine', () => ({
  processWithRules: jest.fn()
}));
jest.mock('../../reportEngine/aggregator', () => ({
  aggregate: jest.fn()
}));

const FechamentoInstancia = require('../../models/fechamentoInstancia');
const {
  STATUS_MANUAL,
  modelRulesToEngineRules,
  periodoOverlapMatch,
  atualizarStatus,
  duplicarInstancia
} = require('../fechamentoService');

describe('fechamentoService.periodoOverlapMatch', () => {
  test('sem filtro (undefined, undefined) retorna {}', () => {
    expect(periodoOverlapMatch(undefined, undefined)).toEqual({});
  });

  test('com dataInicio e dataFim retorna $and de 2 condições', () => {
    const resultado = periodoOverlapMatch('2026-08-01', '2026-08-31');
    expect(resultado.$and).toHaveLength(2);

    const [condDataFimFiltro, condDataInicioFiltro] = resultado.$and;
    expect(condDataFimFiltro.dataInicio.$lte).toEqual(new Date('2026-08-31T23:59:59.999Z'));
    expect(condDataInicioFiltro.dataFim.$gte).toEqual(new Date('2026-08-01T00:00:00.000Z'));
  });
});

describe('fechamentoService.modelRulesToEngineRules', () => {
  test('converte regra com tag ObjectId populada', () => {
    const tagId = new mongoose.Types.ObjectId();
    const regras = [{ tag: { _id: tagId }, effect: 'subtract' }];
    expect(modelRulesToEngineRules(regras)).toEqual([
      { tagId: tagId.toString(), effect: 'subtract' }
    ]);
  });

  test('ignora regra sem campo tag', () => {
    const regras = [{ effect: 'add' }];
    expect(modelRulesToEngineRules(regras)).toEqual([]);
  });

  test('retorna [] para null/undefined', () => {
    expect(modelRulesToEngineRules(null)).toEqual([]);
    expect(modelRulesToEngineRules(undefined)).toEqual([]);
  });
});

describe('fechamentoService.atualizarStatus', () => {
  beforeEach(() => {
    mockFechamentoInstanciaFindOne.mockReset();
  });

  test('rejeita status fora de STATUS_MANUAL (ex: recebido)', async () => {
    await expect(atualizarStatus('id-qualquer', 'recebido', 'user-1')).rejects.toThrow();
    expect(mockFechamentoInstanciaFindOne).not.toHaveBeenCalled();
  });

  test('STATUS_MANUAL é exatamente [aberto, enviado, aguardando_recebimento]', () => {
    expect(STATUS_MANUAL).toEqual(['aberto', 'enviado', 'aguardando_recebimento']);
  });
});

describe('fechamentoService.duplicarInstancia', () => {
  beforeEach(() => {
    mockFechamentoInstanciaFindOne.mockReset();
    FechamentoInstancia.mockReset();
  });

  test('lança erro quando FechamentoInstancia.findOne resolve null', async () => {
    mockFechamentoInstanciaFindOne.mockResolvedValueOnce(null);

    await expect(duplicarInstancia('id-inexistente', 'user-1')).rejects.toThrow(
      'Instância não encontrada.'
    );
  });

  test('normaliza dataInicio (início do dia UTC) e dataFim (fim do dia UTC) do mês seguinte', async () => {
    const original = {
      _id: 'orig-id',
      cadastro: 'cadastro-id',
      dataFim: new Date('2026-08-31T23:59:59.999Z')
    };

    let construidoCom = null;
    const saveMock = jest.fn().mockResolvedValue(true);
    FechamentoInstancia.mockImplementation((data) => {
      construidoCom = data;
      return { ...data, _id: 'nova-id', save: saveMock };
    });

    const populatedResult = { _id: 'nova-id', populado: true };
    const populateMock = jest.fn().mockResolvedValue(populatedResult);

    mockFechamentoInstanciaFindOne
      .mockResolvedValueOnce(original) // busca a instância original
      .mockReturnValueOnce({ populate: populateMock }); // obterInstanciaPopulada no final

    const resultado = await duplicarInstancia('orig-id', 'user-1');

    expect(saveMock).toHaveBeenCalled();
    expect(construidoCom.status).toBe('aberto');
    expect(construidoCom.dataInicio.toISOString()).toMatch(/^2026-09-01T00:00:00\.000Z/);
    expect(construidoCom.dataFim.toISOString()).toMatch(/^2026-09-30T23:59:59\.999Z/);
    expect(resultado).toBe(populatedResult);
  });
});
