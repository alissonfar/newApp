// src/models/ledgerPatrimonial.js
const mongoose = require('mongoose');

const TIPOS_EVENTO = [
  'deposito',
  'saque',
  'transferencia_saida',
  'transferencia_entrada',
  'rendimento',
  'aporte',
  'importacao_ofx',
  'importacao_csv',
  'ajuste_manual',
  'snapshot_inicial',
  'correcao'
];

const ORIGENS_SISTEMA = [
  'subconta_criacao',
  'confirmacao_manual',
  'importacao_ofx',
  'importacao_csv',
  'transferencia',
  'correcao'
];

const LedgerPatrimonialSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  subconta: { type: mongoose.Schema.Types.ObjectId, ref: 'Subconta', required: true },
  dataEvento: { type: Date, required: true },
  valor: { type: Number, required: true },
  tipoEvento: {
    type: String,
    enum: TIPOS_EVENTO,
    required: true
  },
  origemSistema: {
    type: String,
    enum: ORIGENS_SISTEMA,
    required: true
  },
  referenciaTipo: { type: String, default: null },
  referenciaId: { type: mongoose.Schema.Types.ObjectId, default: null },
  descricao: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

LedgerPatrimonialSchema.index({ usuario: 1 });
LedgerPatrimonialSchema.index({ subconta: 1, dataEvento: 1, createdAt: 1 });
LedgerPatrimonialSchema.index({ usuario: 1, dataEvento: 1 });
LedgerPatrimonialSchema.index({ referenciaTipo: 1, referenciaId: 1 }, { sparse: true });
LedgerPatrimonialSchema.index(
  { referenciaTipo: 1, referenciaId: 1, subconta: 1 },
  { sparse: true, unique: true }
);

module.exports = mongoose.model('LedgerPatrimonial', LedgerPatrimonialSchema);
module.exports.TIPOS_EVENTO = TIPOS_EVENTO;
module.exports.ORIGENS_SISTEMA = ORIGENS_SISTEMA;
