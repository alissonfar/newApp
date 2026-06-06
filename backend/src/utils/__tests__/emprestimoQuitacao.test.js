/**
 * Testes do utilitário de quitação de empréstimos (emprestimoQuitacao).
 * Cobre o comportamento de upsert/delete da transação de juros auto.
 */
const mongoose = require('mongoose');

const mockTransacaoFindOne = jest.fn();
const mockTransacaoFind = jest.fn();
const mockTransacaoDeleteOne = jest.fn();
const mockTransacaoAggregate = jest.fn();
const mockSaveInstance = jest.fn();

jest.mock('../../models/transacao', () => {
  function MockModel(doc) {
    const instance = { ...doc, save: mockSaveInstance };
    return instance;
  }
  MockModel.findOne = (...args) => mockTransacaoFindOne(...args);
  MockModel.find = (...args) => mockTransacaoFind(...args);
  MockModel.deleteOne = (...args) => mockTransacaoDeleteOne(...args);
  MockModel.aggregate = (...args) => mockTransacaoAggregate(...args);
  return MockModel;
});

const { recalcularJurosAuto, montarObservacao, calcularTotaisRecebEDisbursed } = require('../emprestimoQuitacao');

const USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

function makeEmprestimo(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    usuario: new mongoose.Types.ObjectId(USER_ID),
    pessoaNomeSnapshot: 'Estrela',
    direcao: 'concedido',
    ...overrides
  };
}

beforeEach(() => {
  mockTransacaoFindOne.mockReset();
  mockTransacaoFind.mockReset();
  mockTransacaoDeleteOne.mockReset();
  mockTransacaoAggregate.mockReset();
  mockSaveInstance.mockReset();
});

describe('emprestimoQuitacao - montarObservacao', () => {
  test('formata observação com valores formatados em BRL', () => {
    const obs = montarObservacao({
      pessoaNome: 'Estrela',
      desembolso: 640,
      totalReceb: 850,
      totalJuros: 210
    });
    expect(obs).toContain('Juros do empréstimo para Estrela');
    expect(obs).toContain('Desembolsos: R$ 640.00');
    expect(obs).toContain('Recebimentos: R$ 850.00');
    expect(obs).toContain('Principal devolvido: R$ 640.00');
    expect(obs).toContain('Juros: R$ 210.00');
  });

  test('protege principal devolvido negativo (clamp em zero)', () => {
    const obs = montarObservacao({
      pessoaNome: 'X',
      desembolso: 100,
      totalReceb: 50,
      totalJuros: 60
    });
    expect(obs).toContain('Principal devolvido: R$ 0.00');
  });
});

describe('emprestimoQuitacao - recalcularJurosAuto', () => {
  test('criada: totalJuros > 0 e sem tx existente', async () => {
    const emprestimo = makeEmprestimo();
    mockTransacaoFindOne.mockReturnValue({ session: () => Promise.resolve(null) });
    mockTransacaoFind.mockReturnValue({
      sort: () => ({
        lean: () => Promise.resolve([{
          _id: 'rec1',
          data: new Date('2026-04-14'),
          categoria: 'cat1',
          categoriaNome: 'Cat',
          pagamentos: [{ pessoa: 'Pessoa', valor: 850, tags: { a: 1 } }]
        }])
      })
    });
    mockTransacaoAggregate.mockResolvedValue([
      { _id: 'gasto', total: 600 },
      { _id: 'recebivel', total: 850 }
    ]);
    mockSaveInstance.mockResolvedValue({ _id: 'novoId' });

    const resultado = await recalcularJurosAuto(emprestimo, 210);

    expect(resultado.acao).toBe('criada');
    expect(resultado.transacao).toBeDefined();
    expect(mockSaveInstance).toHaveBeenCalledTimes(1);
  });

  test('nenhuma: totalJuros <= 0 e sem tx existente', async () => {
    const emprestimo = makeEmprestimo();
    mockTransacaoFindOne.mockReturnValue({ session: () => Promise.resolve(null) });

    const resultado = await recalcularJurosAuto(emprestimo, 0);

    expect(resultado.acao).toBe('nenhuma');
    expect(resultado.transacao).toBeNull();
    expect(mockSaveInstance).not.toHaveBeenCalled();
  });

  test('deletada: totalJuros <= 0 e tx existente', async () => {
    const emprestimo = makeEmprestimo();
    const txExistente = { _id: 'txExistente', valor: 800, observacao: 'old' };
    mockTransacaoFindOne.mockReturnValue({ session: () => Promise.resolve(txExistente) });
    mockTransacaoDeleteOne.mockReturnValue({ session: () => Promise.resolve({ deletedCount: 1 }) });

    const resultado = await recalcularJurosAuto(emprestimo, 0);

    expect(resultado.acao).toBe('deletada');
    expect(resultado.transacao).toBeNull();
    expect(mockTransacaoDeleteOne).toHaveBeenCalledWith({ _id: 'txExistente' });
  });

  test('atualizada: totalJuros mudou e tx existente tem valor diferente', async () => {
    const emprestimo = makeEmprestimo();
    const txExistente = {
      _id: 'txExistente',
      valor: 800,
      observacao: 'obs antiga',
      pagamentos: [{ pessoa: 'P', valor: 800 }]
    };
    txExistente.save = mockSaveInstance.mockResolvedValue(txExistente);
    mockTransacaoFindOne.mockReturnValue({ session: () => Promise.resolve(txExistente) });
    mockTransacaoAggregate.mockResolvedValue([
      { _id: 'gasto', total: 600 },
      { _id: 'recebivel', total: 850 }
    ]);

    const resultado = await recalcularJurosAuto(emprestimo, 210);

    expect(resultado.acao).toBe('atualizada');
    expect(txExistente.valor).toBe(210);
    expect(txExistente.pagamentos[0].valor).toBe(210);
    expect(mockSaveInstance).toHaveBeenCalledTimes(1);
  });

  test('mantida: totalJuros igual ao valor atual e observação igual', async () => {
    const emprestimo = makeEmprestimo();
    const txExistente = {
      _id: 'txExistente',
      valor: 210,
      observacao: 'Juros do empréstimo para Estrela. Desembolsos: R$ 640.00, Recebimentos: R$ 850.00, Principal devolvido: R$ 640.00, Juros: R$ 210.00.',
      pagamentos: [{ pessoa: 'P', valor: 210 }]
    };
    mockTransacaoFindOne.mockReturnValue({ session: () => Promise.resolve(txExistente) });
    mockTransacaoAggregate.mockResolvedValue([
      { _id: 'gasto', total: 640 },
      { _id: 'recebivel', total: 850 }
    ]);

    const resultado = await recalcularJurosAuto(emprestimo, 210);

    expect(resultado.acao).toBe('mantida');
    expect(mockSaveInstance).not.toHaveBeenCalled();
  });

  test('arredonda centavos para evitar mismatch de float', async () => {
    const emprestimo = makeEmprestimo();
    const txExistente = {
      _id: 'txExistente',
      valor: 200,
      observacao: 'obs',
      pagamentos: [{ pessoa: 'P', valor: 200 }]
    };
    txExistente.save = mockSaveInstance.mockResolvedValue(txExistente);
    mockTransacaoFindOne.mockReturnValue({ session: () => Promise.resolve(txExistente) });
    mockTransacaoAggregate.mockResolvedValue([
      { _id: 'gasto', total: 0 },
      { _id: 'recebivel', total: 200 }
    ]);

    const resultado = await recalcularJurosAuto(emprestimo, 200.0001);
    expect(['atualizada', 'mantida']).toContain(resultado.acao);
  });
});

describe('emprestimoQuitacao - calcularTotaisRecebEDisbursed', () => {
  test('soma gastos e recebíveis separadamente', async () => {
    const empId = new mongoose.Types.ObjectId();
    mockTransacaoAggregate.mockResolvedValue([
      { _id: 'gasto', total: 600 },
      { _id: 'recebivel', total: 850 }
    ]);
    const totais = await calcularTotaisRecebEDisbursed(empId);
    expect(totais.desembolso).toBe(600);
    expect(totais.recebimento).toBe(850);
  });

  test('retorna zeros quando aggregate vazio', async () => {
    const empId = new mongoose.Types.ObjectId();
    mockTransacaoAggregate.mockResolvedValue([]);
    const totais = await calcularTotaisRecebEDisbursed(empId);
    expect(totais.desembolso).toBe(0);
    expect(totais.recebimento).toBe(0);
  });
});
