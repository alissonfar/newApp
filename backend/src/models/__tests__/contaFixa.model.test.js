const mongoose = require('mongoose');
const ContaFixa = require('../contaFixa');

describe('ContaFixa model — pagamentosTemplate em valor absoluto', () => {
  it('aceita pagamentosTemplate com pessoa/valor/tags (sem percentual)', () => {
    const contaFixa = new ContaFixa({
      usuario: new mongoose.Types.ObjectId(),
      nome: 'Aluguel',
      tipo: 'gasto',
      valorEsperado: 1000,
      diaLancamento: 1,
      diaVencimento: 5,
      modo: 'automatico',
      pagamentosTemplate: [
        { pessoa: 'Alisson', valor: 600, tags: { cat1: ['tagA'] } },
        { pessoa: 'Outra Pessoa', valor: 400, tags: {} }
      ]
    });

    const erro = contaFixa.validateSync();
    expect(erro).toBeUndefined();
    expect(contaFixa.pagamentosTemplate[0].valor).toBe(600);
    expect(contaFixa.pagamentosTemplate[0].tags).toEqual({ cat1: ['tagA'] });
  });

  it('rejeita pagamentosTemplate sem valor (campo obrigatório)', () => {
    const contaFixa = new ContaFixa({
      usuario: new mongoose.Types.ObjectId(),
      nome: 'Aluguel',
      tipo: 'gasto',
      valorEsperado: 1000,
      diaLancamento: 1,
      diaVencimento: 5,
      modo: 'automatico',
      pagamentosTemplate: [{ pessoa: 'Alisson' }]
    });

    const erro = contaFixa.validateSync();
    expect(erro).toBeDefined();
    expect(erro.errors['pagamentosTemplate.0.valor']).toBeDefined();
  });

  it('não tem mais o campo tagsPadrao no schema', () => {
    expect(ContaFixa.schema.path('tagsPadrao')).toBeUndefined();
  });
});
