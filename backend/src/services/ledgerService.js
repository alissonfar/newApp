// src/services/ledgerService.js
const LedgerPatrimonial = require('../models/ledgerPatrimonial');

/**
 * Registra um evento no ledger patrimonial.
 * Append-only: eventos não são editados ou removidos.
 *
 * @param {Object} params
 * @param {string} params.usuarioId - ID do usuário
 * @param {string} params.subcontaId - ID da subconta
 * @param {number} params.valor - Delta (+ crédito, - débito)
 * @param {string} params.tipoEvento - Tipo do evento (enum TIPOS_EVENTO)
 * @param {string} params.origemSistema - Origem auditável (enum ORIGENS_SISTEMA)
 * @param {string} [params.referenciaTipo] - Ex: 'transferencia', 'importacao_ofx'
 * @param {ObjectId} [params.referenciaId] - ID da entidade de origem
 * @param {string} [params.descricao] - Descrição legível
 * @param {Date} [params.dataEvento] - Data do evento (default: new Date())
 * @param {Object} [params.metadata] - Dados extras
 * @param {mongoose.ClientSession} [session] - Sessão MongoDB para transação
 * @returns {Promise<LedgerPatrimonial>}
 */
async function registrarEvento(
  {
    usuarioId,
    subcontaId,
    valor,
    tipoEvento,
    origemSistema,
    referenciaTipo,
    referenciaId,
    descricao,
    dataEvento,
    metadata
  },
  session = null
) {
  if (!usuarioId || !subcontaId || valor == null || !tipoEvento || !origemSistema) {
    throw new Error('ledgerService.registrarEvento: usuarioId, subcontaId, valor, tipoEvento e origemSistema são obrigatórios.');
  }

  const valorNum = parseFloat(valor);
  if (isNaN(valorNum)) {
    throw new Error('ledgerService.registrarEvento: valor deve ser um número.');
  }

  if (referenciaTipo && referenciaId) {
    const q = { referenciaTipo, referenciaId, usuario: usuarioId };
    if (referenciaTipo === 'transferencia') {
      q.subconta = subcontaId;
    }
    const existente = await LedgerPatrimonial.findOne(q).session(session || null).lean();
    if (existente) {
      return existente;
    }
  }

  const doc = new LedgerPatrimonial({
    usuario: usuarioId,
    subconta: subcontaId,
    dataEvento: dataEvento || new Date(),
    valor: valorNum,
    tipoEvento,
    origemSistema,
    referenciaTipo: referenciaTipo || null,
    referenciaId: referenciaId || null,
    descricao: descricao || '',
    metadata: metadata || {}
  });

  const opts = session ? { session } : {};
  await doc.save(opts);
  return doc;
}

/**
 * Calcula o saldo de uma subconta pela soma dos eventos do ledger.
 *
 * @param {string} subcontaId - ID da subconta
 * @param {string} usuarioId - ID do usuário (isolamento multi-tenant)
 * @param {Date} [ateData] - Opcional: calcular saldo até esta data (inclusive)
 * @returns {Promise<number>}
 */
async function calcularSaldoPorLedger(subcontaId, usuarioId, ateData = null) {
  const match = { subconta: subcontaId, usuario: usuarioId };
  if (ateData) {
    match.dataEvento = { $lte: new Date(ateData) };
  }

  const resultado = await LedgerPatrimonial.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$valor' } } }
  ]);

  return resultado.length > 0 ? resultado[0].total : 0;
}

/**
 * Verifica se já existe evento para a referência (evitar duplicação).
 *
 * @param {string} referenciaTipo
 * @param {ObjectId} referenciaId
 * @param {mongoose.ClientSession} [session]
 * @returns {Promise<boolean>}
 */
async function existeEventoParaReferencia(referenciaTipo, referenciaId, session = null) {
  if (!referenciaTipo || !referenciaId) return false;
  const q = LedgerPatrimonial.findOne({ referenciaTipo, referenciaId });
  if (session) q.session(session);
  const doc = await q.lean();
  return !!doc;
}

module.exports = {
  registrarEvento,
  calcularSaldoPorLedger,
  existeEventoParaReferencia
};
