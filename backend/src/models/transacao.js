// src/models/transacao.js
const mongoose = require('mongoose');

const PagamentoSchema = new mongoose.Schema({
  pessoa: { type: String, required: true },
  valor: { type: Number, required: true },
  tags: { type: Object }
});

const TransacaoSchema = new mongoose.Schema({
  tipo: { type: String, enum: ['gasto', 'recebivel'], required: true },
  descricao: { type: String, required: true },
  valor: { type: Number, required: true },
  data: { type: Date, required: true },
  observacao: { type: String, required: false },
  pagamentos: { type: [PagamentoSchema], required: true },
  status: { type: String, enum: ['ativo', 'estornado'], default: 'ativo' },
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  deduplicationKey: { type: String, sparse: true },
  // Parcelamento - campos opcionais (null = transação avulsa)
  isInstallment: { type: Boolean, default: false },
  installmentGroupId: { type: mongoose.Schema.Types.ObjectId, default: null },
  installmentNumber: { type: Number, default: null },
  installmentTotal: { type: Number, default: null },
  installmentIntervalMonths: { type: Number, default: null },
  installmentIntervalDays: { type: Number, default: null },
  // Módulo de Recebimentos (Conciliação)
  settlementAsSource: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement', default: null },
  settlementApplied: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement', default: null },
  settlementLeftoverFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement', default: null },
  // Módulo Patrimônio - vinculação opcional a subconta
  subconta: { type: mongoose.Schema.Types.ObjectId, ref: 'Subconta', required: false, default: null }
});

TransacaoSchema.index({ usuario: 1, settlementAsSource: 1 }, { sparse: true });
TransacaoSchema.index({ usuario: 1, settlementApplied: 1 }, { sparse: true });
TransacaoSchema.index({ usuario: 1, deduplicationKey: 1 }, { sparse: true });
TransacaoSchema.index({ usuario: 1, installmentGroupId: 1 }, { sparse: true });
TransacaoSchema.index({ usuario: 1, status: 1, data: -1 });
TransacaoSchema.index({ usuario: 1, 'pagamentos.pessoa': 1 });

module.exports = mongoose.model('Transacao', TransacaoSchema);
