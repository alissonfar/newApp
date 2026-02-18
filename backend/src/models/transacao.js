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
  deduplicationKey: { type: String, sparse: true }
});

TransacaoSchema.index({ usuario: 1, deduplicationKey: 1 }, { sparse: true });
TransacaoSchema.index({ usuario: 1, status: 1, data: -1 });
TransacaoSchema.index({ usuario: 1, 'pagamentos.pessoa': 1 });

module.exports = mongoose.model('Transacao', TransacaoSchema);
