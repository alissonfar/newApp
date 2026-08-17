const Transacao = require('../transacao');

describe('Transacao model exports', () => {
  it('exporta PagamentoSchema como propriedade estática do model', () => {
    expect(Transacao.PagamentoSchema).toBeDefined();
    expect(Transacao.PagamentoSchema.path('pessoa')).toBeDefined();
    expect(Transacao.PagamentoSchema.path('valor')).toBeDefined();
    expect(Transacao.PagamentoSchema.path('pessoa').isRequired).toBe(true);
    expect(Transacao.PagamentoSchema.path('valor').isRequired).toBe(true);
  });

  it('continua exportando o model Transacao normalmente (uso existente não quebra)', () => {
    expect(typeof Transacao).toBe('function');
    expect(Transacao.modelName).toBe('Transacao');
  });
});
