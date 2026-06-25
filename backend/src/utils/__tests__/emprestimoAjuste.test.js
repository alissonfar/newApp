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
    // valorEsperadoRetorno removido do Empréstimo no design 2026-06-24.
    // O valor esperado vive agora em Transacao.valorEsperadoRetorno.
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

/**
 * Cria pagamento com `emprestimoId` opcional (caminho novo).
 */
function makePagamento({ pessoa, valor, emprestimoId }) {
  const pag = { pessoa, valor };
  if (emprestimoId) pag.emprestimoId = new mongoose.Types.ObjectId(emprestimoId);
  return pag;
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

  // ========================================================================
  // Caminho B — Pagamento-level (design 2026-06-24)
  // ========================================================================

  test('Cenário Estrela: TX 895 (Alisson 447,50 + Estrela 447,50, só Estrela emprestado) → TX.valor = 447,50 e TX continua visível', async () => {
    const emp = makeEmprestimo({ pessoaNomeSnapshot: 'Estrela' });
    mockEmprestimoFind.mockReturnValue({ lean: () => Promise.resolve([emp]) });

    const tx = makeTransacao({
      tipo: 'gasto',
      valor: 895,
      data: '2026-06-16',
      emprestimoId: null, // caminho novo: TX-level é null
      pagamentos: [
        makePagamento({ pessoa: 'Alisson', valor: 447.50 }),                        // não é empréstimo
        makePagamento({ pessoa: 'Estrela', valor: 447.50, emprestimoId: emp._id }) // é empréstimo
      ]
    });

    await ajustarRecebiveisDeEmprestimo([tx], USER_ID);

    // TX: t.valor desconta apenas o pagamento emprestado
    expect(tx.valor).toBeCloseTo(447.50, 2);
    // TX: continua visível (NÃO seta _emprestimoEsconderNaLista)
    expect(tx._emprestimoEsconderNaLista).toBeUndefined();
    // TX: marca flag parcial
    expect(tx._emprestimoParcial).toBe(true);
    // Pagamento Estrela: zerado e marcado
    expect(tx.pagamentos[1].valor).toBe(0);
    expect(tx.pagamentos[1]._emprestimoEsconder).toBe(true);
    expect(tx.pagamentos[1]._emprestimoInfo).toEqual({
      tipo: 'desembolso',
      pessoaNome: 'Estrela',
      valor: 447.50
    });
    // Pagamento Alisson: permanece normal (conta como gasto do usuário)
    expect(tx.pagamentos[0].valor).toBe(447.50);
    expect(tx.pagamentos[0]._emprestimoEsconder).toBeUndefined();
  });

  test('Caminho novo: pagamentos emprestados de 2 empréstimos diferentes na mesma TX', async () => {
    // Edge case: TX com 3 pagamentos, 2 emprestados (cada um para um Empréstimo diferente).
    // Verifica que todos os empréstimos são carregados e o valor é descontado corretamente.
    const emp1 = makeEmprestimo({ pessoaNomeSnapshot: 'Estrela' });
    const emp2 = makeEmprestimo({ pessoaNomeSnapshot: 'Guilherme' });
    mockEmprestimoFind.mockReturnValue({ lean: () => Promise.resolve([emp1, emp2]) });

    const tx = makeTransacao({
      tipo: 'gasto',
      valor: 900,
      data: '2026-07-01',
      pagamentos: [
        makePagamento({ pessoa: 'Alisson', valor: 300 }),                        // não é
        makePagamento({ pessoa: 'Estrela', valor: 300, emprestimoId: emp1._id }),  // sim
        makePagamento({ pessoa: 'Guilherme', valor: 300, emprestimoId: emp2._id }) // sim
      ]
    });

    await ajustarRecebiveisDeEmprestimo([tx], USER_ID);

    expect(tx.valor).toBe(300); // 900 - 600 (soma dos emprestados)
    expect(tx._emprestimoParcial).toBe(true);
    expect(tx._emprestimoEsconderNaLista).toBeUndefined();
    expect(tx.pagamentos[0].valor).toBe(300); // Alisson: intacto
    expect(tx.pagamentos[1].valor).toBe(0);   // Estrela: zerado
    expect(tx.pagamentos[2].valor).toBe(0);   // Guilherme: zerado
    expect(tx.pagamentos[1]._emprestimoInfo.pessoaNome).toBe('Estrela');
    expect(tx.pagamentos[2]._emprestimoInfo.pessoaNome).toBe('Guilherme');
  });

  test('Caminho novo: recebível parcial (apenas 1 dos 2 pagamentos é empréstimo)', async () => {
    // Verifica simetria: o mesmo comportamento vale para recebíveis.
    const emp = makeEmprestimo();
    mockEmprestimoFind.mockReturnValue({ lean: () => Promise.resolve([emp]) });

    const tx = makeTransacao({
      tipo: 'recebivel',
      valor: 600,
      data: '2026-08-01',
      pagamentos: [
        makePagamento({ pessoa: 'A', valor: 300 }), // não é empréstimo (receita do usuário)
        makePagamento({ pessoa: 'B', valor: 300, emprestimoId: emp._id }) // é
      ]
    });

    await ajustarRecebiveisDeEmprestimo([tx], USER_ID);

    expect(tx.valor).toBe(300);
    expect(tx._emprestimoParcial).toBe(true);
    expect(tx.pagamentos[0].valor).toBe(300); // A: intacto
    expect(tx.pagamentos[1].valor).toBe(0);   // B: zerado
    expect(tx.pagamentos[1]._emprestimoInfo.tipo).toBe('recebimento');
  });

  test('Caminho novo: NÃO seta _emprestimoEsconderNaLista (TX continua visível na lista)', async () => {
    const emp = makeEmprestimo();
    mockEmprestimoFind.mockReturnValue({ lean: () => Promise.resolve([emp]) });

    const tx = makeTransacao({
      tipo: 'gasto',
      valor: 500,
      data: '2026-09-01',
      pagamentos: [
        makePagamento({ pessoa: 'A', valor: 250 }),
        makePagamento({ pessoa: 'B', valor: 250, emprestimoId: emp._id })
      ]
    });

    await ajustarRecebiveisDeEmprestimo([tx], USER_ID);

    // Garantia explícita do critério: o flag de "esconder TX inteira" NÃO é setado
    // no caminho novo (somente no legado).
    expect(tx._emprestimoEsconderNaLista).toBeUndefined();
  });
});
