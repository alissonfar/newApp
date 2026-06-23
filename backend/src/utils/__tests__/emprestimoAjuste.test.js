/**
 * Testes do ajuste de Empréstimos (emprestimoAjuste).
 * Modelo simplificado (FASE 4 do design doc):
 *   - gastos: zerados, marcados com _emprestimoEsconderNaLista, _emprestimoInfo.tipo='desembolso'
 *   - recebíveis (não juros auto): zerados, marcados com _emprestimoEsconderNaLista,
 *     _emprestimoInfo.tipo='recebimento'
 *   - juros auto: NÃO modificados
 *   - sem split FIFO, sem principal/juros
 *
 * Cenário Guilherme (vale 1):
 *   15/03 gasto 600   (desembolso)
 *   22/03 gasto 40    (desembolso adicional)
 *   14/04 recebivel 850 (recebimento)
 */
const mongoose = require('mongoose');

const mockEmprestimoFind = jest.fn();

jest.mock('../../models/emprestimo', () => ({
  find: (...args) => mockEmprestimoFind(...args)
}));

const { ajustarRecebiveisDeEmprestimo } = require('../emprestimoAjuste');

const USER_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';

function makeEmprestimo(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    usuario: new mongoose.Types.ObjectId(USER_ID),
    pessoaNomeSnapshot: 'Guilherme',
    valorEsperadoRetorno: 850,
    ...overrides
  };
}

function makeTransacao({ tipo, valor, data, emprestimoId, pagamentos, emprestimoEhJurosAuto }) {
  return {
    _id: new mongoose.Types.ObjectId(),
    usuario: new mongoose.Types.ObjectId(USER_ID),
    tipo,
    valor,
    data: new Date(data),
    emprestimoId: emprestimoId ? new mongoose.Types.ObjectId(emprestimoId) : null,
    emprestimoEhJurosAuto: emprestimoEhJurosAuto === true,
    pagamentos: pagamentos || [{ pessoa: 'Teste', valor }]
  };
}

describe('emprestimoAjuste - ajustarRecebiveisDeEmprestimo (modelo simplificado)', () => {
  beforeEach(() => {
    mockEmprestimoFind.mockReset();
  });

  test('Cenário Guilherme: gastos zeram, recebível zera, todos com _emprestimoInfo', async () => {
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
    expect(transacoes[0]._emprestimoInfo).toEqual({
      tipo: 'desembolso',
      pessoaNome: 'Guilherme',
      valor: 600
    });

    expect(transacoes[1].valor).toBe(0);
    expect(transacoes[1]._emprestimoEsconderNaLista).toBe(true);
    expect(transacoes[1]._emprestimoInfo.tipo).toBe('desembolso');

    // Recebível NÃO-juros-auto: zerado, marcado, info
    expect(transacoes[2].valor).toBe(0);
    expect(transacoes[2]._emprestimoEsconderNaLista).toBe(true);
    expect(transacoes[2]._emprestimoInfo).toEqual({
      tipo: 'recebimento',
      pessoaNome: 'Guilherme',
      valor: 850
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

  test('Recebíveis com emprestimoEhJurosAuto=true: NÃO são modificados (são receita real)', async () => {
    const emp = makeEmprestimo();
    mockEmprestimoFind.mockReturnValue({ lean: () => Promise.resolve([emp]) });

    const txJuros = makeTransacao({
      tipo: 'recebivel',
      valor: 200,
      data: '2026-05-01',
      emprestimoId: emp._id,
      emprestimoEhJurosAuto: true,
      pagamentos: [{ pessoa: 'Guilherme', valor: 200 }]
    });

    const transacoes = [txJuros];

    await ajustarRecebiveisDeEmprestimo(transacoes, USER_ID);

    // Permanece inalterada (entra no summary como receita)
    expect(transacoes[0].valor).toBe(200);
    expect(transacoes[0]._emprestimoEsconderNaLista).toBeUndefined();
    expect(transacoes[0].pagamentos[0].valor).toBe(200);
  });

  test('Transações sem emprestimoId: permanecem inalteradas', async () => {
    const emp = makeEmprestimo();
    mockEmprestimoFind.mockReturnValue({ lean: () => Promise.resolve([emp]) });

    const transacoes = [
      makeTransacao({ tipo: 'gasto', valor: 100, data: '2026-01-01' }), // sem emprestimoId
      makeTransacao({ tipo: 'recebivel', valor: 50, data: '2026-01-02' }) // sem emprestimoId
    ];

    await ajustarRecebiveisDeEmprestimo(transacoes, USER_ID);

    expect(transacoes[0].valor).toBe(100);
    expect(transacoes[0]._emprestimoEsconderNaLista).toBeUndefined();
    expect(transacoes[1].valor).toBe(50);
  });

  test('Empréstimo não encontrado: TXs com emprestimoId ficam inalteradas', async () => {
    mockEmprestimoFind.mockReturnValue({ lean: () => Promise.resolve([]) });

    const transacoes = [
      makeTransacao({ tipo: 'gasto', valor: 500, data: '2026-01-01', emprestimoId: new mongoose.Types.ObjectId() })
    ];

    await ajustarRecebiveisDeEmprestimo(transacoes, USER_ID);

    // Sem Empréstimo correspondente, a TX não é tocada
    expect(transacoes[0].valor).toBe(500);
  });

  test('Array vazio: não chama o banco', async () => {
    await ajustarRecebiveisDeEmprestimo([], USER_ID);
    expect(mockEmprestimoFind).not.toHaveBeenCalled();
  });

  test('Sem nenhum emprestimoId nas TXs: short-circuit, não chama o banco', async () => {
    const transacoes = [
      makeTransacao({ tipo: 'gasto', valor: 100, data: '2026-01-01' }),
      makeTransacao({ tipo: 'recebivel', valor: 50, data: '2026-01-02' })
    ];
    await ajustarRecebiveisDeEmprestimo(transacoes, USER_ID);
    expect(mockEmprestimoFind).not.toHaveBeenCalled();
  });

  test('_emprestimoInfo: não tem mais principal/juros (modelo simplificado)', async () => {
    const emp = makeEmprestimo();
    mockEmprestimoFind.mockReturnValue({ lean: () => Promise.resolve([emp]) });

    const transacoes = [
      makeTransacao({ tipo: 'recebivel', valor: 1000, data: '2026-04-14', emprestimoId: emp._id })
    ];

    await ajustarRecebiveisDeEmprestimo(transacoes, USER_ID);

    expect(transacoes[0]._emprestimoInfo).not.toHaveProperty('principal');
    expect(transacoes[0]._emprestimoInfo).not.toHaveProperty('juros');
    expect(transacoes[0]._emprestimoInfo).not.toHaveProperty('valorOriginal');
  });
});
