/**
 * Testes de settlementService.pessoasDoSettlement - regra pura, sem tela.
 */
jest.mock('../../models/settlement', () => jest.fn());
jest.mock('../../models/transacao', () => jest.fn());
jest.mock('../../models/tag', () => jest.fn());
jest.mock('../../models/usuarios', () => jest.fn());

const { pessoasDoSettlement } = require('../settlementService');

describe('settlementService.pessoasDoSettlement', () => {
  test('usa pagamentoIndex quando presente, ignora outros pagadores da mesma transação', () => {
    const settlement = {
      appliedTransactions: [
        {
          pagamentoIndex: 2,
          transactionId: {
            pagamentos: [
              { pessoa: 'Alisson' },
              { pessoa: 'Milena' },
              { pessoa: 'Cleia' }
            ]
          }
        }
      ]
    };
    expect(pessoasDoSettlement(settlement)).toEqual(['Cleia']);
  });

  test('agrega pessoas de múltiplas appliedTransactions distintas (settlement misto)', () => {
    const settlement = {
      appliedTransactions: [
        { pagamentoIndex: 0, transactionId: { pagamentos: [{ pessoa: 'Cleia' }] } },
        {
          pagamentoIndex: 1,
          transactionId: { pagamentos: [{ pessoa: 'Alisson' }, { pessoa: 'Milena' }] }
        }
      ]
    };
    expect(pessoasDoSettlement(settlement)).toEqual(['Cleia', 'Milena']);
  });

  test('sem pagamentoIndex, usa fallback: todos os pagadores da transação', () => {
    const settlement = {
      appliedTransactions: [
        {
          pagamentoIndex: null,
          transactionId: { pagamentos: [{ pessoa: 'Cleia' }, { pessoa: 'Milena' }] }
        }
      ]
    };
    expect(pessoasDoSettlement(settlement)).toEqual(['Cleia', 'Milena']);
  });

  test('não duplica nomes repetidos entre appliedTransactions', () => {
    const settlement = {
      appliedTransactions: [
        { pagamentoIndex: 0, transactionId: { pagamentos: [{ pessoa: 'Cleia' }] } },
        { pagamentoIndex: 0, transactionId: { pagamentos: [{ pessoa: 'Cleia' }] } }
      ]
    };
    expect(pessoasDoSettlement(settlement)).toEqual(['Cleia']);
  });

  test('retorna [] quando appliedTransactions está vazio ou ausente', () => {
    expect(pessoasDoSettlement({ appliedTransactions: [] })).toEqual([]);
    expect(pessoasDoSettlement({})).toEqual([]);
  });

  test('ignora pagamento sem nome de pessoa', () => {
    const settlement = {
      appliedTransactions: [
        { pagamentoIndex: 0, transactionId: { pagamentos: [{ pessoa: '' }] } }
      ]
    };
    expect(pessoasDoSettlement(settlement)).toEqual([]);
  });
});
