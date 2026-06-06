/**
 * Testes do FIFO de empréstimos (emprestimoAjuste).
 * Cenário Guilherme:
 *   15/03 gasto 600   (desembolso)
 *   22/03 gasto 40    (desembolso adicional)
 *   14/04 recebivel 850 (recebimento)
 * Comportamento esperado (relatórios):
 *   - gastos: zerados, marcados com _emprestimoEsconderNaLista (lista os esconde)
 *   - recebível: valor cheio preservado para histórico, com _emprestimoInfo {principal, juros}
 *   - summary: subtrai valor INTEIRO dos recebíveis (compensado pela transação
 *     de juros auto-criada na quitação, que NÃO é subtraída)
 */
const mongoose = require('mongoose');

const mockEmprestimoFind = jest.fn();
const mockTransacaoFind = jest.fn();

jest.mock('../../models/emprestimo', () => ({
  find: (...args) => mockEmprestimoFind(...args)
}));

jest.mock('../../models/transacao', () => ({
  find: (...args) => mockTransacaoFind(...args)
}));

const { ajustarRecebiveisDeEmprestimo, calcularAjusteResumoPorEmprestimo } = require('../emprestimoAjuste');

const USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

function makeEmprestimo(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    usuario: new mongoose.Types.ObjectId(USER_ID),
    direcao: 'concedido',
    valorEsperadoRetorno: 850,
    ...overrides
  };
}

function makeTransacao({ tipo, valor, data, emprestimoId, pagamentos }) {
  return {
    _id: new mongoose.Types.ObjectId(),
    usuario: new mongoose.Types.ObjectId(USER_ID),
    tipo,
    valor,
    data: new Date(data),
    emprestimoId: emprestimoId ? new mongoose.Types.ObjectId(emprestimoId) : null,
    pagamentos: pagamentos || [{ pessoa: 'Teste', valor }]
  };
}

describe('emprestimoAjuste - ajustarRecebiveisDeEmprestimo', () => {
  beforeEach(() => {
    mockEmprestimoFind.mockReset();
    mockTransacaoFind.mockReset();
  });

  test('Cenário Guilherme: gastos zeram, recebível mantém valor cheio com info de juros', async () => {
    const emp = makeEmprestimo();
    mockEmprestimoFind.mockReturnValue({ lean: () => Promise.resolve([emp]) });

    const transacoes = [
      makeTransacao({ tipo: 'gasto', valor: 600, data: '2026-03-15', emprestimoId: emp._id }),
      makeTransacao({ tipo: 'gasto', valor: 40, data: '2026-03-22', emprestimoId: emp._id }),
      makeTransacao({ tipo: 'recebivel', valor: 850, data: '2026-04-14', emprestimoId: emp._id })
    ];

    await ajustarRecebiveisDeEmprestimo(transacoes, USER_ID);

    // Gastos zerados e marcados para esconder da lista geral
    expect(transacoes[0].valor).toBe(0);
    expect(transacoes[0]._emprestimoEsconderNaLista).toBe(true);
    expect(transacoes[1].valor).toBe(0);
    expect(transacoes[1]._emprestimoEsconderNaLista).toBe(true);

    // Recebível mantém valor cheio
    expect(transacoes[2].valor).toBe(850);
    expect(transacoes[2]._emprestimoEsconderNaLista).toBeUndefined();

    // Recebível tem info de juros
    expect(transacoes[2]._emprestimoInfo).toEqual({
      tipo: 'recebimento',
      valorOriginal: 850,
      principal: 640,
      juros: 210
    });
  });

  test('Gastos: pagamentos também são zerados', async () => {
    const emp = makeEmprestimo();
    mockEmprestimoFind.mockReturnValue({ lean: () => Promise.resolve([emp]) });

    const transacoes = [
      makeTransacao({
        tipo: 'gasto',
        valor: 1000,
        data: '2026-01-10',
        emprestimoId: emp._id,
        pagamentos: [{ pessoa: 'Eu', valor: 600 }, { pessoa: 'Conjuge', valor: 400 }]
      })
    ];

    await ajustarRecebiveisDeEmprestimo(transacoes, USER_ID);

    expect(transacoes[0].valor).toBe(0);
    expect(transacoes[0].pagamentos[0].valor).toBe(0);
    expect(transacoes[0].pagamentos[1].valor).toBe(0);
  });

  test('Recebível com multi-pagamento: valor permanece cheio em todos os pagamentos', async () => {
    const emp = makeEmprestimo({ valorEsperadoRetorno: 1000 });
    mockEmprestimoFind.mockReturnValue({ lean: () => Promise.resolve([emp]) });

    const transacoes = [
      makeTransacao({ tipo: 'gasto', valor: 1000, data: '2026-01-10', emprestimoId: emp._id }),
      makeTransacao({
        tipo: 'recebivel',
        valor: 1000,
        data: '2026-02-10',
        emprestimoId: emp._id,
        pagamentos: [{ pessoa: 'A', valor: 600 }, { pessoa: 'B', valor: 400 }]
      })
    ];

    await ajustarRecebiveisDeEmprestimo(transacoes, USER_ID);

    expect(transacoes[1].valor).toBe(1000);
    expect(transacoes[1].pagamentos[0].valor).toBe(600);
    expect(transacoes[1].pagamentos[1].valor).toBe(400);
    expect(transacoes[1]._emprestimoInfo.juros).toBe(0);
  });

  test('Cenário: recebimento parcial — 1000 emprestado, 400 recebido, principal=400 juros=0', async () => {
    const emp = makeEmprestimo({ valorEsperadoRetorno: 1000 });
    mockEmprestimoFind.mockReturnValue({ lean: () => Promise.resolve([emp]) });

    const transacoes = [
      makeTransacao({ tipo: 'gasto', valor: 1000, data: '2026-01-15', emprestimoId: emp._id }),
      makeTransacao({ tipo: 'recebivel', valor: 400, data: '2026-02-15', emprestimoId: emp._id })
    ];

    await ajustarRecebiveisDeEmprestimo(transacoes, USER_ID);

    expect(transacoes[0].valor).toBe(0);
    expect(transacoes[1].valor).toBe(400);
    expect(transacoes[1]._emprestimoInfo).toEqual({
      tipo: 'recebimento',
      valorOriginal: 400,
      principal: 400,
      juros: 0
    });
  });

  test('Cenário: recebimento maior que esperado — 600 emprestado, 900 recebido, juros=300', async () => {
    const emp = makeEmprestimo({ valorEsperadoRetorno: 900 });
    mockEmprestimoFind.mockReturnValue({ lean: () => Promise.resolve([emp]) });

    const transacoes = [
      makeTransacao({ tipo: 'gasto', valor: 600, data: '2026-01-10', emprestimoId: emp._id }),
      makeTransacao({ tipo: 'recebivel', valor: 900, data: '2026-02-10', emprestimoId: emp._id })
    ];

    await ajustarRecebiveisDeEmprestimo(transacoes, USER_ID);

    expect(transacoes[0].valor).toBe(0);
    expect(transacoes[1].valor).toBe(900);
    expect(transacoes[1]._emprestimoInfo.juros).toBe(300);
  });

  test('Cenário: sem empréstimo — transações inalteradas e sem flags', async () => {
    const transacoes = [
      makeTransacao({ tipo: 'gasto', valor: 100, data: '2026-01-01' }),
      makeTransacao({ tipo: 'recebivel', valor: 200, data: '2026-01-02' })
    ];

    await ajustarRecebiveisDeEmprestimo(transacoes, USER_ID);

    expect(transacoes[0].valor).toBe(100);
    expect(transacoes[1].valor).toBe(200);
    expect(transacoes[0]._emprestimoEsconderNaLista).toBeUndefined();
    expect(transacoes[1]._emprestimoInfo).toBeUndefined();
  });

  test('Cenário: empréstimo com direcao=recebido — não aplica ajuste', async () => {
    mockEmprestimoFind.mockReturnValue({ lean: () => Promise.resolve([]) });

    const transacoes = [
      makeTransacao({ tipo: 'recebivel', valor: 600, data: '2026-01-01', emprestimoId: '5fc9b7c0a1b2c3d4e5f6a7b8' }),
      makeTransacao({ tipo: 'gasto', valor: 850, data: '2026-02-01', emprestimoId: '5fc9b7c0a1b2c3d4e5f6a7b8' })
    ];

    await ajustarRecebiveisDeEmprestimo(transacoes, USER_ID);

    expect(transacoes[0].valor).toBe(600);
    expect(transacoes[1].valor).toBe(850);
    expect(transacoes[0]._emprestimoEsconderNaLista).toBeUndefined();
    expect(transacoes[0]._emprestimoInfo).toBeUndefined();
  });
});

describe('calcularAjusteResumoPorEmprestimo', () => {
  beforeEach(() => {
    mockTransacaoFind.mockReset();
  });

  test('Cenário Guilherme: subtrai valor INTEIRO dos recebíveis (compensado pela transação de juros auto)', async () => {
    const emp = makeEmprestimo();
    const transacoes = [
      { tipo: 'gasto', valor: 600, data: new Date('2026-03-15'), emprestimoId: emp._id, emprestimoEhJurosAuto: { $ne: true } },
      { tipo: 'gasto', valor: 40, data: new Date('2026-03-22'), emprestimoId: emp._id, emprestimoEhJurosAuto: { $ne: true } },
      { tipo: 'recebivel', valor: 850, data: new Date('2026-04-14'), emprestimoId: emp._id, emprestimoEhJurosAuto: { $ne: true } }
    ];
    mockTransacaoFind.mockReturnValue({ lean: () => Promise.resolve(transacoes) });

    const ajuste = await calcularAjusteResumoPorEmprestimo(
      [String(emp._id)],
      USER_ID,
      { 'pagamentos.pessoa': { $in: ['Guilherme'] } }
    );

    expect(ajuste.totalGastosSubtraido).toBe(640);
    expect(ajuste.totalRecebiveisSubtraido).toBe(850);
  });

  test('Sem transações — retorna zeros', async () => {
    const ajuste = await calcularAjusteResumoPorEmprestimo([], USER_ID, {});
    expect(ajuste.totalGastosSubtraido).toBe(0);
    expect(ajuste.totalRecebiveisSubtraido).toBe(0);
  });
});
