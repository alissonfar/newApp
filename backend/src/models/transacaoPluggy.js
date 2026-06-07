// src/models/transacaoPluggy.js
const mongoose = require('mongoose');

const TransacaoPluggySchema = new mongoose.Schema({
  importacaoPluggy: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportacaoPluggy', required: true, index: true },
  itemId: { type: String, required: true },
  accountId: { type: String, required: true },
  subconta: { type: mongoose.Schema.Types.ObjectId, ref: 'Subconta', required: true },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  pluggyTransactionId: { type: String, required: true },
  pluggyAccountId: { type: String, default: null },
  tipo: {
    type: String,
    enum: ['credito', 'debito'],
    required: true
  },
  valor: { type: Number, required: true },
  data: { type: Date, required: true },
  descricao: { type: String, default: '' },
  descricaoRaw: { type: String, default: null },
  providerCode: { type: String, default: null },
  currencyCode: { type: String, default: 'BRL' },
  pluggyStatus: {
    type: String,
    enum: ['POSTED', 'PENDING'],
    default: 'POSTED'
  },
  status: {
    type: String,
    enum: ['pendente', 'aprovada', 'ignorada', 'ja_importada'],
    default: 'pendente'
  },
  categoriaPluggy: { type: String, default: null },
  dadosOriginais: { type: mongoose.Schema.Types.Mixed, default: {} },
  transacaoCriada: { type: mongoose.Schema.Types.ObjectId, ref: 'Transacao', default: null },
  deduplicationKey: { type: String, required: true, index: true }
}, {
  timestamps: true
});

TransacaoPluggySchema.index({ importacaoPluggy: 1, status: 1 });
TransacaoPluggySchema.index({ usuario: 1, deduplicationKey: 1 });
TransacaoPluggySchema.index({ subconta: 1, data: -1 });
TransacaoPluggySchema.index({ pluggyTransactionId: 1 });

module.exports = mongoose.model('TransacaoPluggy', TransacaoPluggySchema);
