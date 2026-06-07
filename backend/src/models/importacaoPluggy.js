// src/models/importacaoPluggy.js
const mongoose = require('mongoose');

const ItemSincronizadoSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  accountId: { type: String, required: true },
  accountName: { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  accountType: { type: String, default: 'BANK' },
  connectorId: { type: Number, default: null },
  connectorName: { type: String, default: '' },
  subconta: { type: mongoose.Schema.Types.ObjectId, ref: 'Subconta', required: true },
  saldoPluggy: { type: Number, default: null },
  dataSaldoPluggy: { type: Date, default: null },
  totalTransacoes: { type: Number, default: 0 },
  totalCreditos: { type: Number, default: 0 },
  totalDebitos: { type: Number, default: 0 },
  totalIgnoradas: { type: Number, default: 0 },
  totalJaImportadas: { type: Number, default: 0 },
  erro: { type: String, default: null }
}, { _id: false });

const ImportacaoPluggySchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  status: {
    type: String,
    enum: ['processando', 'revisao', 'finalizada', 'cancelada', 'erro'],
    default: 'processando'
  },
  itens: { type: [ItemSincronizadoSchema], default: [] },
  dataInicioSync: { type: Date, default: null },
  dataFimSync: { type: Date, default: null },
  totalTransacoes: { type: Number, default: 0 },
  totalCreditos: { type: Number, default: 0 },
  totalDebitos: { type: Number, default: 0 },
  totalIgnoradas: { type: Number, default: 0 },
  totalJaImportadas: { type: Number, default: 0 },
  erro: { type: String, default: null },
  finalizedAt: { type: Date, default: null }
}, {
  timestamps: true
});

ImportacaoPluggySchema.index({ usuario: 1, status: 1 });
ImportacaoPluggySchema.index({ usuario: 1, createdAt: -1 });

module.exports = mongoose.model('ImportacaoPluggy', ImportacaoPluggySchema);
