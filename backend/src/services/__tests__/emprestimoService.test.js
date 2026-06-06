/**
 * Testes do emprestimoService - validação de regras de negócio e recálculo de status.
 */
const mongoose = require('mongoose');

// Mocks dos models e do util de quitação
const mockEmprestimoFindOne = jest.fn();
const mockEmprestimoFindOneAndUpdate = jest.fn();
const mockTransacaoAggregate = jest.fn();
const mockTransacaoFind = jest.fn();
const mockRecalcularJurosAuto = jest.fn();
const mockCalcularTotalJuros = jest.fn();

jest.mock('../../models/emprestimo', () => {
  const actual = jest.requireActual('../../models/emprestimo');
  const Mock = jest.fn();
  Mock.findOne = (...args) => mockEmprestimoFindOne(...args);
  Mock.findOneAndUpdate = (...args) => mockEmprestimoFindOneAndUpdate(...args);
  return {
    ...actual,
    findOne: (...args) => mockEmprestimoFindOne(...args),
    findOneAndUpdate: (...args) => mockEmprestimoFindOneAndUpdate(...args)
  };
});

jest.mock('../../models/transacao', () => {
  const Mock = jest.fn();
  Mock.aggregate = (...args) => mockTransacaoAggregate(...args);
  Mock.find = (...args) => {
    const query = mockTransacaoFind(...args);
    if (query && typeof query.lean === 'function') return query;
    return {
      sort: () => ({
        lean: () => Promise.resolve([])
      }),
      lean: () => Promise.resolve([])
    };
  };
  return Mock;
});

jest.mock('../../utils/emprestimoAjuste', () => ({
  ajustarRecebiveisDeEmprestimo: jest.fn()
}));

jest.mock('../../utils/emprestimoQuitacao', () => ({
  recalcularJurosAuto: (...args) => mockRecalcularJurosAuto(...args)
}));

// Importação DEPOIS dos mocks
const {
  validarDadosEmprestimo,
  recalcularStatus,
  CAMPOS_EDITAVEIS,
  STATUS_EMPRESTIMO,
  TIPOS_RETORNO,
  DIRECOES
} = require('../emprestimoService');

const USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const EMP_ID = new mongoose.Types.ObjectId();

function makeEmprestimo(overrides = {}) {
  return {
    _id: EMP_ID,
    usuario: new mongoose.Types.ObjectId(USER_ID),
    status: 'ativo',
    valorEsperadoRetorno: 800,
    pessoaNomeSnapshot: 'Estrela',
    save: jest.fn().mockResolvedValue(true),
    ...overrides
  };
}

describe('emprestimoService.validarDadosEmprestimo', () => {
  const dadosValidos = {
    pessoaId: 'pessoa-123',
    valorEsperadoRetorno: 1000,
    tipoRetorno: 'valor_fixo',
    prazoFinal: '2026-12-31'
  };

  test('aceita dados completos válidos', () => {
    expect(validarDadosEmprestimo(dadosValidos)).toEqual([]);
  });

  test('rejeita sem pessoaId', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, pessoaId: undefined });
    expect(erros).toContain('pessoaId é obrigatório.');
  });

  test('rejeita sem valorEsperadoRetorno', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, valorEsperadoRetorno: null });
    expect(erros).toContain('valorEsperadoRetorno é obrigatório.');
  });

  test('rejeita valorEsperadoRetorno negativo', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, valorEsperadoRetorno: -10 });
    expect(erros).toContain('valorEsperadoRetorno não pode ser negativo.');
  });

  test('rejeita tipoRetorno inválido', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, tipoRetorno: 'banana' });
    expect(erros.some((e) => e.includes('tipoRetorno inválido'))).toBe(true);
  });

  test('rejeita taxaJurosPercentual > 1000', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, taxaJurosPercentual: 1500 });
    expect(erros).toContain('taxaJurosPercentual fora do intervalo (0-1000).');
  });

  test('rejeita taxaJurosPercentual negativa', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, taxaJurosPercentual: -1 });
    expect(erros).toContain('taxaJurosPercentual fora do intervalo (0-1000).');
  });

  test('rejeita valorJurosFixo negativo', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, valorJurosFixo: -5 });
    expect(erros).toContain('valorJurosFixo não pode ser negativo.');
  });

  test('rejeita sem prazoFinal', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, prazoFinal: '' });
    expect(erros).toContain('prazoFinal é obrigatório.');
  });

  test('rejeita direcao inválida', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, direcao: 'roubado' });
    expect(erros.some((e) => e.includes('direcao inválida'))).toBe(true);
  });

  test('em modo parcial: aceita update apenas de observacao', () => {
    expect(validarDadosEmprestimo({ observacao: 'nova obs' }, { parcial: true })).toEqual([]);
  });

  test('em modo parcial: ainda valida campo presente mesmo com mudança parcial', () => {
    const erros = validarDadosEmprestimo(
      { valorEsperadoRetorno: -50 },
      { parcial: true }
    );
    expect(erros).toContain('valorEsperadoRetorno não pode ser negativo.');
  });

  test('em modo parcial: não exige pessoaId ausente', () => {
    const dadosSemPessoa = {
      valorEsperadoRetorno: 500,
      tipoRetorno: 'valor_fixo',
      prazoFinal: '2026-06-30'
    };
    expect(validarDadosEmprestimo(dadosSemPessoa, { parcial: true })).toEqual([]);
  });
});

describe('emprestimoService - constantes exportadas', () => {
  test('CAMPOS_EDITAVEIS não inclui pessoaId nem direcao', () => {
    expect(CAMPOS_EDITAVEIS).not.toContain('pessoaId');
    expect(CAMPOS_EDITAVEIS).not.toContain('direcao');
  });

  test('STATUS_EMPRESTIMO contém ativo, quitado, cancelado', () => {
    expect(STATUS_EMPRESTIMO).toEqual(expect.arrayContaining(['ativo', 'quitado', 'cancelado']));
  });

  test('TIPOS_RETORNO contém valor_fixo, juros_percentual, juros_fixo, sem_juros', () => {
    expect(TIPOS_RETORNO).toEqual(
      expect.arrayContaining(['valor_fixo', 'juros_percentual', 'juros_fixo', 'sem_juros'])
    );
  });

  test('DIRECOES contém concedido e recebido', () => {
    expect(DIRECOES).toEqual(expect.arrayContaining(['concedido', 'recebido']));
  });
});

describe('emprestimoService.recalcularStatus - regressões do refactor', () => {
  beforeEach(() => {
    mockEmprestimoFindOne.mockReset();
    mockEmprestimoFindOneAndUpdate.mockReset();
    mockTransacaoAggregate.mockReset();
    mockTransacaoFind.mockReset();
    mockRecalcularJurosAuto.mockReset();
  });

  test('cenário Estrela (bug original): desembolso tardio — recálculo atualiza tx de juros auto', async () => {
    // Setup: empréstimo já quitado, mas o desembolso foi vinculado DEPOIS da quitação.
    // Antes do refactor: a tx de juros auto permanecia com valor errado (800).
    // Depois do refactor: deve ser ATUALIZADA para 200.
    const emp = makeEmprestimo({ status: 'quitado', dataQuitacao: new Date() });

    // calcularTotais: desembolso 600 (tardio), recebimento 800
    mockEmprestimoFindOne.mockResolvedValue(emp);
    mockTransacaoAggregate
      .mockResolvedValueOnce([{ _id: 'gasto', total: 600 }, { _id: 'recebivel', total: 800 }])
      .mockResolvedValueOnce([{ _id: 'gasto', total: 600 }, { _id: 'recebivel', total: 800 }]);
    mockRecalcularJurosAuto.mockResolvedValue({ acao: 'atualizada', transacao: { _id: 'tx', valor: 200 } });

    const resultado = await recalcularStatus(String(EMP_ID), USER_ID);

    expect(mockRecalcularJurosAuto).toHaveBeenCalledTimes(1);
    expect(mockRecalcularJurosAuto).toHaveBeenCalledWith(
      expect.objectContaining({ _id: emp._id }),
      expect.any(Number)
    );
    expect(resultado).toBeDefined();
  });

  test('reverter quitação: status=quitado + totalReceived < valorEsperado → reverte para ativo', async () => {
    const emp = makeEmprestimo({ status: 'quitado', dataQuitacao: new Date() });
    const empRevertido = { ...emp, status: 'ativo', dataQuitacao: null };

    mockEmprestimoFindOne.mockResolvedValue(emp);
    // totalReceived baixo após estorno de recebimento
    mockTransacaoAggregate
      .mockResolvedValueOnce([{ _id: 'gasto', total: 600 }, { _id: 'recebivel', total: 200 }])
      .mockResolvedValueOnce([{ _id: 'gasto', total: 600 }, { _id: 'recebivel', total: 200 }]);
    mockEmprestimoFindOneAndUpdate.mockResolvedValue(empRevertido);
    mockRecalcularJurosAuto.mockResolvedValue({ acao: 'deletada', transacao: null });

    await recalcularStatus(String(EMP_ID), USER_ID);

    expect(mockEmprestimoFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: String(EMP_ID), usuario: expect.anything(), status: 'quitado' },
      { $set: { status: 'ativo', dataQuitacao: null } },
      { new: true }
    );
    expect(mockRecalcularJurosAuto).toHaveBeenCalledTimes(1);
  });

  test('quitação normal: status=ativo + totalReceived >= valorEsperado → quita e cria tx de juros', async () => {
    const emp = makeEmprestimo({ status: 'ativo' });
    const empQuitado = { ...emp, status: 'quitado', dataQuitacao: new Date() };

    mockEmprestimoFindOne.mockResolvedValue(emp);
    mockTransacaoAggregate
      .mockResolvedValueOnce([{ _id: 'gasto', total: 600 }, { _id: 'recebivel', total: 800 }])
      .mockResolvedValueOnce([{ _id: 'gasto', total: 600 }, { _id: 'recebivel', total: 800 }]);
    mockEmprestimoFindOneAndUpdate.mockResolvedValue(empQuitado);
    mockRecalcularJurosAuto.mockResolvedValue({ acao: 'criada', transacao: { _id: 'tx', valor: 200 } });

    await recalcularStatus(String(EMP_ID), USER_ID);

    expect(mockEmprestimoFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: String(EMP_ID), usuario: expect.anything(), status: 'ativo' },
      { $set: { status: 'quitado', dataQuitacao: expect.any(Date) } },
      { new: true }
    );
    expect(mockRecalcularJurosAuto).toHaveBeenCalledTimes(1);
  });

  test('idempotente: status=ativo + totalReceived < valorEsperado → no-op', async () => {
    const emp = makeEmprestimo({ status: 'ativo' });

    mockEmprestimoFindOne.mockResolvedValue(emp);
    mockTransacaoAggregate
      .mockResolvedValueOnce([{ _id: 'gasto', total: 600 }, { _id: 'recebivel', total: 200 }])
      .mockResolvedValueOnce([{ _id: 'gasto', total: 600 }, { _id: 'recebivel', total: 200 }]);

    await recalcularStatus(String(EMP_ID), USER_ID);

    expect(mockEmprestimoFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mockRecalcularJurosAuto).not.toHaveBeenCalled();
  });

  test('cancelado: no-op completo', async () => {
    const emp = makeEmprestimo({ status: 'cancelado' });
    mockEmprestimoFindOne.mockResolvedValue(emp);

    const resultado = await recalcularStatus(String(EMP_ID), USER_ID);

    expect(resultado).toBe(emp);
    expect(mockTransacaoAggregate).not.toHaveBeenCalled();
    expect(mockRecalcularJurosAuto).not.toHaveBeenCalled();
  });

  test('não encontrado: retorna null', async () => {
    mockEmprestimoFindOne.mockResolvedValue(null);

    const resultado = await recalcularStatus(String(EMP_ID), USER_ID);

    expect(resultado).toBeNull();
  });

  test('log warning quando quitação ocorre com desembolso zero', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const emp = makeEmprestimo({ status: 'ativo' });
    const empQuitado = { ...emp, status: 'quitado' };

    mockEmprestimoFindOne.mockResolvedValue(emp);
    // desembolso zero, mas recebimento 800 (atinge valor esperado 800)
    mockTransacaoAggregate
      .mockResolvedValueOnce([{ _id: 'recebivel', total: 800 }])
      .mockResolvedValueOnce([{ _id: 'recebivel', total: 800 }]);
    mockEmprestimoFindOneAndUpdate.mockResolvedValue(empQuitado);
    mockRecalcularJurosAuto.mockResolvedValue({ acao: 'criada', transacao: {} });

    await recalcularStatus(String(EMP_ID), USER_ID);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('ATENÇÃO')
    );
    expect(consoleSpy.mock.calls[0][0]).toContain('desembolso zero');

    consoleSpy.mockRestore();
  });
});
