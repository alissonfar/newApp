// src/models/transferencia.js
const mongoose = require('mongoose');

const TransferenciaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  subcontaOrigem: { type: mongoose.Schema.Types.ObjectId, ref: 'Subconta', required: true },
  subcontaDestino: { type: mongoose.Schema.Types.ObjectId, ref: 'Subconta', required: true },
  valor: { type: Number, required: true },
  data: { type: Date, required: true },
  status: {
    type: String,
    enum: ['pendente', 'concluida'],
    default: 'pendente'
  },
  transacaoOFX: { type: mongoose.Schema.Types.ObjectId, ref: 'TransacaoOFX', default: null }
}, {
  timestamps: true
});

TransferenciaSchema.index({ usuario: 1, status: 1 });
TransferenciaSchema.index({ subcontaOrigem: 1, subcontaDestino: 1 });

module.exports = mongoose.model('Transferencia', TransferenciaSchema);
