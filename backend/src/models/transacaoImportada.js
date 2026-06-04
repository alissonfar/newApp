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

const TransacaoImportadaSchema = new mongoose.Schema({
  importacao: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Importacao', 
    required: true 
  },
  descricao: { 
    type: String, 
    required: true 
  },
  valor: { 
    type: Number, 
    required: true 
  },
  data: { 
    type: Date, 
    required: true 
  },
  categoria: { 
    type: String,
    required: false
  },
  tipo: { 
    type: String, 
    enum: ['gasto', 'recebivel'],
    required: true 
  },
  status: {
    type: String,
    enum: ['pendente', 'revisada', 'validada', 'erro', 'ja_importada', 'possivel_duplicata', 'processada', 'estornada', 'ignorada'],
    default: 'pendente'
  },
  erro: { 
    type: String,
    default: null
  },
  pagamentos: {
    type: [PagamentoSchema],
    default: []
  },
  observacao: {
    type: String,
    default: ''
  },
  dadosOriginais: { 
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  deduplicationKey: { 
    type: String,
    default: null
  },
  transacaoCriada: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transacao',
    default: null
  },
  // Detecção de possível duplicata com data diferente (mesma descricao + valor, data próxima)
  transacaoSemelhanteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transacao',
    default: null
  },
  transacaoSemelhanteDistanciaDias: {
    type: Number,
    default: null
  },
  transacaoSemelhanteData: {
    type: Date,
    default: null
  },
  transacaoSemelhanteValor: {
    type: Number,
    default: null
  },
  transacaoSemelhanteDescricao: {
    type: String,
    default: null
  },
  // Sugestão de pessoa responsável inferida do histórico (descrição similar + ≥2 matches)
  pessoaSugerida: {
    type: String,
    default: null
  },
  pessoaSugeridaCount: {
    type: Number,
    default: null
  },
  pessoaSugeridaConfianca: {
    type: String,
    enum: ['alta', 'media', 'baixa'],
    default: null
  },
  pessoaSugeridaSample: {
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Transacao' },
    descricao: { type: String },
    data: { type: Date },
    valor: { type: Number },
    pessoa: { type: String }
  },
  pessoaSugeridaTransacaoIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transacao'
  }],
  pessoaSugeridaAplicada: {
    type: Boolean,
    default: false
  },
  // Parcelamento (para importação já expandida)
  isInstallment: { type: Boolean, default: false },
  installmentGroupId: { type: mongoose.Schema.Types.ObjectId, default: null },
  installmentNumber: { type: Number, default: null },
  installmentTotal: { type: Number, default: null },
  installmentIntervalMonths: { type: Number, default: null },
  installmentIntervalDays: { type: Number, default: null },
  parentTransactionId: { type: mongoose.Schema.Types.ObjectId, default: null },
  usuario: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario', 
    required: true 
  },
  subconta: { type: mongoose.Schema.Types.ObjectId, ref: 'Subconta', required: false, default: null },
  contaConjunta: {
    ativo: { type: Boolean, default: false },
    vinculoId: { type: mongoose.Schema.Types.ObjectId, ref: 'VinculoConjunto' },
    pagoPor: { type: String, enum: ['usuario', 'outro'] },
    valorTotal: { type: Number, min: 0 },
    parteUsuario: { type: Number, min: 0 },
    parteOutro: { type: Number, min: 0 }
  }
}, { 
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Converte para formato Transacao (para criar transação real)
TransacaoImportadaSchema.methods.paraTransacao = function() {
  const pagamentos = this.pagamentos && this.pagamentos.length > 0
    ? this.pagamentos
    : [{ pessoa: 'Titular', valor: this.valor, tags: {} }];
  const result = {
    tipo: this.tipo,
    descricao: this.descricao,
    valor: this.valor,
    data: this.data,
    observacao: this.observacao || '',
    pagamentos,
    usuario: this.usuario,
    subconta: this.subconta || undefined,
    deduplicationKey: this.deduplicationKey || undefined,
    isInstallment: this.isInstallment || false,
    installmentGroupId: this.installmentGroupId || undefined,
    installmentNumber: this.installmentNumber,
    installmentTotal: this.installmentTotal,
    installmentIntervalMonths: this.installmentIntervalMonths,
    installmentIntervalDays: this.installmentIntervalDays,
    parentTransactionId: this.parentTransactionId || undefined
  };
  if (this.contaConjunta?.ativo) {
    result.contaConjunta = {
      ativo: true,
      vinculoId: this.contaConjunta.vinculoId,
      pagoPor: this.contaConjunta.pagoPor,
      valorTotal: this.contaConjunta.valorTotal,
      parteUsuario: this.contaConjunta.parteUsuario,
      parteOutro: this.contaConjunta.parteOutro,
      acertadoEm: null
    };
  }
  return result;
};

// Middleware para validar valor
TransacaoImportadaSchema.pre('save', function(next) {
  if (this.valor < 0) {
    next(new Error('O valor da transação não pode ser negativo'));
  }
  next();
});

// Índices
TransacaoImportadaSchema.index({ importacao: 1, status: 1 });
TransacaoImportadaSchema.index({ importacao: 1, status: 1, deduplicationKey: 1 });
TransacaoImportadaSchema.index({ usuario: 1 });
TransacaoImportadaSchema.index({ usuario: 1, deduplicationKey: 1, status: 1 });
TransacaoImportadaSchema.index({ data: -1 });

module.exports = mongoose.model('TransacaoImportada', TransacaoImportadaSchema); 