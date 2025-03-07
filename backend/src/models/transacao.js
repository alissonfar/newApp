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
  tags: { type: Object, required: false, default: {} },
  pagamentos: { type: [PagamentoSchema], required: true },
  status: { type: String, enum: ['ativo', 'estornado'], default: 'ativo' },
  // [NOVO] Vincula a transação a um usuário
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true }
});

module.exports = mongoose.model('Transacao', TransacaoSchema);
