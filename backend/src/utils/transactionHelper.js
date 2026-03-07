// src/utils/transactionHelper.js
const mongoose = require('mongoose');

const TRANSACTION_REPLICA_SET_MSG =
  'Transações MongoDB requerem replica set. Execute rs.initiate() no mongosh após subir o container.';

/**
 * Inicia sessão e transação MongoDB.
 * @returns {Promise<mongoose.ClientSession>}
 */
async function startTransactionSession() {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    return session;
  } catch (err) {
    session.endSession().catch(() => {});
    const msg = (err && err.message) || '';
    if (
      msg.includes('replica set') ||
      msg.includes('Transaction numbers') ||
      (err.code && [251, 263].includes(err.code))
    ) {
      throw new Error(`${TRANSACTION_REPLICA_SET_MSG} Detalhe: ${msg}`);
    }
    throw err;
  }
}

module.exports = { startTransactionSession, TRANSACTION_REPLICA_SET_MSG };
