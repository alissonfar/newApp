const { validarSomaPagamentos } = require('../../services/transacaoService');

describe('contaFixaController — reuso de validarSomaPagamentos', () => {
  it('validarSomaPagamentos aceita soma exata dentro da tolerância', () => {
    expect(() => validarSomaPagamentos(
      { valor: 1000 },
      [{ valor: 600 }, { valor: 400 }]
    )).not.toThrow();
  });

  it('validarSomaPagamentos rejeita soma divergente do valorEsperado', () => {
    expect(() => validarSomaPagamentos(
      { valor: 1000 },
      [{ valor: 600 }, { valor: 300 }]
    )).toThrow('Soma dos pagamentos deve ser igual ao valor da transação');
  });
});
