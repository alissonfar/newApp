// backend/src/models/contaFixa.js
const mongoose = require('mongoose');
const { PagamentoSchema } = require('./transacao');

const CicloSchema = new mongoose.Schema({
  mes: { type: Number, required: true, min: 0, max: 11 },
  ano: { type: Number, required: true }
}, { _id: false });

const ContaFixaSchema = new mongoose.Schema({
  usuario: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  nome: { type: String, required: true },
  tipo: { type: String, enum: ['gasto', 'recebivel'], required: true },
  valorEsperado: { type: Number, required: true, min: 0 },
  diaLancamento: { type: Number, required: true, min: 1, max: 31 },
  diaVencimento: { type: Number, required: true, min: 1, max: 31 },
  vencimentoMesSeguinte: { type: Boolean, default: false },
  modo: { type: String, enum: ['automatico', 'confirmacao'], required: true },
  pagamentosTemplate: { type: [PagamentoSchema], required: true },
  dataInicio: { type: Date, required: true, default: Date.now },
  dataFim: { type: Date, default: null },
  totalRepeticoes: { type: Number, default: null, min: 1 },
  totalGerados: { type: Number, default: 0 },
  status: { type: String, enum: ['ativa', 'pausada', 'encerrada'], default: 'ativa' },
  ciclosPulados: { type: [CicloSchema], default: [] },
  ultimoCicloProcessado: { type: CicloSchema, default: null }
}, {
  timestamps: {
    createdAt: 'dataCriacao',
    updatedAt: 'dataAtualizacao'
  }
});

ContaFixaSchema.index({ usuario: 1, status: 1 });

module.exports = mongoose.model('ContaFixa', ContaFixaSchema);
