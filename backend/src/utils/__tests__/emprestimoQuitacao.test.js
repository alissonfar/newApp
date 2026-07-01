/**
 * Testes do utilitário de quitação de empréstimos (emprestimoQuitacao).
 * Modelo simplificado (FASE 4 do design doc):
 *   - Parâmetro agora é `lucro` (= soma_recebíveis - soma_gastos), não `totalJuros` do FIFO.
 *   - Observação: "Lucro realizado do empréstimo para {pessoa}. ..." (sem "principal devolvido")
 *   - Descrição da TX auto: "Lucro - {pessoa}" (não mais "Juros - {pessoa}")
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
  test('formata observação com Lucro (sem "principal devolvido")', () => {
    const obs = montarObservacao({
      pessoaNome: 'Estrela',
      desembolso: 640,
      totalReceb: 850,
      lucro: 210
    });
    expect(obs).toContain('Lucro realizado do empréstimo para Estrela');
    expect(obs).toContain('Desembolsos: R$ 640.00');
    expect(obs).toContain('Recebimentos: R$ 850.00');
    expect(obs).toContain('Lucro: R$ 210.00');
    expect(obs).not.toContain('Principal devolvido');
    expect(obs).not.toContain('Juros do empréstimo');
  });

  test('formata lucro zero (prejuízo zero, não contar principal)', () => {
    const obs = montarObservacao({
      pessoaNome: 'X',
      desembolso: 100,
      totalReceb: 100,
      lucro: 0
    });
    expect(obs).toContain('Lucro: R$ 0.00');
  });
});

describe('emprestimoQuitacao - recalcularJurosAuto (parâmetro = lucro)', () => {
  test('criada: lucro > 0 e sem tx existente', async () => {
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
    let savedInstance = null;
    mockSaveInstance.mockImplementation(function () {
      savedInstance = this;
      return Promise.resolve({ _id: 'novoId' });
    });

    const resultado = await recalcularJurosAuto(emprestimo, 210);

    expect(resultado.acao).toBe('criada');
    expect(resultado.transacao).toBeDefined();
    expect(mockSaveInstance).toHaveBeenCalledTimes(1);
    // descrição usa "Lucro - " não "Juros - "
    expect(savedInstance && savedInstance.descricao).toBe('Lucro - Estrela');
    expect(savedInstance && savedInstance.valor).toBe(210);
    expect(savedInstance && savedInstance.emprestimoEhJurosAuto).toBe(true);
  });

  test('nenhuma: lucro <= 0 e sem tx existente (prejuízo não cria tx)', async () => {
    const emprestimo = makeEmprestimo();
    mockTransacaoFindOne.mockReturnValue({ session: () => Promise.resolve(null) });

    const resultadoLucroZero = await recalcularJurosAuto(emprestimo, 0);
    expect(resultadoLucroZero.acao).toBe('nenhuma');
    expect(resultadoLucroZero.transacao).toBeNull();

    const resultadoLucroNegativo = await recalcularJurosAuto(emprestimo, -50);
    expect(resultadoLucroNegativo.acao).toBe('nenhuma');
    expect(mockSaveInstance).not.toHaveBeenCalled();
  });

  test('deletada: lucro <= 0 e tx existente (prejuízo remove tx auto)', async () => {
    const emprestimo = makeEmprestimo();
    const txExistente = { _id: 'txExistente', valor: 800, observacao: 'old' };
    mockTransacaoFindOne.mockReturnValue({ session: () => Promise.resolve(txExistente) });
    mockTransacaoDeleteOne.mockReturnValue({ session: () => Promise.resolve({ deletedCount: 1 }) });

    const resultado = await recalcularJurosAuto(emprestimo, 0);

    expect(resultado.acao).toBe('deletada');
    expect(resultado.transacao).toBeNull();
    expect(mockTransacaoDeleteOne).toHaveBeenCalledWith({ _id: 'txExistente' });
  });

  test('atualizada: lucro mudou e tx existente tem valor diferente', async () => {
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

  test('mantida: lucro igual ao valor atual e observação igual', async () => {
    const emprestimo = makeEmprestimo();
    // observa a observação gerada por montarObservacao
    const obsEsperada = montarObservacao({
      pessoaNome: 'Estrela',
      desembolso: 640,
      totalReceb: 850,
      lucro: 210
    });
    const txExistente = {
      _id: 'txExistente',
      valor: 210,
      observacao: obsEsperada,
      pagamentos: [{ pessoa: 'P', valor: 210 }]
    };
    mockTransacaoFindOne.mockReturnValue({ session: () => Promise.resolve(txExistente) });
    // _agregarTotaisEmprestimo consome 3 aggregates: caminho 1, caminho 2, esperado pagamento.
    mockTransacaoAggregate
      .mockResolvedValueOnce([   // caminho 1
        { _id: 'gasto', total: 640 },
        { _id: 'recebivel', total: 850 }
      ])
      .mockResolvedValueOnce([])  // caminho 2 vazio
      .mockResolvedValueOnce([]); // esperado pagamento vazio

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

  test('lança erro se emprestimo inválido', async () => {
    await expect(recalcularJurosAuto(null, 100)).rejects.toThrow();
    await expect(recalcularJurosAuto({}, 100)).rejects.toThrow();
  });

  test('criada: lucro correto em cenário caminho 2 (pagamento-level) — bug fix 2026-06-30', async () => {
    const emprestimo = makeEmprestimo();

    // 1ª chamada: Transacao.findOne (procura TX juros auto existente) → null
    // 2ª chamada: Transacao.find (buscar último recebimento pra snapshot) → 1 doc
    // 3ª chamada: Transacao.aggregate (dentro de calcularTotaisRecebEDisbursed
    //             → _agregarTotaisEmprestimo, 3 chamadas empilhadas)
    mockTransacaoFindOne.mockReturnValueOnce({
      session: () => Promise.resolve(null)
    });
    mockTransacaoFind.mockReturnValueOnce({
      sort: () => ({
        lean: () => Promise.resolve([{
          _id: 'rec1',
          data: new Date('2026-06-30'),
          categoria: 'cat1',
          categoriaNome: 'Cat',
          pagamentos: [{ pessoa: 'Estrela', valor: 2127.50, tags: {} }]
        }])
      })
    });
    // 3 aggregates empilhados de _agregarTotaisEmprestimo:
    mockTransacaoAggregate
      .mockResolvedValueOnce([   // caminho 1: 1 gasto + 1 recebimento
        { _id: 'gasto', total: 600, totalEsperado: 800 },
        { _id: 'recebivel', total: 2127.50 }
      ])
      .mockResolvedValueOnce([   // caminho 2: 1.327,50
        { _id: 'gasto', total: 1327.50 }
      ])
      .mockResolvedValueOnce([]);  // esperado pagamento: 0

    let savedInstance = null;
    mockSaveInstance.mockImplementation(function () {
      savedInstance = this;
      return Promise.resolve({ _id: 'novoId' });
    });

    const lucro = 200; // 2.127,50 - 1.927,50
    const resultado = await recalcularJurosAuto(emprestimo, lucro);

    expect(resultado.acao).toBe('criada');
    expect(savedInstance).toBeTruthy();
    expect(savedInstance.valor).toBe(200);  // <-- O FIX: antes gravava 1.527,50
    expect(savedInstance.emprestimoEhJurosAuto).toBe(true);
    expect(savedInstance.observacao).toContain('Desembolsos: R$ 1927.50');
    expect(savedInstance.observacao).toContain('Recebimentos: R$ 2127.50');
    expect(savedInstance.observacao).toContain('Lucro: R$ 200.00');
  });
});

describe('emprestimoQuitacao - calcularTotaisRecebEDisbursed (com caminho 2)', () => {
  test('retorna desembolso + recebimento considerando caminho 1 E caminho 2', async () => {
    const empId = new mongoose.Types.ObjectId();
    const userId = USER_ID;

    // _agregarTotaisEmprestimo é lazy-required e mockado indiretamente
    // via mockTransacaoAggregate. Como o mock é global, podemos simular
    // os 3 retornos que _agregarTotaisEmprestimo espera.
    mockTransacaoAggregate
      .mockResolvedValueOnce([   // caminho 1: 1 gasto + 1 recebimento
        { _id: 'gasto', total: 600, totalEsperado: 800 },
        { _id: 'recebivel', total: 2127.50 }
      ])
      .mockResolvedValueOnce([   // caminho 2: 1 pagamento gasto de 1.327,50
        { _id: 'gasto', total: 1327.50 }
      ])
      .mockResolvedValueOnce([]);  // esperado pagamento: 0

    const totais = await calcularTotaisRecebEDisbursed(empId, userId);
    expect(totais.desembolso).toBe(1927.50);  // 600 + 1.327,50
    expect(totais.recebimento).toBe(2127.50);
  });

  test('retorna zeros quando aggregate vazio', async () => {
    const empId = new mongoose.Types.ObjectId();
    mockTransacaoAggregate.mockResolvedValue([]);
    const totais = await calcularTotaisRecebEDisbursed(empId, USER_ID);
    expect(totais.desembolso).toBe(0);
    expect(totais.recebimento).toBe(0);
  });
});
