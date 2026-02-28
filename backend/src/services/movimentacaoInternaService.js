// src/services/movimentacaoInternaService.js
const Transferencia = require('../models/transferencia');

/**
 * Padrões configuráveis para detecção de movimentação interna.
 * Comparação case-insensitive contra o campo MEMO do OFX.
 */
const PADROES_MOVIMENTACAO_INTERNA = [
  'Caixinha',
  'Resgate',
  'Aporte',
  'Transferência para conta'
];

/**
 * Verifica se o MEMO indica movimentação interna.
 * @param {string} memo - Conteúdo do campo MEMO do OFX
 * @returns {boolean}
 */
function detectarMovimentacaoInterna(memo) {
  if (!memo || typeof memo !== 'string') return false;
  const memoLower = memo.trim().toLowerCase();
  return PADROES_MOVIMENTACAO_INTERNA.some(
    (padrao) => memoLower.includes(padrao.toLowerCase())
  );
}

/**
 * Busca Transferências pendentes que possam corresponder a uma TransacaoOFX.
 * Nunca vincula automaticamente — retorna apenas sugestões.
 * @param {string} subcontaId - ID da subconta
 * @param {number} valor - Valor da transação (sempre positivo)
 * @param {Date} data - Data da transação
 * @param {Object} opts - { toleranciaValor: number, toleranciaDias: number }
 * @returns {Promise<Array>} Lista de Transferências sugeridas
 */
async function sugerirTransferencias(subcontaId, valor, data, opts = {}) {
  const toleranciaValor = opts.toleranciaValor != null ? opts.toleranciaValor : 0.01;
  const toleranciaDias = opts.toleranciaDias != null ? opts.toleranciaDias : 3;

  const dataObj = new Date(data);
  const startDate = new Date(dataObj);
  startDate.setDate(startDate.getDate() - toleranciaDias);
  const endDate = new Date(dataObj);
  endDate.setDate(endDate.getDate() + toleranciaDias);

  const transferencias = await Transferencia.find({
    $or: [
      { subcontaOrigem: subcontaId },
      { subcontaDestino: subcontaId }
    ],
    status: 'pendente',
    valor: { $gte: valor - toleranciaValor, $lte: valor + toleranciaValor },
    data: { $gte: startDate, $lte: endDate }
  })
    .populate('subcontaOrigem subcontaDestino', 'nome instituicao')
    .lean();

  return transferencias;
}

module.exports = {
  PADROES_MOVIMENTACAO_INTERNA,
  detectarMovimentacaoInterna,
  sugerirTransferencias
};
