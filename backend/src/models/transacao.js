// src/models/transacao.js
const mongoose = require('mongoose');

const ParcelamentoConfigSchema = new mongoose.Schema({
  ativo: { type: Boolean, default: false },
  quantidade: { type: Number, default: null, min: 2, max: 60 },
  intervaloDias: { type: Number, default: 30, min: 1, max: 365 }
}, { _id: false });

const PagamentoSchema = new mongoose.Schema({
  pessoa: { type: String, required: true },
  valor: { type: Number, required: true },
  tags: { type: Object },
  parcelamento: { type: ParcelamentoConfigSchema, default: null },
  installmentNumber: { type: Number, default: null },
  installmentTotal: { type: Number, default: null },
  installmentGroupId: { type: mongoose.Schema.Types.ObjectId, default: null }
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
  parentTransactionId: { type: mongoose.Schema.Types.ObjectId, default: null },
  // Parcelamento - campos opcionais (null = transação avulsa) — LEGACY mantidos para compatibilidade
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
  subconta: { type: mongoose.Schema.Types.ObjectId, ref: 'Subconta', required: false, default: null },
  // Módulo Conta Conjunta - metadados de divisão (ignorado quando ativo=false)
  contaConjunta: {
    ativo: { type: Boolean, default: false },
    vinculoId: { type: mongoose.Schema.Types.ObjectId, ref: 'VinculoConjunto' },
    pagoPor: { type: String, enum: ['usuario', 'outro'] },
    valorTotal: { type: Number, min: 0 },
    parteUsuario: { type: Number, min: 0 },
    parteOutro: { type: Number, min: 0 },
    acertadoEm: { type: mongoose.Schema.Types.ObjectId, ref: 'AcertoConjunto', default: null }
  },
  // Módulo Empréstimos - quando setado, esta transação é parte de um empréstimo
  emprestimoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Emprestimo', default: null },
  // True apenas para a transação adicional de juros auto-criada na quitação.
  // Identifica transações que NÃO devem ser filtradas/subtraídas como 'recebimento de empréstimo'.
  emprestimoEhJurosAuto: { type: Boolean, default: false }
});

TransacaoSchema.index({ usuario: 1, settlementAsSource: 1 }, { sparse: true });
TransacaoSchema.index({ usuario: 1, settlementApplied: 1 }, { sparse: true });
TransacaoSchema.index({ usuario: 1, deduplicationKey: 1 }, { sparse: true });
TransacaoSchema.index({ usuario: 1, installmentGroupId: 1 }, { sparse: true });
TransacaoSchema.index({ usuario: 1, parentTransactionId: 1 }, { sparse: true });
TransacaoSchema.index({ usuario: 1, status: 1, data: -1 });
TransacaoSchema.index({ usuario: 1, 'pagamentos.pessoa': 1 });
TransacaoSchema.index({ usuario: 1, 'contaConjunta.ativo': 1, 'contaConjunta.vinculoId': 1, 'contaConjunta.acertadoEm': 1 }, { sparse: true });
TransacaoSchema.index({ usuario: 1, emprestimoId: 1 }, { sparse: true });

module.exports = mongoose.model('Transacao', TransacaoSchema);
