// src/models/fechamentoInstancia.js
const mongoose = require('mongoose');

const FechamentoInstanciaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  cadastro: { type: mongoose.Schema.Types.ObjectId, ref: 'FechamentoCadastro', required: true },
  dataInicio: { type: Date, required: true },
  dataFim: { type: Date, required: true },
  status: {
    type: String,
    enum: ['aberto', 'enviado', 'aguardando_recebimento', 'recebido'],
    default: 'aberto'
  },
  settlementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Settlement', default: null },
  observacoes: { type: String, default: null }
}, { timestamps: true });

FechamentoInstanciaSchema.index({ usuario: 1, cadastro: 1, dataInicio: 1 });
FechamentoInstanciaSchema.index({ usuario: 1, dataInicio: 1, dataFim: 1 });

module.exports = mongoose.model('FechamentoInstancia', FechamentoInstanciaSchema);
