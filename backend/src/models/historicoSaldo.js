// src/models/historicoSaldo.js
const mongoose = require('mongoose');

const HistoricoSaldoSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  subconta: { type: mongoose.Schema.Types.ObjectId, ref: 'Subconta', required: true },
  saldo: { type: Number, required: true },
  data: { type: Date, required: true },
  origem: {
    type: String,
    enum: ['manual', 'importacao_ofx', 'importacao_csv'],
    required: true
  },
  observacao: { type: String, default: '' }
}, {
  timestamps: true
});

HistoricoSaldoSchema.index({ usuario: 1 });
HistoricoSaldoSchema.index({ subconta: 1 });
HistoricoSaldoSchema.index({ subconta: 1, data: -1 });

module.exports = mongoose.model('HistoricoSaldo', HistoricoSaldoSchema);
