// src/models/pluggyConfig.js
const mongoose = require('mongoose');

const ItemMappingSchema = new mongoose.Schema({
  itemId: { type: String, required: true, index: true },
  accountId: { type: String, required: true },
  accountType: { type: String, enum: ['BANK', 'CREDIT'], default: 'BANK' },
  accountSubtype: { type: String, default: null },
  accountName: { type: String, default: '' },
  accountNumber: { type: String, default: '' },
  connectorId: { type: Number, default: null },
  connectorName: { type: String, default: '' },
  subconta: { type: mongoose.Schema.Types.ObjectId, ref: 'Subconta', required: true },
  status: {
    type: String,
    enum: [
      'UPDATED',
      'UPDATING',
      'WAITING_USER_INPUT',
      'WAITING_USER_ACTION',
      'MERGING',
      'LOGIN_ERROR',
      'OUTDATED',
      'DESCONHECIDO'
    ],
    default: 'DESCONHECIDO'
  },
  lastSyncAt: { type: Date, default: null },
  lastSyncError: { type: String, default: null },
  ativo: { type: Boolean, default: true }
}, { _id: true, timestamps: true });

ItemMappingSchema.index({ itemId: 1, accountId: 1 }, { unique: true });
ItemMappingSchema.index({ subconta: 1 });

const PluggyConfigSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    unique: true,
    index: true
  },
  clientId: { type: String, required: true },
  clientSecretEncrypted: { type: String, required: true },
  ambiente: {
    type: String,
    enum: ['sandbox', 'production'],
    default: 'sandbox'
  },
  ativo: { type: Boolean, default: true },
  items: { type: [ItemMappingSchema], default: [] },
  conexoes: [{
    itemId: { type: String, required: true },
    connectorId: { type: Number, default: null },
    connectorName: { type: String, default: '' },
    connectedAt: { type: Date, default: Date.now }
  }],
  ultimoTesteConexao: {
    data: { type: Date, default: null },
    sucesso: { type: Boolean, default: null },
    mensagem: { type: String, default: null }
  },
  ultimaSync: {
    data: { type: Date, default: null },
    totalImportacoes: { type: Number, default: 0 },
    totalTransacoes: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function (doc, ret) {
      delete ret.clientSecretEncrypted;
      delete ret.__v;
      return ret;
    }
  }
});

module.exports = mongoose.model('PluggyConfig', PluggyConfigSchema);
