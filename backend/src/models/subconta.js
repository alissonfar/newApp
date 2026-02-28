// src/models/subconta.js
const mongoose = require('mongoose');

const RendimentoSchema = new mongoose.Schema({
  percentualCDI: { type: Number, default: null }
}, { _id: false });

const SubcontaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  instituicao: { type: mongoose.Schema.Types.ObjectId, ref: 'Instituicao', required: true },
  nome: { type: String, required: true },
  tipo: {
    type: String,
    enum: ['corrente', 'rendimento_automatico', 'caixinha', 'investimento_fixo'],
    required: true
  },
  proposito: {
    type: String,
    enum: ['disponivel', 'reserva_emergencia', 'objetivo', 'guardado'],
    required: true
  },
  rendimento: { type: RendimentoSchema, default: null },
  percentualCDI: { type: Number, default: null },
  saldoAtual: { type: Number, default: 0 },
  dataUltimaConfirmacao: { type: Date, default: null },
  meta: { type: Number, default: null },
  ativo: { type: Boolean, default: true }
}, {
  timestamps: true
});

SubcontaSchema.index({ usuario: 1 });
SubcontaSchema.index({ instituicao: 1 });
SubcontaSchema.index({ usuario: 1, instituicao: 1, nome: 1 }, { unique: true });

module.exports = mongoose.model('Subconta', SubcontaSchema);
