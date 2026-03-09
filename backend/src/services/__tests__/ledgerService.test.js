/**
 * Testes do ledgerService - validação de consistência.
 * Requer MongoDB (pode usar in-memory ou test DB).
 */
const ledgerService = require('../ledgerService');

describe('ledgerService', () => {
  describe('calcularSaldoPorLedger', () => {
    it('retorna 0 quando subcontaId não existe ou não tem eventos', async () => {
      const saldo = await ledgerService.calcularSaldoPorLedger('000000000000000000000000', '000000000000000000000001');
      expect(saldo).toBe(0);
    });
  });

  describe('registrarEvento', () => {
    it('lança erro quando parâmetros obrigatórios faltam', async () => {
      await expect(
        ledgerService.registrarEvento({
          usuarioId: '123',
          subcontaId: '456'
          // falta valor, tipoEvento, origemSistema
        })
      ).rejects.toThrow();
    });

    it('lança erro quando valor não é número', async () => {
      await expect(
        ledgerService.registrarEvento({
          usuarioId: '123',
          subcontaId: '456',
          valor: 'abc',
          tipoEvento: 'ajuste_manual',
          origemSistema: 'confirmacao_manual'
        })
      ).rejects.toThrow();
    });
  });
});
