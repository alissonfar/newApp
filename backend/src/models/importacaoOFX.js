// src/models/importacaoOFX.js
const mongoose = require('mongoose');

const ImportacaoOFXSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  subconta: { type: mongoose.Schema.Types.ObjectId, ref: 'Subconta', required: true },
  nomeArquivo: { type: String, required: true },
  status: {
    type: String,
    enum: ['processando', 'revisao', 'finalizada', 'cancelada'],
    default: 'processando'
  },
  dtStart: { type: Date, default: null },
  dtEnd: { type: Date, default: null },
  saldoFinalExtrato: { type: Number, default: null },
  dataSaldoExtrato: { type: Date, default: null },
  totalTransacoes: { type: Number, default: 0 },
  totalCreditos: { type: Number, default: 0 },
  totalDebitos: { type: Number, default: 0 },
  totalIgnoradas: { type: Number, default: 0 }
}, {
  timestamps: true
});

ImportacaoOFXSchema.index({ usuario: 1, status: 1 });
ImportacaoOFXSchema.index({ subconta: 1, createdAt: -1 });

module.exports = mongoose.model('ImportacaoOFX', ImportacaoOFXSchema);
