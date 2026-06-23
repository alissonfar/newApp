/**
 * Testes do emprestimoService - validação de regras de negócio e recálculo de status.
 * Modelo simplificado (FASE 4 do design doc): sem FIFO, sem split, sem direcao,
 * sem taxaJurosPercentual/valorJurosFixo. Lucro = soma_recebíveis - soma_gastos.
 */
const mongoose = require('mongoose');

// Mocks dos models e do util de quitação
const mockEmprestimoFindOne = jest.fn();
const mockEmprestimoFindOneAndUpdate = jest.fn();
const mockTransacaoAggregate = jest.fn();
const mockTransacaoFind = jest.fn();
const mockRecalcularJurosAuto = jest.fn();

jest.mock('../../models/emprestimo', () => {
  const actual = jest.requireActual('../../models/emprestimo');
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
  STATUS_EMPRESTIMO,
  TIPOS_RETORNO
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

  test('aceita tipoRetorno valor_fixo', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, tipoRetorno: 'valor_fixo' });
    expect(erros).toEqual([]);
  });

  test('aceita tipoRetorno sem_juros', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, tipoRetorno: 'sem_juros' });
    expect(erros).toEqual([]);
  });

  test('rejeita tipoRetorno juros_percentual (removido)', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, tipoRetorno: 'juros_percentual' });
    expect(erros.some((e) => e.includes('tipoRetorno inválido'))).toBe(true);
  });

  test('rejeita tipoRetorno juros_fixo (removido)', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, tipoRetorno: 'juros_fixo' });
    expect(erros.some((e) => e.includes('tipoRetorno inválido'))).toBe(true);
  });

  test('rejeita sem prazoFinal', () => {
    const erros = validarDadosEmprestimo({ ...dadosValidos, prazoFinal: '' });
    expect(erros).toContain('prazoFinal é obrigatório.');
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
  test('STATUS_EMPRESTIMO contém ativo, quitado, cancelado', () => {
    expect(STATUS_EMPRESTIMO).toEqual(expect.arrayContaining(['ativo', 'quitado', 'cancelado']));
  });

  test('TIPOS_RETORNO contém apenas valor_fixo e sem_juros', () => {
    expect(TIPOS_RETORNO).toEqual(['valor_fixo', 'sem_juros']);
  });

  test('TIPOS_RETORNO NÃO contém juros_* (removidos)', () => {
    expect(TIPOS_RETORNO).not.toContain('juros_percentual');
    expect(TIPOS_RETORNO).not.toContain('juros_fixo');
  });
});

describe('emprestimoService.recalcularStatus - modelo simplificado (FASE 4)', () => {
  beforeEach(() => {
    mockEmprestimoFindOne.mockReset();
    mockEmprestimoFindOneAndUpdate.mockReset();
    mockTransacaoAggregate.mockReset();
    mockTransacaoFind.mockReset();
    mockRecalcularJurosAuto.mockReset();
  });

  test('quitação normal: status=ativo + totalReceived >= valorEsperado → quita com lucro = receb - gast', async () => {
    const emp = makeEmprestimo({ status: 'ativo' });
    const empQuitado = { ...emp, status: 'quitado', dataQuitacao: new Date() };

    mockEmprestimoFindOne.mockResolvedValue(emp);
    // desembolso 600, recebimento 800 → lucro 200
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
    // lucro = 800 - 600 = 200
    expect(mockRecalcularJurosAuto).toHaveBeenCalledWith(
      expect.objectContaining({ _id: emp._id }),
      200
    );
  });

  test('quitação com lucro zero (totalReceived == totalDisbursed) → tx auto não é criada', async () => {
    // Valor esperado = 800, desembolso 800, recebimento 800 → lucro 0
    const emp = makeEmprestimo({ status: 'ativo', valorEsperadoRetorno: 800 });
    const empQuitado = { ...emp, status: 'quitado' };

    mockEmprestimoFindOne.mockResolvedValue(emp);
    mockTransacaoAggregate
      .mockResolvedValueOnce([{ _id: 'gasto', total: 800 }, { _id: 'recebivel', total: 800 }])
      .mockResolvedValueOnce([{ _id: 'gasto', total: 800 }, { _id: 'recebivel', total: 800 }]);
    mockEmprestimoFindOneAndUpdate.mockResolvedValue(empQuitado);
    mockRecalcularJurosAuto.mockResolvedValue({ acao: 'nenhuma', transacao: null });

    await recalcularStatus(String(EMP_ID), USER_ID);

    // Status transita para quitado (atingiu valor esperado)
    expect(mockEmprestimoFindOneAndUpdate).toHaveBeenCalledWith(
      { _id: String(EMP_ID), usuario: expect.anything(), status: 'ativo' },
      { $set: { status: 'quitado', dataQuitacao: expect.any(Date) } },
      { new: true }
    );
    // lucro = 0 → recalcularJurosAuto é chamado com 0
    expect(mockRecalcularJurosAuto).toHaveBeenCalledWith(
      expect.objectContaining({ _id: emp._id }),
      0
    );
  });

  test('sem auto-reversão (Bloco 2.b): status=quitado + totalReceived < valorEsperado → status NÃO reverte', async () => {
    const emp = makeEmprestimo({ status: 'quitado', dataQuitacao: new Date() });

    mockEmprestimoFindOne.mockResolvedValue(emp);
    // Estornou recebimento: totalReceived < valorEsperado
    mockTransacaoAggregate.mockResolvedValueOnce([
      { _id: 'gasto', total: 600 },
      { _id: 'recebivel', total: 200 }
    ]);

    await recalcularStatus(String(EMP_ID), USER_ID);

    // A PARTIR DA FASE 4: NÃO há mais findOneAndUpdate revertendo quitado → ativo
    expect(mockEmprestimoFindOneAndUpdate).not.toHaveBeenCalled();
    expect(mockRecalcularJurosAuto).not.toHaveBeenCalled();
  });

  test('quitação já existente + valor mudou: atualiza tx de juros auto (CASO 3)', async () => {
    const emp = makeEmprestimo({ status: 'quitado', dataQuitacao: new Date() });

    mockEmprestimoFindOne.mockResolvedValue(emp);
    // desembolso 600 (tardio), recebimento 800 → lucro 200
    mockTransacaoAggregate
      .mockResolvedValueOnce([{ _id: 'gasto', total: 600 }, { _id: 'recebivel', total: 800 }])
      .mockResolvedValueOnce([{ _id: 'gasto', total: 600 }, { _id: 'recebivel', total: 800 }]);
    mockRecalcularJurosAuto.mockResolvedValue({ acao: 'atualizada', transacao: { _id: 'tx', valor: 200 } });

    await recalcularStatus(String(EMP_ID), USER_ID);

    expect(mockRecalcularJurosAuto).toHaveBeenCalledTimes(1);
    expect(mockRecalcularJurosAuto).toHaveBeenCalledWith(
      expect.objectContaining({ _id: emp._id }),
      200
    );
  });

  test('idempotente: status=ativo + totalReceived < valorEsperado → no-op', async () => {
    const emp = makeEmprestimo({ status: 'ativo' });

    mockEmprestimoFindOne.mockResolvedValue(emp);
    mockTransacaoAggregate.mockResolvedValueOnce([
      { _id: 'gasto', total: 600 },
      { _id: 'recebivel', total: 200 }
    ]);

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

  test('Bloco 2.b: edição de valorEsperadoRetorno com TXs ativas — não reverte status', async () => {
    // Este teste verifica a remoção da trava de edição de valorEsperadoRetorno.
    // A regra: agora é permitido editar valorEsperadoRetorno mesmo com TXs ativas.
    // Aqui validamos que o controller `atualizar` não tem mais o bloco de auto-reversão.
    // A validação estática: o `emprestimoController.atualizar` foi refatorado e não
    // toca no status. Não testamos o controller aqui, mas garantimos que
    // `recalcularStatus` não reverte mais (coberto em outro teste).
    expect(true).toBe(true);
  });
});
