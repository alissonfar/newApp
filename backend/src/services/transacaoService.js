// src/services/transacaoService.js
const VinculoConjunto = require('../models/vinculoConjunto');

const TOLERANCIA = 0.01;

/**
 * Valida a soma dos pagamentos conforme regra condicional (Conta Conjunta).
 * - Se contaConjunta.ativo && pagoPor === 'outro': soma deve ser igual a parteUsuario
 * - Caso contrário: soma deve ser igual a transacao.valor
 * @param {Object} transacao - { valor, contaConjunta }
 * @param {Array} pagamentos - [{ valor }]
 * @throws {Error} Se a validação falhar
 */
function validarSomaPagamentos(transacao, pagamentos) {
  if (!pagamentos || !Array.isArray(pagamentos)) {
    throw new Error('Pagamentos inválidos');
  }
  const somaPagamentos = pagamentos.reduce((acc, p) => acc + (parseFloat(p.valor) || 0), 0);
  const contaConjunta = transacao.contaConjunta;

  if (contaConjunta?.ativo && contaConjunta?.pagoPor === 'outro') {
    const parteUsuario = parseFloat(contaConjunta.parteUsuario) || 0;
    if (Math.abs(somaPagamentos - parteUsuario) > TOLERANCIA) {
      throw new Error('Soma dos pagamentos deve ser igual à parte do usuário');
    }
  } else {
    const valorEsperado = parseFloat(transacao.valor) || 0;
    if (Math.abs(somaPagamentos - valorEsperado) > TOLERANCIA) {
      throw new Error('Soma dos pagamentos deve ser igual ao valor da transação');
    }
  }
}

/**
 * Valida os dados de contaConjunta quando ativo.
 * - parteUsuario + parteOutro = valorTotal
 * - vinculoId deve pertencer ao usuário
 * @param {Object} dados - { contaConjunta, usuarioId }
 * @throws {Error} Se a validação falhar
 */
async function validarContaConjunta(dados) {
  const cc = dados.contaConjunta;
  if (!cc || !cc.ativo) return;

  const valorTotal = parseFloat(cc.valorTotal) || 0;
  const parteUsuario = parseFloat(cc.parteUsuario) || 0;
  const parteOutro = parseFloat(cc.parteOutro) || 0;

  if (Math.abs(parteUsuario + parteOutro - valorTotal) > TOLERANCIA) {
    throw new Error('parteUsuario + parteOutro deve ser igual a valorTotal');
  }

  if (!cc.vinculoId || !dados.usuarioId) {
    throw new Error('Vínculo é obrigatório para conta conjunta');
  }

  const vinculo = await VinculoConjunto.findOne({
    _id: cc.vinculoId,
    usuario: dados.usuarioId,
    ativo: true
  });
  if (!vinculo) {
    throw new Error('Vínculo não encontrado ou inválido');
  }
}

/**
 * Prepara valor e contaConjunta para persistência conforme Fluxo A ou B.
 * Fluxo A (pagoPor: 'usuario'): valor = valorTotal
 * Fluxo B (pagoPor: 'outro'): valor = parteUsuario
 * @param {Object} body - dados do body
 * @returns {Object} { valor, contaConjunta }
 */
function prepararValorEContaConjunta(body) {
  const contaConjunta = body.contaConjunta;
  if (!contaConjunta || !contaConjunta.ativo) {
    return { valor: parseFloat(body.valor) || 0, contaConjunta: undefined };
  }

  const valorTotal = parseFloat(contaConjunta.valorTotal) || 0;
  const parteUsuario = parseFloat(contaConjunta.parteUsuario) || 0;
  const parteOutro = parseFloat(contaConjunta.parteOutro) || 0;

  let valor;
  if (contaConjunta.pagoPor === 'outro') {
    valor = parteUsuario;
  } else {
    valor = valorTotal;
  }

  const ccParaSalvar = {
    ativo: true,
    vinculoId: contaConjunta.vinculoId,
    pagoPor: contaConjunta.pagoPor,
    valorTotal,
    parteUsuario,
    parteOutro,
    acertadoEm: null
  };

  return { valor, contaConjunta: ccParaSalvar };
}

module.exports = {
  validarSomaPagamentos,
  validarContaConjunta,
  prepararValorEContaConjunta
};
