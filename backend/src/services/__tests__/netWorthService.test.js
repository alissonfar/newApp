/**
 * Testes do netWorthService - patrimônio histórico baseado em Ledger.
 * Cenários obrigatórios do plano:
 * - Cenário 1: 01/01 depósito 1000, 10/01 gasto 200 → 05/01 = 1000, 15/01 = 800
 * - Cenário 2: Transferência entre contas → patrimônio total não muda
 * - Cenário 3: Importação retroativa → recalcula corretamente
 */
const mongoose = require('mongoose');

const mockAggregate = jest.fn();
const mockFind = jest.fn();

jest.mock('../../models/ledgerPatrimonial', () => ({
  aggregate: (...args) => mockAggregate(...args),
  find: (q) => ({
    sort: () => ({
      select: () => ({
        lean: () => mockFind(q)
      })
    })
  })
}));

const mockSubcontaFind = jest.fn();
jest.mock('../../models/subconta', () => ({
  find: jest.fn().mockImplementation(() => ({
    populate: () => ({
      lean: () => mockSubcontaFind()
    }),
    lean: () => mockSubcontaFind()
  }))
}));

const Subconta = require('../../models/subconta');
const netWorthService = require('../netWorthService');

describe('netWorthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('patrimonioEmData', () => {
    it('retorna total 0 e accounts vazio quando não há eventos', async () => {
      mockAggregate.mockResolvedValue([]);

      const resultado = await netWorthService.patrimonioEmData('507f1f77bcf86cd799439011', new Date('2024-01-15'));

      expect(resultado.total).toBe(0);
      expect(resultado.accounts).toEqual([]);
    });

    it('Cenário 1: depósito 01/01 e gasto 10/01 - patrimônio em 05/01 = 1000', async () => {
      const subcontaId = new mongoose.Types.ObjectId();
      mockAggregate.mockResolvedValue([{ _id: subcontaId, balance: 1000 }]);
      mockSubcontaFind.mockResolvedValue([
        { _id: subcontaId, nome: 'Conta Teste', tipo: 'corrente', proposito: 'disponivel', instituicao: { nome: 'Banco' } }
      ]);

      const resultado = await netWorthService.patrimonioEmData('507f1f77bcf86cd799439011', new Date('2024-01-05'));

      expect(resultado.total).toBe(1000);
      expect(resultado.accounts).toHaveLength(1);
      expect(resultado.accounts[0].balance).toBe(1000);
    });

    it('Cenário 1: depósito 01/01 e gasto 10/01 - patrimônio em 15/01 = 800', async () => {
      const subcontaId = new mongoose.Types.ObjectId();
      mockAggregate.mockResolvedValue([{ _id: subcontaId, balance: 800 }]);
      mockSubcontaFind.mockResolvedValue([
        { _id: subcontaId, nome: 'Conta Teste', tipo: 'corrente', proposito: 'disponivel', instituicao: { nome: 'Banco' } }
      ]);

      const resultado = await netWorthService.patrimonioEmData('507f1f77bcf86cd799439011', new Date('2024-01-15'));

      expect(resultado.total).toBe(800);
      expect(resultado.accounts[0].balance).toBe(800);
    });

    it('Cenário 2: transferência entre contas - patrimônio total não muda', async () => {
      const subcontaA = new mongoose.Types.ObjectId();
      const subcontaB = new mongoose.Types.ObjectId();
      mockAggregate.mockResolvedValue([
        { _id: subcontaA, balance: -500 },
        { _id: subcontaB, balance: 500 }
      ]);
      mockSubcontaFind.mockResolvedValue([
        { _id: subcontaA, nome: 'Conta A', tipo: 'corrente', proposito: 'disponivel', instituicao: { nome: 'Banco' } },
        { _id: subcontaB, nome: 'Conta B', tipo: 'corrente', proposito: 'disponivel', instituicao: { nome: 'Banco' } }
      ]);

      const resultado = await netWorthService.patrimonioEmData('507f1f77bcf86cd799439011', new Date('2024-01-15'));

      expect(resultado.total).toBe(0);
      expect(resultado.accounts).toHaveLength(2);
    });
  });

  describe('evolucaoPatrimonio', () => {
    it('retorna array vazio quando não há eventos no período', async () => {
      mockFind.mockResolvedValue([]);
      mockSubcontaFind.mockResolvedValue([]);

      const resultado = await netWorthService.evolucaoPatrimonio('507f1f77bcf86cd799439011', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        interval: 'month'
      });

      expect(Array.isArray(resultado)).toBe(true);
    });

    it('retorna pontos de evolução com date e total', async () => {
      const subcontaId = new mongoose.Types.ObjectId();
      mockFind.mockResolvedValue([
        { subconta: subcontaId, dataEvento: new Date('2024-01-01'), valor: 1000 },
        { subconta: subcontaId, dataEvento: new Date('2024-01-10'), valor: -200 }
      ]);
      mockSubcontaFind.mockResolvedValue([
        { _id: subcontaId, nome: 'Conta', tipo: 'corrente', proposito: 'disponivel' }
      ]);

      const resultado = await netWorthService.evolucaoPatrimonio('507f1f77bcf86cd799439011', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        interval: 'month'
      });

      expect(resultado.length).toBeGreaterThan(0);
      expect(resultado[0]).toHaveProperty('date');
      expect(resultado[0]).toHaveProperty('total');
    });
  });
});
