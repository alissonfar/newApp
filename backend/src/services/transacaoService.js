// src/services/transacaoService.js
const TOLERANCIA = 0.01;

/**
 * Valida que a soma dos pagamentos é igual ao valor da transação.
 * @param {Object} transacao - { valor }
 * @param {Array} pagamentos - [{ valor }]
 * @throws {Error} Se a validação falhar
 */
function validarSomaPagamentos(transacao, pagamentos) {
  if (!pagamentos || !Array.isArray(pagamentos)) {
    throw new Error('Pagamentos inválidos');
  }
  const somaPagamentos = pagamentos.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
  const valorEsperado = parseFloat(transacao.valor) || 0;
  if (Math.abs(somaPagamentos - valorEsperado) > TOLERANCIA) {
    throw new Error('Soma dos pagamentos deve ser igual ao valor da transação');
  }
}

module.exports = {
  validarSomaPagamentos
};
