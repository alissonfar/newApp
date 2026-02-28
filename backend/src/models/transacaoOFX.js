// src/models/transacaoOFX.js
const mongoose = require('mongoose');

const TransacaoOFXSchema = new mongoose.Schema({
  importacaoOFX: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportacaoOFX', required: true },
  subconta: { type: mongoose.Schema.Types.ObjectId, ref: 'Subconta', required: true },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  fitid: { type: String, required: true },
  tipo: {
    type: String,
    enum: ['credito', 'debito'],
    required: true
  },
  valor: { type: Number, required: true },
  data: { type: Date, required: true },
  memo: { type: String, default: '' },
  descricao: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pendente', 'aprovada', 'ignorada', 'ja_importada'],
    default: 'pendente'
  },
  movimentacaoInterna: { type: Boolean, default: false },
  transferencia: { type: mongoose.Schema.Types.ObjectId, ref: 'Transferencia', default: null },
  transacaoCriada: { type: mongoose.Schema.Types.ObjectId, ref: 'Transacao', default: null },
  deduplicationKey: { type: String, required: true }
}, {
  timestamps: true
});

TransacaoOFXSchema.index({ importacaoOFX: 1, status: 1 });
TransacaoOFXSchema.index({ usuario: 1, deduplicationKey: 1 });
TransacaoOFXSchema.index({ subconta: 1, data: -1 });

module.exports = mongoose.model('TransacaoOFX', TransacaoOFXSchema);
